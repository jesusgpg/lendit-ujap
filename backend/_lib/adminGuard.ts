import { prisma } from './prisma.js'

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export class LastAdminError extends Error {
  constructor() { super('LAST_ADMIN') }
}

// Administrador efectivo = usuario activo cuyo rol tiene roles.manage (mismo criterio que isAdministrativeRole).
// El lock serializa los cambios que pueden quitar acceso administrativo, para que dos peticiones
// simultáneas no dejen el sistema sin administradores.
export async function lockAdminChanges(tx: Tx) {
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(727001)')
}

export async function countEffectiveAdmins(
  tx: Tx,
  options: { excludeUserId?: string; excludeRoleId?: string } = {},
) {
  return tx.user.count({
    where: {
      isActive: true,
      ...(options.excludeUserId ? { id: { not: options.excludeUserId } } : {}),
      ...(options.excludeRoleId ? { roleId: { not: options.excludeRoleId } } : {}),
      role: { permissions: { some: { permission: { key: 'roles.manage' } } } },
    },
  })
}

export async function userIsEffectiveAdmin(tx: Tx, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { isActive: true, role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } },
  })
  return Boolean(user?.isActive && user.role.permissions.some((p) => p.permission.key === 'roles.manage'))
}
