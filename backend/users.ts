import { prisma } from './_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from './_lib/auth.js'

const PAGE_SIZE = 25

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

    const param = (name: string) => { const v = req.query?.[name]; return Array.isArray(v) ? v[0] : v }
    const q = (param('q') ?? '').trim().slice(0, 100)
    const page = Math.max(1, Math.min(10000, Number.parseInt(param('page') ?? '1', 10) || 1))
    const where = q
      ? {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          role: { select: { id: true, name: true } },
          career: { select: { name: true } },
          school: { select: { name: true } },
        },
      }),
    ])

    return res.status(200).json({
      ok: true,
      total,
      page,
      pageSize: PAGE_SIZE,
      users: users.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        career: u.career?.name ?? '',
        school: u.school?.name ?? '',
        department: u.department ?? null,
        role: { id: u.role.id, name: u.role.name },
        isActive: u.isActive,
      })),
    })
  } catch {
    console.error('Users API failed')
    return res.status(500).json({ ok: false, error: 'USERS_API_FAILED' })
  }
}
