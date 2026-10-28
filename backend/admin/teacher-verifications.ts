import { Prisma } from '../../generated/prisma/client.js'
import { prisma } from '../_lib/prisma.js'
import {
  getAuthenticatedProfile,
  hasPermission,
  statusForProfileError,
  type ApiRequest,
  type ApiResponse,
} from '../_lib/auth.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  const { profile, error } = await getAuthenticatedProfile(req)
  if (!profile) {
    const status = statusForProfileError(error)
    return res.status(status).json({ ok: false, error })
  }

  if (!hasPermission(profile, 'teachers.review')) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  const query = req.query ?? {}
  const statusParam = typeof query.status === 'string' ? query.status.toUpperCase() : 'PENDING'
  const schoolId = typeof query.schoolId === 'string' && query.schoolId.trim() ? query.schoolId.trim() : undefined
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const page = Math.max(1, parseInt(typeof query.page === 'string' ? query.page : '1', 10) || 1)
  const pageSize = Math.min(50, Math.max(1, parseInt(typeof query.pageSize === 'string' ? query.pageSize : '10', 10) || 10))

  const where: Prisma.TeacherVerificationWhereInput = {}
  const reviewableStatuses = ['PENDING', 'NEEDS_CORRECTION', 'REJECTED', 'APPROVED'] as const

  if (statusParam === 'ALL') {
    // Drafts have not been submitted and do not belong in the administrative review queue.
    where.status = { in: [...reviewableStatuses] }
  } else if (reviewableStatuses.includes(statusParam as typeof reviewableStatuses[number])) {
    where.status = statusParam as Prisma.EnumTeacherVerificationStatusFilter
  } else {
    return res.status(400).json({ ok: false, error: 'INVALID_STATUS' })
  }

  if (schoolId) {
    where.schoolId = schoolId
  }

  if (search) {
    where.user = {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }
  }

  const [total, items] = await Promise.all([
    prisma.teacherVerification.count({ where }),
    prisma.teacherVerification.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: { select: { name: true } },
          },
        },
        school: { select: { id: true, name: true } },
        career: { select: { id: true, name: true } },
        submissions: {
          select: { version: true, submittedAt: true },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    }),
  ])

  return res.status(200).json({
    ok: true,
    data: items.map((item) => ({
      id: item.id,
      userId: item.userId,
      applicant: {
        id: item.user.id,
        name: `${item.user.firstName} ${item.user.lastName}`.trim(),
        email: item.user.email,
        phone: item.user.phone,
        role: item.user.role.name,
      },
      school: item.school,
      career: item.career,
      department: item.department,
      status: item.status,
      version: item.version,
      submittedVersion: item.submissions[0]?.version ?? null,
      submittedAt: item.submissions[0]?.submittedAt.toISOString() ?? null,
      documentPath: item.documentPath,
      rejectionReason: item.rejectionReason,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  })
}
