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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  try {
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
