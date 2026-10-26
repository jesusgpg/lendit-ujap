import { z } from 'zod'
import { prisma } from './_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from './_lib/auth.js'

const photoIdSchema = z.string().regex(/^[\w-]{1,100}$/)
const createCategorySchema = z.object({
  key: z.string().trim().min(2).max(60).transform((v) => v.toLowerCase().replace(/\s+/g, '-')),
  label: z.string().trim().min(2).max(80),
  icon: z.string().trim().max(8).optional(),
  blurb: z.string().trim().max(300).optional(),
  unsplashPhotoId: photoIdSchema.nullable().optional(),
  imagenUrl: z.string().trim().url().startsWith('https://').nullable().optional(),
  imagenAlt: z.string().trim().min(2).max(500).optional(),
})
const updateCategorySchema = createCategorySchema.omit({ key: true }).partial().extend({
  icon: z.string().trim().max(8).nullable().optional(),
  blurb: z.string().trim().max(300).nullable().optional(),
})

const unsplashPhotoSchema = z.object({
  id: photoIdSchema,
  alt_description: z.string().nullable(),
  urls: z.object({ regular: z.url() }),
  user: z.object({ name: z.string(), links: z.object({ html: z.url() }) }),
  links: z.object({ html: z.url(), download_location: z.url() }),
})

export class UnsplashError extends Error {
  status: number
  code: string
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code }
}

export function unsplashAttributionUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.hostname !== 'unsplash.com') throw new UnsplashError(502, 'UNSPLASH_INVALID_RESPONSE')
  url.searchParams.set('utm_source', 'lendit_ujap')
  url.searchParams.set('utm_medium', 'referral')
  return url.href
}

export async function unsplashRequest(url: string) {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) throw new UnsplashError(503, 'UNSPLASH_NOT_CONFIGURED')
  const target = new URL(url)
  if (target.protocol !== 'https:' || target.hostname !== 'api.unsplash.com') throw new UnsplashError(502, 'UNSPLASH_INVALID_RESPONSE')
  let response: Response
  try {
    response = await fetch(target, {
      headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
      signal: AbortSignal.timeout(10000), redirect: 'error',
    })
  } catch { throw new UnsplashError(502, 'UNSPLASH_UNAVAILABLE') }
  if (!response.ok) throw new UnsplashError(response.status === 429 || response.status === 403 ? 429 : 502, response.status === 429 || response.status === 403 ? 'UNSPLASH_RATE_LIMITED' : 'UNSPLASH_UNAVAILABLE')
  return response.json() as Promise<unknown>
}

export function categoryPhotoData(value: unknown) {
  const parsed = unsplashPhotoSchema.safeParse(value)
  if (!parsed.success) throw new UnsplashError(502, 'UNSPLASH_INVALID_RESPONSE')
  const photo = parsed.data
  const image = new URL(photo.urls.regular)
  const download = new URL(photo.links.download_location)
  if (image.protocol !== 'https:' || image.hostname !== 'images.unsplash.com' || download.protocol !== 'https:' || download.hostname !== 'api.unsplash.com' || download.pathname !== `/photos/${photo.id}/download`) throw new UnsplashError(502, 'UNSPLASH_INVALID_RESPONSE')
  return {
    imagenUrl: image.href,
    imagenAlt: photo.alt_description || 'Fotografía representativa de la categoría',
    unsplashPhotoId: photo.id,
    photographerName: photo.user.name,
    photographerUrl: unsplashAttributionUrl(photo.user.links.html),
    unsplashUrl: unsplashAttributionUrl(photo.links.html),
    unsplashDownloadLocation: download.href,
  }
}

export async function searchCategoryPhotos(query: string, perPage = 8) {
  const url = new URL('https://api.unsplash.com/search/photos')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('orientation', 'landscape')
  url.searchParams.set('content_filter', 'high')
  const result = z.object({ results: z.array(unsplashPhotoSchema) }).safeParse(await unsplashRequest(url.href))
  if (!result.success) throw new UnsplashError(502, 'UNSPLASH_INVALID_RESPONSE')
  return result.data.results.map(categoryPhotoData)
}

type PhotoFields = { [K in keyof ReturnType<typeof categoryPhotoData>]: string | null } & { unsplashDownloadTrackedAt: Date | null }

export const emptyCategoryPhoto: PhotoFields = {
  imagenUrl: null, imagenAlt: null, unsplashPhotoId: null, photographerName: null,
  photographerUrl: null, unsplashUrl: null, unsplashDownloadLocation: null, unsplashDownloadTrackedAt: null,
}

// Public DTO deliberately excludes operational download metadata.
function categoryDto(c: { key: string; label: string; icon: string | null; blurb: string | null } & Partial<PhotoFields>) {
  return { key: c.key, label: c.label, icon: c.icon, blurb: c.blurb,
    imagenUrl: c.imagenUrl ?? null, imagenAlt: c.imagenAlt ?? null, unsplashPhotoId: c.unsplashPhotoId ?? null,
    photographerName: c.photographerName ?? null, photographerUrl: c.photographerUrl ?? null, unsplashUrl: c.unsplashUrl ?? null }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const param = (name: string) => { const value = req.query?.[name]; return Array.isArray(value) ? value[0] : value }
  const categoryKey = param('key')
  const action = param('action')
  if (action && (action !== 'photos' || categoryKey || req.method !== 'GET')) return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  if (!action && (categoryKey ? !['DELETE', 'PATCH'].includes(req.method ?? '') : !['GET', 'POST'].includes(req.method ?? ''))) return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  try {
    if (!categoryKey && !action && req.method === 'GET') {
      const categories = await prisma.category.findMany({ orderBy: { label: 'asc' } })
      return res.status(200).json({ ok: true, categories: categories.map(categoryDto) })
    }
    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) return res.status(statusForProfileError(error)).json({ ok: false, error })
    if (!hasPermission(profile, 'categories.manage')) return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    if (action === 'photos') {
      const query = z.string().trim().min(2).max(100).safeParse(param('q'))
      if (!query.success) return res.status(400).json({ ok: false, error: 'INVALID_PHOTO_QUERY' })
      const photos = (await searchCategoryPhotos(query.data)).map(({ unsplashDownloadLocation: _, ...photo }) => photo)
      return res.status(200).json({ ok: true, photos })
    }
    if (req.method === 'DELETE' && categoryKey) {
      if (await prisma.item.count({ where: { category: { key: categoryKey } } }) > 0) return res.status(409).json({ ok: false, error: 'CATEGORY_IN_USE' })
      await prisma.category.delete({ where: { key: categoryKey } })
      return res.status(200).json({ ok: true })
    }
    const parsed = (categoryKey ? updateCategorySchema : createCategorySchema).safeParse(req.body ?? {})
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID_CATEGORY' })
    const { unsplashPhotoId, imagenAlt, imagenUrl, ...data } = parsed.data
    if (imagenUrl && unsplashPhotoId) return res.status(400).json({ ok: false, error: 'INVALID_CATEGORY' })
    // categories.manage is sufficient for selecting unsplash photo
    const existing = categoryKey ? await prisma.category.findUnique({ where: { key: categoryKey } }) : null
    if (categoryKey && !existing) return res.status(404).json({ ok: false, error: 'CATEGORY_NOT_FOUND' })
    let photoData: Partial<PhotoFields> = {}
    // Imagen propia/enlace externo: se limpian metadatos de Unsplash para no atribuirla a otro fotógrafo.
    if (imagenUrl) photoData = { ...emptyCategoryPhoto, imagenUrl, imagenAlt: imagenAlt ?? null }
    else if (imagenUrl === null && unsplashPhotoId === undefined) photoData = { ...emptyCategoryPhoto }
    else if (unsplashPhotoId === null) photoData = { ...emptyCategoryPhoto }
    else if (unsplashPhotoId && unsplashPhotoId !== existing?.unsplashPhotoId) {
      photoData = { ...categoryPhotoData(await unsplashRequest(`https://api.unsplash.com/photos/${unsplashPhotoId}`)), unsplashDownloadTrackedAt: null }
    }
    if (!imagenUrl && imagenAlt !== undefined && (unsplashPhotoId || existing?.imagenUrl)) photoData.imagenAlt = imagenAlt
    const saved = categoryKey
      ? await prisma.category.update({ where: { key: categoryKey }, data: { ...data, ...photoData } })
      : await prisma.category.create({ data: { ...data, key: 'key' in data ? String(data.key) : '', label: data.label!, ...photoData } })
    // Save first: retries keep the selected photo rather than downloading again after a DB error.
    if (saved.unsplashDownloadLocation && !saved.unsplashDownloadTrackedAt) {
      await unsplashRequest(saved.unsplashDownloadLocation)
      await prisma.category.update({ where: { id: saved.id }, data: { unsplashDownloadTrackedAt: new Date() } })
    }
    return res.status(categoryKey ? 200 : 201).json({ ok: true, category: categoryDto(saved) })
  } catch (error) {
    if (error instanceof UnsplashError) return res.status(error.status).json({ ok: false, error: error.code })
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null
    if (code === 'P2002') return res.status(409).json({ ok: false, error: 'CATEGORY_ALREADY_EXISTS' })
    if (code === 'P2025') return res.status(404).json({ ok: false, error: 'CATEGORY_NOT_FOUND' })
    if (code === 'P2003') return res.status(409).json({ ok: false, error: 'CATEGORY_IN_USE' })
    console.error('Categories API failed')
    return res.status(500).json({ ok: false, error: 'CATEGORIES_API_FAILED' })
  }
}
