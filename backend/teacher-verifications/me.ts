import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../_lib/prisma.js'
import {
  getAuthenticatedUser,
  extractBearerToken,
  createAuthenticatedSupabaseClient,
  type ApiRequest,
  type ApiResponse,
} from '../_lib/auth.js'

const submitSchema = z.object({
  schoolId: z.string().uuid(),
  department: z.string().trim().max(120).nullable().optional(),
  careerId: z.string().uuid().nullable().optional(),
  documentPath: z.string().trim().min(3).max(255),
  expectedVersion: z.number().int().min(1).optional(),
})

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  const authentication = await getAuthenticatedUser(req)
  if (!authentication.user) {
    const status = authentication.error === 'AUTH_NOT_CONFIGURED' ? 500 : 401
    return res.status(status).json({ ok: false, error: authentication.error })
  }

  const user = await prisma.user.findUnique({
    where: { authUserId: authentication.user.id },
    select: { id: true, authUserId: true, isActive: true },
  })

  if (!user || !user.isActive) {
    return res.status(403).json({ ok: false, error: 'ACCOUNT_DISABLED' })
  }

  const token = extractBearerToken(req)

  if (req.method === 'GET') {
    const verification = await prisma.teacherVerification.findUnique({
      where: { userId: user.id },
      include: {
        school: { select: { id: true, name: true } },
        career: { select: { id: true, name: true } },
        decisions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { admin: { select: { firstName: true, lastName: true } } },
        },
      },
    })

    if (!verification) {
      return res.status(200).json({ ok: true, verification: null })
    }

    let signedUrl: string | null = null
    if (verification.documentPath && token) {
      try {
        const client = createAuthenticatedSupabaseClient(token)
        const { data } = await client.storage.from('teacher-credentials').createSignedUrl(verification.documentPath, 300)
        signedUrl = data?.signedUrl ?? null
      } catch {
        signedUrl = null
      }
    }

    return res.status(200).json({
      ok: true,
      verification: {
        id: verification.id,
        status: verification.status,
        version: verification.version,
        submittedVersion: verification.submittedVersion,
        schoolId: verification.schoolId,
        schoolName: verification.school.name,
        department: verification.department,
        careerId: verification.careerId,
        careerName: verification.career?.name ?? null,
        documentPath: verification.documentPath,
        signedUrl,
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

  // POST: submit or re-submit
  const parsed = submitSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'INVALID_PAYLOAD', details: parsed.error.issues })
  }

  const { schoolId, department, careerId, documentPath, expectedVersion } = parsed.data

  // Verify school exists
  const school = await prisma.school.findUnique({ where: { id: schoolId } })
  if (!school) {
    return res.status(400).json({ ok: false, error: 'SCHOOL_NOT_FOUND' })
  }

  // If careerId provided, verify it belongs to schoolId
  if (careerId) {
    const career = await prisma.career.findUnique({ where: { id: careerId } })
    if (!career) {
      return res.status(400).json({ ok: false, error: 'CAREER_NOT_FOUND' })
    }
    if (career.schoolId !== schoolId) {
      return res.status(400).json({ ok: false, error: 'CAREER_SCHOOL_MISMATCH' })
    }
  }

  // Document path security: must belong to the user's folder and have no traversal
  if (documentPath.includes('..') || !documentPath.startsWith(`${authentication.user.id}/`)) {
    return res.status(400).json({ ok: false, error: 'INVALID_DOCUMENT_PATH' })
  }

  // Real existence and content verification in Supabase Storage
  try {
    const client = createAuthenticatedSupabaseClient(token ?? undefined)
    const { data: fileData, error: fileError } = await client.storage
      .from('teacher-credentials')
      .download(documentPath)

    if (fileError || !fileData) {
      return res.status(400).json({
        ok: false,
        error: 'CREDENTIAL_DOCUMENT_NOT_FOUND',
        message: 'El archivo de credencial no fue encontrado en el almacenamiento.',
      })
    }

    const arrayBuf = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuf)

    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({
        ok: false,
        error: 'FILE_TOO_LARGE',
        message: 'El archivo debe pesar entre 1 byte y 5 MB.',
      })
    }

    // Inspect magic bytes for image type detection
    let detectedMime: string | null = null
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      detectedMime = 'image/jpeg'
    } else if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      detectedMime = 'image/png'
    } else if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      detectedMime = 'image/webp'
    }

    if (!detectedMime) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_IMAGE_CONTENT',
        message: 'El archivo subido no corresponde a un formato de imagen permitido (JPEG, PNG o WebP).',
      })
    }

    const documentSha256 = crypto.createHash('sha256').update(buffer).digest('hex')

    // Atomic CAS and transaction for submission
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.teacherVerification.findUnique({
        where: { userId: user.id },
      })

      if (current) {
        if (current.status === 'PENDING') {
          return { error: 'ALREADY_PENDING' as const }
        }
        if (current.status === 'APPROVED') {
          return { error: 'ALREADY_APPROVED' as const }
        }
        if (expectedVersion !== undefined && current.version !== expectedVersion) {
          return { error: 'CONCURRENCY_CONFLICT' as const, currentVersion: current.version }
        }

        const latestSubmission = await tx.teacherCredentialSubmission.findFirst({
          where: { verificationId: current.id },
          orderBy: { version: 'desc' },
        })
        const nextSubmissionVersion = (latestSubmission?.version ?? 0) + 1
        const nextRevisionVersion = current.version + 1

        const casUpdate = await tx.teacherVerification.updateMany({
          where: {
            id: current.id,
            version: current.version,
            status: { notIn: ['PENDING', 'APPROVED'] },
          },
          data: {
            schoolId,
            department: department || null,
            careerId: careerId || null,
            documentPath,
            status: 'PENDING',
            version: nextRevisionVersion,
            submittedVersion: nextSubmissionVersion,
            rejectionReason: null,
          },
        })

        if (casUpdate.count === 0) {
          return { error: 'CONCURRENCY_CONFLICT' as const, currentVersion: current.version }
        }

        await tx.teacherCredentialSubmission.upsert({
          where: {
            verificationId_version: {
              verificationId: current.id,
              version: nextSubmissionVersion,
            },
          },
          create: {
            verificationId: current.id,
            version: nextSubmissionVersion,
            schoolId,
            department: department || null,
            careerId: careerId || null,
            documentPath,
            documentMime: detectedMime,
            documentBytes: buffer.length,
            documentSha256,
          },
          update: {
            schoolId,
            department: department || null,
            careerId: careerId || null,
            documentPath,
            documentMime: detectedMime,
            documentBytes: buffer.length,
            documentSha256,
            submittedAt: new Date(),
          },
        })

        const updated = await tx.teacherVerification.findUniqueOrThrow({
          where: { id: current.id },
          include: {
            school: { select: { id: true, name: true } },
            career: { select: { id: true, name: true } },
          },
        })

        return { ok: true as const, verification: updated }
      }

      // New teacher verification record
      const created = await tx.teacherVerification.create({
        data: {
          userId: user.id,
          schoolId,
          department: department || null,
          careerId: careerId || null,
          documentPath,
          status: 'PENDING',
          version: 1,
          submittedVersion: 1,
        },
      })

      await tx.teacherCredentialSubmission.upsert({
        where: {
          verificationId_version: {
            verificationId: created.id,
            version: 1,
          },
        },
        create: {
          verificationId: created.id,
          version: 1,
          schoolId,
          department: department || null,
          careerId: careerId || null,
          documentPath,
          documentMime: detectedMime,
          documentBytes: buffer.length,
          documentSha256,
        },
        update: {
          schoolId,
          department: department || null,
          careerId: careerId || null,
          documentPath,
          documentMime: detectedMime,
          documentBytes: buffer.length,
          documentSha256,
          submittedAt: new Date(),
        },
      })

      const loaded = await tx.teacherVerification.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          school: { select: { id: true, name: true } },
          career: { select: { id: true, name: true } },
        },
      })

      return { ok: true as const, verification: loaded }
    })

    if ('error' in result) {
      if (result.error === 'ALREADY_PENDING') {
        return res.status(409).json({ ok: false, error: 'ALREADY_PENDING' })
      }
      if (result.error === 'ALREADY_APPROVED') {
        return res.status(409).json({ ok: false, error: 'ALREADY_APPROVED' })
      }
      if (result.error === 'CONCURRENCY_CONFLICT') {
        return res.status(409).json({
          ok: false,
          error: 'CONCURRENCY_CONFLICT',
          message: 'La postulación fue modificada concurrentemente.',
          currentVersion: result.currentVersion,
        })
      }
    }

    const { verification } = result
    return res.status(200).json({
      ok: true,
      verification: {
        id: verification.id,
        status: verification.status,
        version: verification.version,
        submittedVersion: verification.submittedVersion,
        schoolId: verification.schoolId,
        schoolName: verification.school.name,
        department: verification.department,
        careerId: verification.careerId,
        careerName: verification.career?.name ?? null,
        documentPath: verification.documentPath,
        createdAt: verification.createdAt.toISOString(),
        updatedAt: verification.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error during teacher verification submission:', error)
    return res.status(500).json({ ok: false, error: 'SUBMISSION_FAILED', details: error instanceof Error ? error.message : String(error) })
  }
}
