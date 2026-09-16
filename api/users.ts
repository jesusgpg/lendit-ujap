import { prisma } from './_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from './_lib/auth.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  try {
    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) {
      const status = statusForProfileError(error)
      return res.status(status).json({ ok: false, error })
    }
    if (!hasPermission(profile, 'users.manage')) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { role: { select: { id: true, name: true } }, career: { select: { name: true } } },
    })

    return res.status(200).json({
      ok: true,
      users: users.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        career: u.career.name,
        role: { id: u.role.id, name: u.role.name },
        isActive: u.isActive,
      })),
    })
  } catch (usersError) {
    console.error('Users API failed', usersError instanceof Error ? usersError.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'USERS_API_FAILED' })
  }
}
