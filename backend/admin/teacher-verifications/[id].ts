import { prisma } from '../../_lib/prisma.js'
import {
  getAuthenticatedProfile,
  hasPermission,
  statusForProfileError,
  extractBearerToken,
  createAuthenticatedSupabaseClient,
  type ApiRequest,
  type ApiResponse,
} from '../../_lib/auth.js'

export default async function handler(
  req: ApiRequest & { query?: { id?: string } },
  res: ApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  const { profile, error } = await getAuthenticatedProfile(req)
  if (!profile) {
    const status = statusForProfileError(error)
    return res.status(status).json({ ok: false, error })
  }

  if (!hasPermission(profile, 'teachers.review')) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  const id = req.query?.id
  if (!id) {
    return res.status(400).json({ ok: false, error: 'MISSING_ID' })
  }

  const verification = await prisma.teacherVerification.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          photoUrl: true,
          role: { select: { id: true, name: true } },
        },
      },
      school: { select: { id: true, name: true } },
      career: { select: { id: true, name: true } },
      submissions: {
        orderBy: { version: 'desc' },
        take: 10,
      },
      decisions: {
        orderBy: { createdAt: 'desc' },
        include: {
          admin: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })

  if (!verification) {
    return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
  }

  let signedUrl: string | null = null
  const token = extractBearerToken(req)
  const currentSubmission = verification.submissions.find((s) => s.version === (verification.submittedVersion ?? verification.version))
    ?? verification.submissions[0]
  const targetDocumentPath = currentSubmission?.documentPath ?? verification.documentPath

  if (targetDocumentPath && token) {
    try {
      const client = createAuthenticatedSupabaseClient(token)
      const { data } = await client.storage
        .from('teacher-credentials')
        .createSignedUrl(targetDocumentPath, 300)
      signedUrl = data?.signedUrl ?? null
    } catch {
      signedUrl = null
    }
  }

  return res.status(200).json({
    ok: true,
    verification: {
      id: verification.id,
      userId: verification.userId,
      user: {
        id: verification.user.id,
        name: `${verification.user.firstName} ${verification.user.lastName}`.trim(),
        email: verification.user.email,
        phone: verification.user.phone,
        photo: verification.user.photoUrl,
        currentRole: verification.user.role.name,
      },
      school: verification.school,
      career: verification.career,
      department: currentSubmission?.department ?? verification.department,
      documentPath: targetDocumentPath,
      signedUrl,
      status: verification.status,
      version: verification.version,
      submittedVersion: verification.submittedVersion,
      submission: currentSubmission ? {
        id: currentSubmission.id,
        version: currentSubmission.version,
        documentPath: currentSubmission.documentPath,
        documentMime: currentSubmission.documentMime,
        documentBytes: currentSubmission.documentBytes,
        documentSha256: currentSubmission.documentSha256,
        submittedAt: currentSubmission.submittedAt.toISOString(),
      } : null,
      rejectionReason: verification.rejectionReason,
      createdAt: verification.createdAt.toISOString(),
      updatedAt: verification.updatedAt.toISOString(),
      decisions: verification.decisions.map((d) => ({
        id: d.id,
        action: d.action,
        reason: d.reason,
        adminName: `${d.admin.firstName} ${d.admin.lastName}`.trim(),
        version: d.version,
        createdAt: d.createdAt.toISOString(),
      })),
    },
  })
}
