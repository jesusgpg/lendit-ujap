import { z } from 'zod'
import { prisma } from '../_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from '../_lib/auth.js'
import { countEffectiveAdmins, LastAdminError, lockAdminChanges } from '../_lib/adminGuard.js'

const updateRoleSchema = z.object({
  description: z.string().trim().max(300).optional(),
  permissionKeys: z.array(z.string().max(80)).max(100).optional(),
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
    if (!parsed.success || (parsed.data.description === undefined && parsed.data.permissionKeys === undefined)) {
      return res.status(400).json({ ok: false, error: 'INVALID_ROLE_UPDATE' })
    }

    const role = await prisma.role.findUnique({ where: { id } })
    if (!role) {
      return res.status(404).json({ ok: false, error: 'ROLE_NOT_FOUND' })
    }

    const requestedKeys = parsed.data.permissionKeys ? [...new Set(parsed.data.permissionKeys)] : undefined
    const permissions = requestedKeys
      ? await prisma.permission.findMany({ where: { key: { in: requestedKeys } }, select: { id: true, key: true } })
      : []
    if (requestedKeys && permissions.length !== requestedKeys.length) {
      const known = new Set(permissions.map((p) => p.key))
      return res.status(400).json({ ok: false, error: 'UNKNOWN_PERMISSION', unknown: requestedKeys.filter((k) => !known.has(k)) })
    }

    const updated = await prisma.$transaction(async (tx) => {
      await lockAdminChanges(tx)
      if (requestedKeys && !requestedKeys.includes('roles.manage')) {
        const hadAdmin = await tx.rolePermission.count({ where: { roleId: id, permission: { key: 'roles.manage' } } })
        if (hadAdmin > 0 && (await countEffectiveAdmins(tx, { excludeRoleId: id })) === 0) {
          const affected = await tx.user.count({ where: { roleId: id, isActive: true } })
          if (affected > 0) throw new LastAdminError()
        }
      }
      if (parsed.data.description !== undefined) {
        await tx.role.update({ where: { id }, data: { description: parsed.data.description } })
      }
      if (requestedKeys) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } })
        if (permissions.length) {
          await tx.rolePermission.createMany({
            data: permissions.map((p) => ({ roleId: id, permissionId: p.id })),
          })
        }
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
    if (error instanceof LastAdminError) return res.status(409).json({ ok: false, error: 'LAST_ADMIN' })
    console.error('Role update failed')
    return res.status(500).json({ ok: false, error: 'ROLE_UPDATE_FAILED' })
  }
}
