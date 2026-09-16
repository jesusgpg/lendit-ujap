import { z } from 'zod'
import { prisma } from './_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from './_lib/auth.js'

const createItemSchema = z.object({
  title: z.string().trim().min(2).max(160),
  categoryKey: z.string().trim().min(1).max(60),
  duration: z.string().trim().min(1).max(80),
  // Roles con permiso para pedir este item. Vacío/ausente = visible para todos.
  restrictedToRoles: z.array(z.string().trim().min(1)).optional(),
})

type ItemForSerialization = {
  id: string
  code: string
  title: string
  duration: string | null
  status: string
  category: { key: string; label: string; icon: string | null }
  visibleToRoles: { role: { name: string } }[]
}

function serializeItem(item: ItemForSerialization) {
  const statusMap: Record<string, string> = {
    AVAILABLE: 'available',
    LENT: 'lent',
    PAUSED: 'paused',
    REJECTED: 'rejected',
  }

  return {
    id: item.id,
    code: item.code,
    title: item.title,
    category: item.category.label,
    categoryKey: item.category.key,
    categoryIcon: item.category.icon,
    duration: item.duration ?? 'Por acordar',
    status: statusMap[item.status] ?? 'lent',
    restrictedToRoles: item.visibleToRoles.map((v) => v.role.name),
  }
}

function generateItemCode() {
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
  return `#UJAP-${suffix}`
}

const itemInclude = {
  category: { select: { key: true, label: true, icon: true } },
  visibleToRoles: { select: { role: { select: { name: true } } } },
} as const

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  try {
    if (req.method === 'GET') {
      // Sin sesión: solo lo público (sin restricción de rol). Con sesión: lo público + lo restringido a su rol.
      const { profile } = await getAuthenticatedProfile(req)

      // users.manage es el permiso exclusivo de ADMIN en el seed: quien lo tiene ve todo, sin filtrar por audiencia.
      const seesEverything = !!profile && hasPermission(profile, 'users.manage')

      const items = await prisma.item.findMany({
        where: {
          status: 'AVAILABLE',
          ...(seesEverything
            ? {}
            : {
                OR: [
                  { visibleToRoles: { none: {} } },
                  ...(profile ? [{ visibleToRoles: { some: { roleId: profile.roleId } } }] : []),
                ],
              }),
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: itemInclude,
      })

      return res.status(200).json({ ok: true, items: items.map(serializeItem) })
    }

    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) {
      const status = statusForProfileError(error)
      return res.status(status).json({ ok: false, error })
    }
    if (!hasPermission(profile, 'items.publish')) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    const parsed = createItemSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'INVALID_ITEM' })
    }

    const category = await prisma.category.findUnique({ where: { key: parsed.data.categoryKey } })
    if (!category) {
      return res.status(400).json({ ok: false, error: 'INVALID_CATEGORY' })
    }

    let restrictedRoleIds: string[] = []
    if (parsed.data.restrictedToRoles?.length) {
      const roles = await prisma.role.findMany({
        where: { name: { in: parsed.data.restrictedToRoles.map((r) => r.toUpperCase()) } },
        select: { id: true },
      })
      restrictedRoleIds = roles.map((r) => r.id)
    }

    // Las publicaciones quedan disponibles de inmediato: no hay cola de revisión.
    const item = await prisma.item.create({
      data: {
        ownerId: profile.id,
        code: generateItemCode(),
        title: parsed.data.title,
        categoryId: category.id,
        duration: parsed.data.duration,
        status: 'AVAILABLE',
        visibleToRoles: restrictedRoleIds.length
          ? { create: restrictedRoleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      include: itemInclude,
    })

    return res.status(201).json({ ok: true, item: serializeItem(item) })
  } catch (error) {
    console.error('Items API failed', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'ITEMS_API_FAILED' })
  }
}
