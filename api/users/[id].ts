import { z } from 'zod'
import { prisma } from '../_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from '../_lib/auth.js'

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
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(parsed.data.roleId ? { roleId: parsed.data.roleId } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
      include: { role: { select: { id: true, name: true } } },
    })

    return res.status(200).json({
      ok: true,
      user: { id: updated.id, role: updated.role, isActive: updated.isActive },
    })
  } catch (updateError) {
    console.error('User update failed', updateError instanceof Error ? updateError.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'USER_UPDATE_FAILED' })
  }
}
