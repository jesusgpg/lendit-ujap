import { z } from 'zod'
import { prisma } from './_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from './_lib/auth.js'

const createSchoolSchema = z.object({
  name: z.string().trim().min(2).max(120),
})

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  try {
    if (req.method === 'GET') {
      const schools = await prisma.school.findMany({ orderBy: { name: 'asc' } })
      return res.status(200).json({ ok: true, schools: schools.map((s) => ({ id: s.id, name: s.name })) })
    }

    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) {
      return res.status(statusForProfileError(error)).json({ ok: false, error })
    }
    if (!hasPermission(profile, 'careers.manage')) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    const parsed = createSchoolSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'INVALID_SCHOOL' })
    }

    const school = await prisma.school.create({ data: parsed.data })
    return res.status(201).json({ ok: true, school })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return res.status(409).json({ ok: false, error: 'SCHOOL_ALREADY_EXISTS' })
    }
    console.error('Schools API failed', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'SCHOOLS_API_FAILED' })
  }
}
