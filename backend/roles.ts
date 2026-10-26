import { z } from 'zod'
import { prisma } from './_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from './_lib/auth.js'

const createRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .transform((v) => v.toUpperCase().replace(/\s+/g, '_')),
  description: z.string().trim().max(300).optional(),
  permissionKeys: z.array(z.string()).default([]),
})

function serializeRole(role: {
  id: string
  name: string
  description: string | null
  permissions: { permission: { key: string } }[]
}) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: role.permissions.map((p) => p.permission.key),
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  try {
    // Lectura: cualquier usuario autenticado (útil para el selector de audiencia al publicar).
    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) {
      const status = statusForProfileError(error)
      return res.status(status).json({ ok: false, error })
    }

    if (req.method === 'GET') {
      const roles = await prisma.role.findMany({
        orderBy: { name: 'asc' },
        include: { permissions: { include: { permission: { select: { key: true } } } } },
      })
      return res.status(200).json({ ok: true, roles: roles.map(serializeRole) })
    }

    // Creación: solo quien administra roles.
    if (!hasPermission(profile, 'roles.manage')) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    const parsed = createRoleSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'INVALID_ROLE' })
    }

    const permissions = await prisma.permission.findMany({
      where: { key: { in: parsed.data.permissionKeys } },
      select: { id: true },
    })

    const role = await prisma.role.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
      },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    })

    return res.status(201).json({ ok: true, role: serializeRole(role) })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return res.status(409).json({ ok: false, error: 'ROLE_ALREADY_EXISTS' })
    }
    console.error('Roles API failed', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'ROLES_API_FAILED' })
  }
}
