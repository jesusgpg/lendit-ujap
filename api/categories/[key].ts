import { z } from 'zod'
import { prisma } from '../_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from '../_lib/auth.js'

const updateCategorySchema = z.object({
  label: z.string().trim().min(2).max(80).optional(),
  icon: z.string().trim().max(8).nullable().optional(),
  blurb: z.string().trim().max(300).nullable().optional(),
})

export default async function handler(req: ApiRequest & { query?: { key?: string } }, res: ApiResponse) {
  if (req.method !== 'DELETE' && req.method !== 'PATCH') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  const key = req.query?.key
  if (!key) {
    return res.status(400).json({ ok: false, error: 'MISSING_CATEGORY_KEY' })
  }

  try {
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

      const updated = await prisma.category.update({ where: { key }, data: parsed.data })
      return res.status(200).json({ ok: true, category: updated })
    }

    const itemsUsingCategory = await prisma.item.count({ where: { category: { key } } })
    if (itemsUsingCategory > 0) {
      return res.status(409).json({ ok: false, error: 'CATEGORY_IN_USE' })
    }

    await prisma.category.delete({ where: { key } })
    return res.status(200).json({ ok: true })
  } catch (categoryError) {
    console.error('Category update/delete failed', categoryError instanceof Error ? categoryError.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'CATEGORY_OPERATION_FAILED' })
  }
}
