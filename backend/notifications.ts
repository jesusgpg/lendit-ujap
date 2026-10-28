import { z } from 'zod'
import { prisma } from './_lib/prisma.js'
import { getAuthenticatedProfile, isAdministrativeProfile, statusForProfileError, type ApiRequest, type ApiResponse } from './_lib/auth.js'

const markReadSchema = z.object({
  action: z.literal('read'),
  notificationIds: z.array(z.string().uuid()).min(1).max(100),
})
const markAllSchema = z.object({ action: z.literal('read-all') })

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  try {
    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) return res.status(statusForProfileError(error)).json({ ok: false, error })
    if (isAdministrativeProfile(profile)) return res.status(403).json({ ok: false, error: 'ADMIN_MARKETPLACE_FORBIDDEN' })

    if (req.method === 'GET') {
      const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: { userId: profile.id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 40,
          select: { id: true, type: true, title: true, message: true, href: true, readAt: true, createdAt: true },
        }),
        prisma.notification.count({ where: { userId: profile.id, readAt: null } }),
      ])
      return res.status(200).json({ ok: true, notifications, unreadCount })
    }

    const body = req.body as { action?: unknown } | null
    if (body?.action === 'read-all') {
      const parsed = markAllSchema.safeParse(body)
      if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID_NOTIFICATION_ACTION' })
      await prisma.notification.updateMany({ where: { userId: profile.id, readAt: null }, data: { readAt: new Date() } })
      return res.status(200).json({ ok: true })
    }

    const parsed = markReadSchema.safeParse(body)
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID_NOTIFICATION_ACTION' })
    await prisma.notification.updateMany({
      where: { userId: profile.id, id: { in: parsed.data.notificationIds }, readAt: null },
      data: { readAt: new Date() },
    })
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Notifications API failed', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'NOTIFICATIONS_API_FAILED' })
  }
}
