import { prisma } from './_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from './_lib/auth.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  try {
    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) {
      const status = statusForProfileError(error)
      return res.status(status).json({ ok: false, error })
    }
    if (!hasPermission(profile, 'roles.manage')) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    const permissions = await prisma.permission.findMany({ orderBy: { key: 'asc' } })
    return res.status(200).json({
      ok: true,
      permissions: permissions.map((p) => ({ key: p.key, description: p.description })),
    })
  } catch (permissionsError) {
    console.error(
      'Permissions API failed',
      permissionsError instanceof Error ? permissionsError.message : 'unknown error',
    )
    return res.status(500).json({ ok: false, error: 'PERMISSIONS_API_FAILED' })
  }
}
