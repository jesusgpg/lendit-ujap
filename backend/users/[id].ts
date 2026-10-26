import { z } from 'zod'
import { prisma } from '../_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from '../_lib/auth.js'
import { countEffectiveAdmins, LastAdminError, lockAdminChanges, userIsEffectiveAdmin } from '../_lib/adminGuard.js'

const updateUserSchema = z.object({
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
})

export default async function handler(req: ApiRequest & { query?: { id?: string } }, res: ApiResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  const id = req.query?.id
  if (!id) {
    return res.status(400).json({ ok: false, error: 'MISSING_USER_ID' })
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

    const parsed = updateUserSchema.safeParse(req.body ?? {})
    if (!parsed.success || (!parsed.data.roleId && parsed.data.isActive === undefined)) {
      return res.status(400).json({ ok: false, error: 'INVALID_USER_UPDATE' })
    }

    if (parsed.data.roleId) {
      const role = await prisma.role.findUnique({ where: { id: parsed.data.roleId } })
      if (!role) {
        return res.status(400).json({ ok: false, error: 'INVALID_ROLE' })
      }
      if (role.name === 'PROFESSOR') {
        const approvedVerification = await prisma.teacherVerification.findFirst({
          where: { userId: id, status: 'APPROVED' },
        })
        if (!approvedVerification) {
          return res.status(400).json({ ok: false, error: 'TEACHER_VERIFICATION_REQUIRED' })
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await lockAdminChanges(tx)
      const existing = await tx.user.findUnique({ where: { id } })
      if (!existing) return null
      const losesAccess = parsed.data.isActive === false || (parsed.data.roleId !== undefined && parsed.data.roleId !== existing.roleId)
      if (losesAccess && (await userIsEffectiveAdmin(tx, id))) {
        const newRoleKeepsAdmin = parsed.data.roleId && parsed.data.isActive !== false
          ? Boolean(await tx.rolePermission.count({ where: { roleId: parsed.data.roleId, permission: { key: 'roles.manage' } } }))
          : false
        if (!newRoleKeepsAdmin && (await countEffectiveAdmins(tx, { excludeUserId: id })) === 0) throw new LastAdminError()
      }
      return tx.user.update({
        where: { id },
        data: {
          ...(parsed.data.roleId ? { roleId: parsed.data.roleId } : {}),
          ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        },
        include: { role: { select: { id: true, name: true } } },
      })
    })
    if (!updated) return res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' })

    return res.status(200).json({
      ok: true,
      user: { id: updated.id, role: updated.role, isActive: updated.isActive },
    })
  } catch (updateError) {
    if (updateError instanceof LastAdminError) return res.status(409).json({ ok: false, error: 'LAST_ADMIN' })
    console.error('User update failed')
    return res.status(500).json({ ok: false, error: 'USER_UPDATE_FAILED' })
  }
}
