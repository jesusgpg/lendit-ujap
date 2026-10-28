import { prisma } from './prisma.js'

export const threadInclude = {
  item: { select: { id: true, title: true, photoUrl: true, ownerId: true, owner: { select: { id: true, firstName: true, lastName: true, photoUrl: true, isActive: true } } } },
  requester: { select: { id: true, firstName: true, lastName: true, photoUrl: true, isActive: true } },
  messages: { orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }], take: 1 },
}

type Person = { id: string; firstName: string; lastName: string; photoUrl: string | null; isActive: boolean }
type LastMessage = { senderId: string; content: string; createdAt: Date }
type ConversationSource = {
  id: string
  requesterId: string
  createdAt: Date
  item: { id: string; title: string; photoUrl: string | null; ownerId: string; owner: Person }
  requester: Person
  messages: LastMessage[]
}

export function serializeThread(source: ConversationSource, userId: string) {
  const person = source.item.ownerId === userId ? source.requester : source.item.owner
  const latest = source.messages[0]
  return {
    id: source.id,
    kind: 'inquiry' as const,
    item: { id: source.item.id, title: source.item.title, photoUrl: source.item.photoUrl },
    counterpart: { id: person.id, name: `${person.firstName} ${person.lastName}`, photo: person.photoUrl },
    status: 'OPEN',
    canSend: person.isActive,
    latestMessage: latest ? { senderId: latest.senderId, content: latest.content, createdAt: latest.createdAt.toISOString() } : null,
    updatedAt: (latest?.createdAt ?? source.createdAt).toISOString(),
  }
}

export async function findThread(kind: 'request' | 'inquiry', id: string, userId: string) {
  let conversation = kind === 'inquiry'
    ? await prisma.itemConversation.findUnique({ where: { id }, include: threadInclude })
    : null

  if (kind === 'request') {
    const request = await prisma.loanRequest.findUnique({
      where: { id },
      select: { itemId: true, requesterId: true, item: { select: { ownerId: true } } },
    })
    if (!request) return { error: 'THREAD_NOT_FOUND' as const }
    if (request.requesterId !== userId && request.item.ownerId !== userId) return { error: 'FORBIDDEN' as const }
    conversation = await prisma.itemConversation.upsert({
      where: { itemId_requesterId: { itemId: request.itemId, requesterId: request.requesterId } },
      create: { itemId: request.itemId, requesterId: request.requesterId },
      update: {},
      include: threadInclude,
    })
  }

  if (!conversation) return { error: 'THREAD_NOT_FOUND' as const }
  if (conversation.requesterId !== userId && conversation.item.ownerId !== userId) return { error: 'FORBIDDEN' as const }
  return { thread: serializeThread(conversation, userId) }
}

export async function inbox(userId: string, page: number) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT c.id FROM public."ItemConversation" c
    JOIN public."Item" i ON i.id = c."itemId"
    LEFT JOIN LATERAL (
      SELECT max(m."createdAt") AS latest
      FROM public."ChatMessage" m
      WHERE m."conversationId" = c.id
    ) recent ON true
    WHERE c."requesterId" = ${userId}::uuid OR i."ownerId" = ${userId}::uuid
    ORDER BY COALESCE(recent.latest, c."createdAt") DESC, c.id DESC
    LIMIT 51 OFFSET ${page * 50}
  `
  const shown = rows.slice(0, 50)
  const conversations = await prisma.itemConversation.findMany({
    where: { id: { in: shown.map(row => row.id) } },
    include: threadInclude,
  })
  const mapped = new Map(conversations.map(conversation => [conversation.id, serializeThread(conversation, userId)]))
  return { threads: shown.map(row => mapped.get(row.id)).filter(Boolean), hasMore: rows.length > 50 }
}
