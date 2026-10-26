import {
  getAuthenticatedUser,
  extractBearerToken,
  createAuthenticatedSupabaseClient,
  type ApiRequest,
  type ApiResponse,
} from '../../_lib/auth.js'
import { prisma } from '../../_lib/prisma.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  const authentication = await getAuthenticatedUser(req)
  if (!authentication.user) {
    const status = authentication.error === 'AUTH_NOT_CONFIGURED' ? 500 : 401
    return res.status(status).json({ ok: false, error: authentication.error })
  }

  const user = await prisma.user.findUnique({
    where: { authUserId: authentication.user.id },
    select: { id: true, isActive: true },
  })

  if (!user || !user.isActive) {
    return res.status(403).json({ ok: false, error: 'ACCOUNT_DISABLED' })
  }

  const verification = await prisma.teacherVerification.findUnique({
    where: { userId: user.id },
    select: { documentPath: true },
  })

  if (!verification || !verification.documentPath) {
    return res.status(404).json({ ok: false, error: 'DOCUMENT_NOT_FOUND' })
  }

  const token = extractBearerToken(req)
  if (!token) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
  }

  try {
    const client = createAuthenticatedSupabaseClient(token)
    const { data, error } = await client.storage
      .from('teacher-credentials')
      .createSignedUrl(verification.documentPath, 300)

    if (error || !data?.signedUrl) {
      return res.status(500).json({ ok: false, error: 'SIGNED_URL_FAILED' })
    }

    return res.status(200).json({ ok: true, signedUrl: data.signedUrl })
  } catch {
    return res.status(500).json({ ok: false, error: 'STORAGE_CLIENT_FAILED' })
  }
}
