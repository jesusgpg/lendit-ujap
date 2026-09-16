import { z } from 'zod'
import type { Prisma } from '../generated/prisma/client.js'
import { prisma } from './_lib/prisma.js'
import {
  getAuthenticatedProfile,
  hasPermission,
  statusForProfileError,
  type ApiRequest,
  type ApiResponse,
  type AuthenticatedProfile,
} from './_lib/auth.js'
import { handleRequestMutation, listRequests } from './_lib/requests.js'
import { canManageOwnedResource } from './_lib/workflowRules.js'

const itemModeSchema = z.enum(['LOAN', 'RENTAL'])
const currencySchema = z.enum(['USD', 'EUR', 'VES'])
const optionalPriceSchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.number().positive().max(100000).optional(),
)

const createItemSchema = z.object({
  title: z.string().trim().min(2).max(160),
  categoryKey: z.string().trim().min(1).max(60),
  duration: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).optional(),
  photoUrl: z.string().url().max(2048).optional(),
  mode: itemModeSchema.default('LOAN'),
  price: optionalPriceSchema,
  currency: currencySchema.optional(),
  // Roles con permiso para pedir este item. Vacío/ausente = visible para todos.
  restrictedToRoles: z.array(z.string().trim().min(1)).optional(),
})

const updateItemSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(2).max(160).optional(),
    categoryKey: z.string().trim().min(1).max(60).optional(),
    duration: z.string().trim().min(1).max(80).optional(),
    description: z.union([z.string().trim().max(1000), z.null()]).optional(),
    photoUrl: z.string().url().max(2048).nullable().optional(),
    mode: itemModeSchema.optional(),
    price: optionalPriceSchema,
    currency: currencySchema.optional(),
    status: z.enum(['AVAILABLE', 'PAUSED']).optional(),
    restrictedToRoles: z.array(z.string().trim().min(1)).optional(),
  })
  .refine(
    (data) => Object.entries(data).some(([key, value]) => key !== 'id' && value !== undefined),
    'At least one item field is required',
  )

const deleteItemSchema = z.object({ id: z.string().uuid() })

type ItemForSerialization = {
  id: string
  ownerId: string
  code: string
  title: string
  description: string | null
  photoUrl: string | null
  duration: string | null
  mode: string
  price: { toString: () => string } | null
  currency: string | null
  status: string
  createdAt: Date
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
    ownerId: item.ownerId,
    code: item.code,
    title: item.title,
    description: item.description,
    photoUrl: item.photoUrl,
    category: item.category.label,
    categoryKey: item.category.key,
    categoryIcon: item.category.icon,
    duration: item.duration ?? 'Por acordar',
    mode: item.mode === 'RENTAL' ? 'RENTAL' : 'LOAN',
    price: item.price === null ? null : Number(item.price.toString()),
    currency: item.currency,
    status: statusMap[item.status] ?? 'lent',
    restrictedToRoles: item.visibleToRoles.map((v) => v.role.name),
    publishedAt: item.createdAt.toISOString(),
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

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function bodyResource(body: unknown) {
  if (!body || typeof body !== 'object' || !('resource' in body)) return ''
  const resource = body.resource
  return typeof resource === 'string' ? resource : ''
}

function isItemPhotoUrl(photoUrl: string) {
  const supabaseUrl = process.env.SUPABASE_URL
  if (!supabaseUrl) return false

  try {
    const expectedOrigin = new URL(supabaseUrl).origin
    const url = new URL(photoUrl)
    const bucketPath = '/storage/v1/object/public/item-photos/'
    return url.origin === expectedOrigin && url.pathname.startsWith(bucketPath) && url.pathname.length > bucketPath.length
  } catch {
    return false
  }
}

function validateRental(mode: string, price: number | undefined, currency: string | undefined) {
  if (mode === 'RENTAL' && (!price || !currency)) {
    return 'RENTAL_PRICE_REQUIRED'
  }
  return null
}

async function resolveRoleIds(roleNames: string[] | undefined) {
  if (!roleNames) return undefined

  const names = [...new Set(roleNames.map((role) => role.toUpperCase()))]
  if (!names.length) return []

  const roles = await prisma.role.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true },
  })
  if (roles.length !== names.length) return null
  return roles.map((role) => role.id)
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method ?? '')) {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  try {
    if (req.method === 'GET') {
      const view = queryValue(req.query?.view)
      const { profile, error } = await getAuthenticatedProfile(req)

      if (view === 'requests') {
        if (!profile) {
          return res.status(statusForProfileError(error)).json({ ok: false, error })
        }
        return listRequests(profile, res)
      }

      // Sin sesión: solo lo público (sin restricción de rol). Con sesión: lo público + lo restringido a su rol.
      const mine = ['1', 'true'].includes(queryValue(req.query?.mine))
      if (mine && !profile) {
        return res.status(statusForProfileError(error)).json({ ok: false, error })
      }

      // users.manage es el permiso exclusivo de ADMIN en el seed: quien lo tiene ve todo, sin filtrar por audiencia.
      const seesEverything = !!profile && hasPermission(profile, 'users.manage')

      const items = await prisma.item.findMany({
        where: {
          ...(mine && profile
            ? { ownerId: profile.id }
            : {
                status: 'AVAILABLE',
                ...(seesEverything
                  ? {}
                  : {
                      OR: [
                        { visibleToRoles: { none: {} } },
                        ...(profile ? [{ visibleToRoles: { some: { roleId: profile.roleId } } }] : []),
                      ],
                    }),
              }),
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: itemInclude,
      })

      return res.status(200).json({ ok: true, items: items.map(serializeItem) })
    }

    if (bodyResource(req.body) === 'request') {
      const { profile, error } = await getAuthenticatedProfile(req)
      if (!profile) {
        return res.status(statusForProfileError(error)).json({ ok: false, error })
      }
      return handleRequestMutation(req, res, profile)
    }

    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) {
      const status = statusForProfileError(error)
      return res.status(status).json({ ok: false, error })
    }
    if (!hasPermission(profile, 'items.publish')) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    if (req.method === 'DELETE') {
      const parsed = deleteItemSchema.safeParse(req.body ?? {})
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: 'INVALID_ITEM_DELETE' })
      }

      const item = await prisma.item.findUnique({
        where: { id: parsed.data.id },
        select: {
          ownerId: true,
          photoUrl: true,
          _count: { select: { loanRequests: true, loans: true } },
        },
      })
      if (!item) {
        return res.status(404).json({ ok: false, error: 'ITEM_NOT_FOUND' })
      }
      if (!canManageOwnedResource(item.ownerId, profile.id, profile.permissions)) {
        return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
      }
      if (item._count.loanRequests || item._count.loans) {
        return res.status(409).json({ ok: false, error: 'ITEM_HAS_LOAN_HISTORY' })
      }

      await prisma.item.delete({ where: { id: parsed.data.id } })
      return res.status(200).json({ ok: true, item: { id: parsed.data.id, photoUrl: item.photoUrl } })
    }

    if (req.method === 'PATCH') {
      return updateItem(req, res, profile)
    }

    const parsed = createItemSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'INVALID_ITEM' })
    }

    const rentalError = validateRental(parsed.data.mode, parsed.data.price, parsed.data.currency)
    if (rentalError) {
      return res.status(400).json({ ok: false, error: rentalError })
    }
    if (parsed.data.photoUrl && !isItemPhotoUrl(parsed.data.photoUrl)) {
      return res.status(400).json({ ok: false, error: 'INVALID_ITEM_PHOTO' })
    }

    const category = await prisma.category.findUnique({ where: { key: parsed.data.categoryKey } })
    if (!category) {
      return res.status(400).json({ ok: false, error: 'INVALID_CATEGORY' })
    }

    const restrictedRoleIds = await resolveRoleIds(parsed.data.restrictedToRoles)
    if (restrictedRoleIds === null) {
      return res.status(400).json({ ok: false, error: 'INVALID_ITEM_AUDIENCE' })
    }

    const item = await prisma.item.create({
      data: {
        ownerId: profile.id,
        code: generateItemCode(),
        title: parsed.data.title,
        description: parsed.data.description || null,
        photoUrl: parsed.data.photoUrl || null,
        categoryId: category.id,
        duration: parsed.data.duration,
        mode: parsed.data.mode,
        price: parsed.data.mode === 'RENTAL' ? parsed.data.price : null,
        currency: parsed.data.mode === 'RENTAL' ? parsed.data.currency : null,
        status: 'AVAILABLE',
        visibleToRoles: restrictedRoleIds?.length
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

async function updateItem(req: ApiRequest, res: ApiResponse, profile: AuthenticatedProfile) {
  const parsed = updateItemSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'INVALID_ITEM_UPDATE' })
  }

  const currentItem = await prisma.item.findUnique({
    where: { id: parsed.data.id },
    select: { ownerId: true, status: true, mode: true, price: true, currency: true },
  })
  if (!currentItem) {
    return res.status(404).json({ ok: false, error: 'ITEM_NOT_FOUND' })
  }
  if (!canManageOwnedResource(currentItem.ownerId, profile.id, profile.permissions)) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }
  if (currentItem.status === 'LENT') {
    return res.status(409).json({ ok: false, error: 'ITEM_HAS_ACTIVE_LOAN' })
  }

  const mode = parsed.data.mode ?? currentItem.mode
  const currentPrice = currentItem.price === null ? undefined : Number(currentItem.price.toString())
  const price = parsed.data.price ?? currentPrice
  const currency = parsed.data.currency ?? currentItem.currency ?? undefined
  const rentalTermsChanged =
    (parsed.data.mode !== undefined && parsed.data.mode !== currentItem.mode) ||
    (parsed.data.price !== undefined && parsed.data.price !== currentPrice) ||
    (parsed.data.currency !== undefined && parsed.data.currency !== currentItem.currency)

  if (rentalTermsChanged) {
    const pendingRequestCount = await prisma.loanRequest.count({
      where: { itemId: parsed.data.id, status: 'PENDING' },
    })
    if (pendingRequestCount) {
      return res.status(409).json({ ok: false, error: 'ITEM_HAS_PENDING_REQUESTS' })
    }
  }

  const rentalError = validateRental(mode, price, currency)
  if (rentalError) {
    return res.status(400).json({ ok: false, error: rentalError })
  }
  if (parsed.data.photoUrl && !isItemPhotoUrl(parsed.data.photoUrl)) {
    return res.status(400).json({ ok: false, error: 'INVALID_ITEM_PHOTO' })
  }

  const updateData: Prisma.ItemUpdateInput = {}
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title
  if (parsed.data.duration !== undefined) updateData.duration = parsed.data.duration
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null
  if (parsed.data.photoUrl !== undefined) updateData.photoUrl = parsed.data.photoUrl
  if (parsed.data.mode !== undefined) updateData.mode = parsed.data.mode
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status
  if (mode === 'LOAN') {
    updateData.price = null
    updateData.currency = null
  } else {
    updateData.price = price
    updateData.currency = currency
  }

  if (parsed.data.categoryKey !== undefined) {
    const category = await prisma.category.findUnique({ where: { key: parsed.data.categoryKey } })
    if (!category) {
      return res.status(400).json({ ok: false, error: 'INVALID_CATEGORY' })
    }
    updateData.category = { connect: { id: category.id } }
  }

  const restrictedRoleIds = await resolveRoleIds(parsed.data.restrictedToRoles)
  if (restrictedRoleIds === null) {
    return res.status(400).json({ ok: false, error: 'INVALID_ITEM_AUDIENCE' })
  }

  const item = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.item.update({
      where: { id: parsed.data.id },
      data: updateData,
    })

    if (restrictedRoleIds !== undefined) {
      await transaction.itemVisibility.deleteMany({ where: { itemId: parsed.data.id } })
      if (restrictedRoleIds.length) {
        await transaction.itemVisibility.createMany({
          data: restrictedRoleIds.map((roleId) => ({ itemId: parsed.data.id, roleId })),
        })
      }
    }

    return transaction.item.findUniqueOrThrow({ where: { id: updated.id }, include: itemInclude })
  })

  return res.status(200).json({ ok: true, item: serializeItem(item) })
}
