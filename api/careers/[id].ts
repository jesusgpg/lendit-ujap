import { z } from 'zod'
import { prisma } from '../_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from '../_lib/auth.js'

const updateCareerSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  schoolId: z.string().uuid().nullable().optional(),
})

export default async function handler(req: ApiRequest & { query?: { id?: string } }, res: ApiResponse) {
  if (req.method !== 'DELETE' && req.method !== 'PATCH') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  const id = req.query?.id
  if (!id) {
    return res.status(400).json({ ok: false, error: 'MISSING_CAREER_ID' })
  }

  try {
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

      const updated = await prisma.career.update({
        where: { id },
        data: parsed.data,
        include: { school: { select: { id: true, name: true } } },
      })
      return res.status(200).json({ ok: true, career: updated })
    }

    const usersInCareer = await prisma.user.count({ where: { careerId: id } })
    if (usersInCareer > 0) {
      return res.status(409).json({ ok: false, error: 'CAREER_IN_USE' })
    }

    await prisma.career.delete({ where: { id } })
    return res.status(200).json({ ok: true })
  } catch (careerError) {
    console.error('Career update/delete failed', careerError instanceof Error ? careerError.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'CAREER_OPERATION_FAILED' })
  }
}
