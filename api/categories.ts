import { z } from 'zod'
import { prisma } from './_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from './_lib/auth.js'

const createCategorySchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .transform((v) => v.toLowerCase().replace(/\s+/g, '-')),
  label: z.string().trim().min(2).max(80),
  icon: z.string().trim().max(8).optional(),
  blurb: z.string().trim().max(300).optional(),
})

const updateCategorySchema = z.object({
  label: z.string().trim().min(2).max(80).optional(),
  icon: z.string().trim().max(8).nullable().optional(),
  blurb: z.string().trim().max(300).nullable().optional(),
})

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const categoryKey = Array.isArray(req.query?.key) ? req.query.key[0] : req.query?.key
  const isDetailRequest = Boolean(categoryKey)

  if (
    (isDetailRequest && req.method !== 'DELETE' && req.method !== 'PATCH') ||
    (!isDetailRequest && req.method !== 'GET' && req.method !== 'POST')
  ) {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  try {
    if (isDetailRequest) {
      if (!categoryKey) {
        return res.status(400).json({ ok: false, error: 'MISSING_CATEGORY_KEY' })
      }

      const { profile, error } = await getAuthenticatedProfile(req)
      if (!profile) {
        return res.status(statusForProfileError(error)).json({ ok: false, error })
      }
      if (!hasPermission(profile, 'categories.manage')) {
        return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
      }

      if (req.method === 'PATCH') {
        const parsed = updateCategorySchema.safeParse(req.body ?? {})
        if (!parsed.success) {
          return res.status(400).json({ ok: false, error: 'INVALID_CATEGORY_UPDATE' })
        }

        const updated = await prisma.category.update({ where: { key: categoryKey }, data: parsed.data })
        return res.status(200).json({ ok: true, category: updated })
      }

      const itemsUsingCategory = await prisma.item.count({ where: { category: { key: categoryKey } } })
      if (itemsUsingCategory > 0) {
        return res.status(409).json({ ok: false, error: 'CATEGORY_IN_USE' })
      }

      await prisma.category.delete({ where: { key: categoryKey } })
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'GET') {
      const categories = await prisma.category.findMany({ orderBy: { label: 'asc' } })
      return res.status(200).json({
        ok: true,
        categories: categories.map((c) => ({ key: c.key, label: c.label, icon: c.icon, blurb: c.blurb })),
      })
    }

    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) {
      return res.status(statusForProfileError(error)).json({ ok: false, error })
    }
    if (!hasPermission(profile, 'categories.manage')) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    const parsed = createCategorySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'INVALID_CATEGORY' })
    }

    const { key, ...categoryData } = parsed.data
    if (!key) {
      return res.status(400).json({ ok: false, error: 'INVALID_CATEGORY' })
    }

    const category = await prisma.category.create({ data: { ...categoryData, key } })
    return res.status(201).json({ ok: true, category })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return res.status(409).json({ ok: false, error: 'CATEGORY_ALREADY_EXISTS' })
    }
    console.error('Categories API failed', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'CATEGORIES_API_FAILED' })
  }
}
