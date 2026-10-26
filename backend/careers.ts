import { z } from 'zod'
import { prisma } from './_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from './_lib/auth.js'

const createCareerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  schoolId: z.string().uuid().nullable().optional(),
  imagenUrl: z.string().url().startsWith('https://').max(255).optional().nullable(),
  imagenAlt: z.string().trim().max(255).optional().nullable(),
})

const updateCareerSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  schoolId: z.string().uuid().nullable().optional(),
  imagenUrl: z.string().url().startsWith('https://').max(255).nullable().optional(),
  imagenAlt: z.string().trim().max(255).nullable().optional(),
})

function serializeCareer(career: { id: string; name: string; school: { id: string; name: string } | null; imagenUrl?: string | null; imagenAlt?: string | null }) {
  return { id: career.id, name: career.name, school: career.school, imagenUrl: career.imagenUrl ?? null, imagenAlt: career.imagenAlt ?? null }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id
  const isDetailRequest = Boolean(id)

  if (
    (isDetailRequest && req.method !== 'DELETE' && req.method !== 'PATCH') ||
    (!isDetailRequest && req.method !== 'GET' && req.method !== 'POST')
  ) {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  try {
    if (isDetailRequest) {
      const { profile, error } = await getAuthenticatedProfile(req)
      if (!profile) {
        return res.status(statusForProfileError(error)).json({ ok: false, error })
      }
      if (!hasPermission(profile, 'careers.manage')) {
        return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
      }

      if (req.method === 'PATCH') {
        const parsed = updateCareerSchema.safeParse(req.body ?? {})
        if (!parsed.success) {
          return res.status(400).json({ ok: false, error: 'INVALID_CAREER_UPDATE' })
        }

        if (Object.keys(parsed.data).length === 0) {
          return res.status(400).json({ ok: false, error: 'EMPTY_UPDATE' })
        }
        const data = { ...parsed.data }
        if (data.imagenUrl === null) data.imagenAlt = null
        const updated = await prisma.career.update({
          where: { id },
          data,
          include: { school: { select: { id: true, name: true } } },
        })
        return res.status(200).json({ ok: true, career: serializeCareer(updated) })
      }

      const usersInCareer = await prisma.user.count({ where: { careerId: id } })
      if (usersInCareer > 0) {
        return res.status(409).json({ ok: false, error: 'CAREER_IN_USE' })
      }

      await prisma.career.delete({ where: { id } })
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'GET') {
      const careers = await prisma.career.findMany({
        orderBy: { name: 'asc' },
        include: { school: { select: { id: true, name: true } } },
      })
      return res.status(200).json({ ok: true, careers: careers.map(serializeCareer) })
    }

    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) {
      return res.status(statusForProfileError(error)).json({ ok: false, error })
    }
    if (!hasPermission(profile, 'careers.manage')) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    const parsed = createCareerSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'INVALID_CAREER' })
    }

    const career = await prisma.career.create({
      data: {
        name: parsed.data.name,
        schoolId: parsed.data.schoolId ?? null,
        imagenUrl: parsed.data.imagenUrl ?? null,
        imagenAlt: parsed.data.imagenUrl ? (parsed.data.imagenAlt ?? null) : null,
      },
      include: { school: { select: { id: true, name: true } } },
    })
    return res.status(201).json({ ok: true, career: serializeCareer(career) })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return res.status(409).json({ ok: false, error: 'CAREER_ALREADY_EXISTS' })
    }
    const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : null
    if (code === 'P2002') return res.status(409).json({ ok: false, error: 'CAREER_ALREADY_EXISTS' })
    if (code === 'P2025') return res.status(404).json({ ok: false, error: 'CAREER_NOT_FOUND' })
    if (code === 'P2003') return res.status(409).json({ ok: false, error: 'CAREER_IN_USE' })
    console.error('Careers API failed', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'CAREERS_API_FAILED' })
  }
}
