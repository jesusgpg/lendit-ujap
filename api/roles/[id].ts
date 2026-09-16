import { z } from 'zod'
import { prisma } from '../_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from '../_lib/auth.js'

const updateRoleSchema = z.object({
  description: z.string().trim().max(300).optional(),
  permissionKeys: z.array(z.string()),
})

// Roles del seed inicial: son el suelo del sistema de permisos y no se pueden borrar.
const PROTECTED_ROLE_NAMES = ['ADMIN', 'STUDENT', 'PROFESSOR']

export default async function handler(req: ApiRequest & { query?: { id?: string } }, res: ApiResponse) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  const id = req.query?.id
  if (!id) {
    return res.status(400).json({ ok: false, error: 'MISSING_ROLE_ID' })
  }

  try {
    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) {
      const status = statusForProfileError(error)
      return res.status(status).json({ ok: false, error })
    }
    if (!hasPermission(profile, 'roles.manage')) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    if (req.method === 'DELETE') {
      const role = await prisma.role.findUnique({ where: { id } })
      if (!role) {
        return res.status(404).json({ ok: false, error: 'ROLE_NOT_FOUND' })
      }
      if (PROTECTED_ROLE_NAMES.includes(role.name)) {
        return res.status(409).json({ ok: false, error: 'ROLE_PROTECTED' })
      }
      const usersWithRole = await prisma.user.count({ where: { roleId: id } })
      if (usersWithRole > 0) {
        return res.status(409).json({ ok: false, error: 'ROLE_IN_USE' })
      }
      await prisma.role.delete({ where: { id } })
      return res.status(200).json({ ok: true })
    }

    const parsed = updateRoleSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'INVALID_ROLE_UPDATE' })
    }

    const role = await prisma.role.findUnique({ where: { id } })
    if (!role) {
      return res.status(404).json({ ok: false, error: 'ROLE_NOT_FOUND' })
    }

    const permissions = await prisma.permission.findMany({
      where: { key: { in: parsed.data.permissionKeys } },
      select: { id: true },
    })

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.description !== undefined) {
        await tx.role.update({ where: { id }, data: { description: parsed.data.description } })
      }
      await tx.rolePermission.deleteMany({ where: { roleId: id } })
      if (permissions.length) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({ roleId: id, permissionId: p.id })),
        })
      }
      return tx.role.findUniqueOrThrow({
        where: { id },
        include: { permissions: { include: { permission: { select: { key: true } } } } },
      })
    })

    return res.status(200).json({
      ok: true,
      role: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        permissions: updated.permissions.map((p) => p.permission.key),
      },
    })
  } catch (error) {
    console.error('Role update failed', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'ROLE_UPDATE_FAILED' })
  }
}
