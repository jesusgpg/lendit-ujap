import { z } from 'zod'
import { prisma } from '../../../_lib/prisma.js'
import {
  getAuthenticatedProfile,
  hasPermission,
  statusForProfileError,
  type ApiRequest,
  type ApiResponse,
} from '../../../_lib/auth.js'

const decisionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_CORRECTION']),
  reason: z.string().trim().max(1000).optional(),
  expectedVersion: z.number().int().min(1),
})

export default async function handler(
  req: ApiRequest & { query?: { id?: string } },
  res: ApiResponse,
) {
  if (req.method !== 'POST') {
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

  const parsed = decisionSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'INVALID_PAYLOAD', details: parsed.error.issues })
  }

  const { action, reason, expectedVersion } = parsed.data

  if (action !== 'APPROVE' && (!reason || reason.trim().length < 5)) {
    return res.status(400).json({
      ok: false,
      error: 'REASON_REQUIRED',
      message: 'Se requiere un motivo explicativo de al menos 5 caracteres para rechazar o solicitar corrección.',
    })
  }

  const professorRole = await prisma.role.findUnique({ where: { name: 'PROFESSOR' } })
  const studentRole = await prisma.role.findUnique({ where: { name: 'STUDENT' } })

  if (!professorRole || !studentRole) {
    return res.status(500).json({ ok: false, error: 'ROLE_SEED_MISSING' })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const verification = await tx.teacherVerification.findUnique({
        where: { id },
        include: { user: { select: { id: true, roleId: true } } },
      })

      if (!verification) {
        return { error: 'NOT_FOUND' as const }
      }

      // Optimistic concurrency control
      if (verification.version !== expectedVersion) {
        return { error: 'CONCURRENCY_CONFLICT' as const, currentVersion: verification.version }
      }

      const nextVersion = verification.version + 1

      if (action === 'APPROVE') {
        const updateCas = await tx.teacherVerification.updateMany({
          where: { id: verification.id, version: expectedVersion },
          data: {
            status: 'APPROVED',
            version: nextVersion,
            rejectionReason: null,
          },
        })

        if (updateCas.count === 0) {
          return { error: 'CONCURRENCY_CONFLICT' as const, currentVersion: verification.version }
        }

        // Record the audit decision
        await tx.teacherVerificationDecision.create({
          data: {
            verificationId: verification.id,
            adminId: profile.id,
            action,
            reason: reason || null,
            version: verification.version,
          },
        })

        // Atomically upgrade user role to PROFESSOR and sync academic fields
        await tx.user.update({
          where: { id: verification.userId },
          data: {
            roleId: professorRole.id,
            schoolId: verification.schoolId,
            department: verification.department,
            careerId: verification.careerId,
          },
        })

        return { ok: true as const, status: 'APPROVED' as const, version: nextVersion }
      }

      // REJECT or REQUEST_CORRECTION
      const targetStatus = action === 'REJECT' ? 'REJECTED' : 'NEEDS_CORRECTION'
      const updateCas = await tx.teacherVerification.updateMany({
        where: { id: verification.id, version: expectedVersion },
        data: {
          status: targetStatus,
          version: nextVersion,
          rejectionReason: reason || null,
        },
      })

      if (updateCas.count === 0) {
        return { error: 'CONCURRENCY_CONFLICT' as const, currentVersion: verification.version }
      }

      // Record the audit decision
      await tx.teacherVerificationDecision.create({
        data: {
          verificationId: verification.id,
          adminId: profile.id,
          action,
          reason: reason || null,
          version: verification.version,
        },
      })

      // If user had PROFESSOR role, demote back to base STUDENT role atomically
      if (verification.user.roleId === professorRole.id) {
        await tx.user.update({
          where: { id: verification.userId },
          data: { roleId: studentRole.id },
        })
      }

      return { ok: true as const, status: targetStatus, version: nextVersion }
    })

    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        return res.status(404).json({ ok: false, error: 'NOT_FOUND' })
      }
      if (result.error === 'CONCURRENCY_CONFLICT') {
        return res.status(409).json({
          ok: false,
          error: 'CONCURRENCY_CONFLICT',
          message: 'La solicitud ha sido modificada por otro usuario o dictamen.',
          currentVersion: result.currentVersion,
        })
      }
    }

    return res.status(200).json({ ok: true, status: result.status, version: result.version })
  } catch (err) {
    console.error('Teacher verification decision error:', err)
    return res.status(500).json({ ok: false, error: 'DECISION_FAILED' })
  }
}
