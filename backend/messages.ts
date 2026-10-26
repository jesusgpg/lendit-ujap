import { z } from 'zod'
import { prisma } from './_lib/prisma.js'
import { findThread, inbox, serializeThread, threadInclude } from './_lib/message-threads.js'
import { getAuthenticatedProfile, isAdministrativeProfile, isTeacherApplicant, statusForProfileError, type ApiRequest, type ApiResponse } from './_lib/auth.js'

const threadSchema = z.object({ requestId: z.string().uuid().optional(), conversationId: z.string().uuid().optional() })
  .refine(value => Boolean(value.requestId) !== Boolean(value.conversationId))
const createMessageSchema = z.object({ requestId: z.string().uuid().optional(), conversationId: z.string().uuid().optional(), content: z.string().trim().min(1).max(2000) })
  .refine(value => Boolean(value.requestId) !== Boolean(value.conversationId))
const startSchema = z.object({ action: z.literal('start'), itemId: z.string().uuid() })
const queryValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  try {
    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) return res.status(statusForProfileError(error)).json({ ok: false, error })
    if (isAdministrativeProfile(profile)) return res.status(403).json({ ok: false, error: 'ADMIN_MARKETPLACE_FORBIDDEN' })
    if (req.method === 'GET' && queryValue(req.query?.view) === 'inbox') {
      const page = z.coerce.number().int().min(0).max(10000).safeParse(queryValue(req.query?.page) ?? 0)
      if (!page.success) return res.status(400).json({ ok: false, error: 'INVALID_PAGE' })
      return res.status(200).json({ ok: true, ...await inbox(profile.id, page.data) })
    }
    if (req.method === 'POST' && (req.body as { action?: string } | null)?.action === 'start') {
      const parsed = startSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID_ITEM_ID' })
      const item = await prisma.item.findUnique({ where: { id: parsed.data.itemId }, include: { visibleToRoles: true, owner: { select: { isActive: true } } } })
      if (!item) return res.status(404).json({ ok: false, error: 'ITEM_NOT_FOUND' })
      if (item.ownerId === profile.id) return res.status(409).json({ ok: false, error: 'OWN_ITEM' })
      const existing = await prisma.itemConversation.findUnique({ where: { itemId_requesterId: { itemId: item.id, requesterId: profile.id } }, include: threadInclude })
      if (existing) return res.status(200).json({ ok: true, thread: serializeThread(existing, 'inquiry', profile.id) })
      if (item.status !== 'AVAILABLE' || !item.owner.isActive) return res.status(409).json({ ok: false, error: 'ITEM_NOT_AVAILABLE' })
      if (item.visibleToRoles.length && (isTeacherApplicant(profile) || !item.visibleToRoles.some(role => role.roleId === profile.roleId))) return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
      const conversation = await prisma.itemConversation.upsert({
        where: { itemId_requesterId: { itemId: item.id, requesterId: profile.id } },
        create: { itemId: item.id, requesterId: profile.id }, update: {}, include: threadInclude,
      })
      return res.status(200).json({ ok: true, thread: serializeThread(conversation, 'inquiry', profile.id) })
    }
    const parsed = req.method === 'GET'
      ? threadSchema.safeParse({ requestId: queryValue(req.query?.requestId), conversationId: queryValue(req.query?.conversationId) })
      : createMessageSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ ok: false, error: req.method === 'GET' ? 'INVALID_REQUEST_ID' : 'INVALID_MESSAGE_DATA' })
    const { requestId, conversationId } = parsed.data
    const kind = conversationId ? 'inquiry' : 'request'
    const resolved = await findThread(kind, (conversationId ?? requestId)!, profile.id)
    if (!resolved.thread) return res.status(resolved.error === 'FORBIDDEN' ? 403 : 404).json({ ok: false, error: resolved.error === 'THREAD_NOT_FOUND' && kind === 'request' ? 'REQUEST_NOT_FOUND' : resolved.error })
    const where = conversationId ? { conversationId } : { requestId }
    if (req.method === 'GET') {
      const rawCursor = queryValue(req.query?.before)
      const cursor = rawCursor ? z.string().uuid().safeParse(rawCursor) : null
      if (cursor && !cursor.success) return res.status(400).json({ ok: false, error: 'INVALID_CURSOR' })
      if (cursor?.success && !await prisma.chatMessage.findFirst({ where: { id: cursor.data, ...where }, select: { id: true } })) return res.status(400).json({ ok: false, error: 'INVALID_CURSOR' })
      const rows = await prisma.chatMessage.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 101, ...(cursor?.success ? { cursor: { id: cursor.data }, skip: 1 } : {}) })
      const visible = rows.slice(0, 100)
      return res.status(200).json({ ok: true, thread: resolved.thread, messages: visible.reverse(), nextCursor: rows.length > 100 ? visible[0]?.id : null })
    }
    if (!resolved.thread.canSend) return res.status(409).json({ ok: false, error: kind === 'request' ? 'REQUEST_NOT_ACTIVE' : 'CONVERSATION_CLOSED' })
    const message = await prisma.chatMessage.create({ data: { ...where, senderId: profile.id, content: (parsed.data as { content: string }).content } })
    return res.status(201).json({ ok: true, message })
  } catch (err) {
    console.error('Messages API failed', err instanceof Error ? err.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'MESSAGES_API_FAILED' })
  }
}
