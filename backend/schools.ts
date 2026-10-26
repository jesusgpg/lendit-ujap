import { z } from 'zod'
import { prisma } from './_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from './_lib/auth.js'

const httpsUrl = z.string().trim().url().startsWith('https://').max(255)

const createSchoolSchema = z.object({
  name: z.string().trim().min(2).max(120),
  imagenUrl: httpsUrl.optional().nullable(),
  imagenAlt: z.string().trim().max(255).optional().nullable(),
})

const updateSchoolSchema = createSchoolSchema.partial()

function serializeSchool(s: { id: string; name: string; imagenUrl?: string | null; imagenAlt?: string | null; _count?: { careers: number } }) {
  return {
    id: s.id,
    name: s.name,
    imagenUrl: s.imagenUrl ?? null,
    imagenAlt: s.imagenAlt ?? null,
    careerCount: s._count?.careers ?? 0,
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id
  const isDetail = Boolean(id)

  if (
    (isDetail && req.method !== 'PATCH' && req.method !== 'DELETE') ||
    (!isDetail && req.method !== 'GET' && req.method !== 'POST')
  ) {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  try {
    if (!isDetail && req.method === 'GET') {
      const schools = await prisma.school.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { careers: true } } },
      })
      return res.status(200).json({ ok: true, schools: schools.map(serializeSchool) })
    }

    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) {
      return res.status(statusForProfileError(error)).json({ ok: false, error })
    }
    if (!hasPermission(profile, 'careers.manage')) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    if (!isDetail) {
      const parsed = createSchoolSchema.safeParse(req.body ?? {})
      if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID_SCHOOL' })
      const school = await prisma.school.create({
        data: {
          name: parsed.data.name,
          imagenUrl: parsed.data.imagenUrl ?? null,
          imagenAlt: parsed.data.imagenUrl ? (parsed.data.imagenAlt ?? null) : null,
        },
        include: { _count: { select: { careers: true } } },
      })
      return res.status(201).json({ ok: true, school: serializeSchool(school) })
    }

    if (!z.string().uuid().safeParse(id).success) {
      return res.status(400).json({ ok: false, error: 'INVALID_SCHOOL_ID' })
    }

    if (req.method === 'PATCH') {
      const parsed = updateSchoolSchema.safeParse(req.body ?? {})
      if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID_SCHOOL' })
      if (Object.keys(parsed.data).length === 0) return res.status(400).json({ ok: false, error: 'EMPTY_UPDATE' })
      const data = { ...parsed.data }
      if (data.imagenUrl === null) data.imagenAlt = null
      const school = await prisma.school.update({
        where: { id },
        data,
        include: { _count: { select: { careers: true } } },
      })
      return res.status(200).json({ ok: true, school: serializeSchool(school) })
    }

    // DELETE: never cascade nor silently detach careers.
    if ((await prisma.career.count({ where: { schoolId: id } })) > 0) {
      return res.status(409).json({ ok: false, error: 'SCHOOL_IN_USE' })
    }
    await prisma.school.delete({ where: { id } })
    return res.status(200).json({ ok: true })
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : null
    if (code === 'P2002') return res.status(409).json({ ok: false, error: 'SCHOOL_ALREADY_EXISTS' })
    if (code === 'P2025') return res.status(404).json({ ok: false, error: 'SCHOOL_NOT_FOUND' })
    if (code === 'P2003') return res.status(409).json({ ok: false, error: 'SCHOOL_IN_USE' })
    console.error('Schools API failed')
    return res.status(500).json({ ok: false, error: 'SCHOOLS_API_FAILED' })
  }
}
