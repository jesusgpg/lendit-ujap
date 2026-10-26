import { z } from 'zod'
import { prisma } from './_lib/prisma.js'
import {
  getAuthenticatedUser,
  hasPermission,
  getAuthenticatedProfile,
  isAdministrativeRole,
  isInstitutionalEmail,
  type ApiRequest,
  type ApiResponse,
} from './_lib/auth.js'

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(7).max(30),
  photoUrl: z.string().url().nullable().optional(),
  schoolId: z.string().uuid().nullable().optional(),
  department: z.string().trim().max(120).nullable().optional(),
  careerId: z.string().uuid().nullable().optional(),
})

const profilePatchSchema = profileSchema.partial()

function metadataValue(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' ? value : ''
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

type ProfileRecord = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  photoUrl: string | null
  schoolId: string | null
  department: string | null
  careerId: string | null
  emailVerifiedAt: Date | null
  role: { name: string; permissions: { permission: { key: string } }[] }
  career: { id: string; name: string } | null
  school: { id: string; name: string } | null
  teacherVerification: {
    id: string
    status: string
    version: number
    schoolId: string
    department: string | null
    careerId: string | null
    documentPath: string | null
    rejectionReason: string | null
    updatedAt: Date
    school: { id: string; name: string } | null
    career: { id: string; name: string } | null
  } | null
}

function serializeProfile(profile: ProfileRecord) {
  return {
    id: profile.id,
    name: `${profile.firstName} ${profile.lastName}`,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    career: profile.career?.name ?? '',
    careerId: profile.career?.id ?? null,
    school: profile.school?.name ?? '',
    schoolId: profile.school?.id ?? null,
    department: profile.department ?? null,
    phone: profile.phone,
    photo: profile.photoUrl ?? '',
    role: profile.role.name,
    permissions: profile.role.permissions.map((rp) => rp.permission.key),
    emailVerifiedAt: profile.emailVerifiedAt?.toISOString() ?? null,
    teacherVerification: profile.teacherVerification ? {
      id: profile.teacherVerification.id,
      status: profile.teacherVerification.status,
      version: profile.teacherVerification.version,
      schoolId: profile.teacherVerification.schoolId,
      schoolName: profile.teacherVerification.school?.name ?? '',
      department: profile.teacherVerification.department,
      careerId: profile.teacherVerification.careerId,
      careerName: profile.teacherVerification.career?.name ?? null,
      documentPath: profile.teacherVerification.documentPath,
      rejectionReason: profile.teacherVerification.rejectionReason,
      updatedAt: profile.teacherVerification.updatedAt.toISOString(),
    } : null,
  }
}

const profileInclude = {
  role: { select: { name: true, permissions: { select: { permission: { select: { key: true } } } } } },
  career: { select: { id: true, name: true } },
  school: { select: { id: true, name: true } },
  teacherVerification: {
    select: {
      id: true,
      status: true,
      version: true,
      schoolId: true,
      department: true,
      careerId: true,
      documentPath: true,
      rejectionReason: true,
      updatedAt: true,
      school: { select: { id: true, name: true } },
      career: { select: { id: true, name: true } },
    },
  },
} as const

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  const authentication = await getAuthenticatedUser(req)
  if (!authentication.user) {
    const status = authentication.error === 'AUTH_NOT_CONFIGURED' ? 500 : 401
    return res.status(status).json({ ok: false, error: authentication.error })
  }

  const authUser = authentication.user
  const email = authUser.email?.trim().toLowerCase()

  const existingProfile = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
    include: profileInclude,
  })

  const existingPermissions = existingProfile?.role.permissions.map(({ permission }) => permission.key) ?? []
  const canUseAdministrativeEmail = existingProfile
    ? isAdministrativeRole(existingProfile.role.name, existingPermissions)
    : false
  if (!email || (!isInstitutionalEmail(email) && !canUseAdministrativeEmail)) {
    return res.status(403).json({ ok: false, error: 'INSTITUTIONAL_EMAIL_REQUIRED' })
  }

  if (existingProfile && !existingProfile.isActive) {
    return res.status(403).json({ ok: false, error: 'ACCOUNT_DISABLED' })
  }

  if (req.method === 'GET') {
    if (!existingProfile) {
      return res.status(409).json({ ok: false, error: 'PROFILE_REQUIRED' })
    }
    return res.status(200).json({ ok: true, user: serializeProfile(existingProfile) })
  }

  // PATCH
  if (existingProfile) {
    const { profile } = await getAuthenticatedProfile(req)
    if (profile && !hasPermission(profile, 'profile.update')) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }
  }

  let metadataProfile: {
    firstName: string
    lastName: string
    careerId: string | null
    schoolId: string | null
    department: string | null
    phone: string
    photoUrl: string | null
  } | null = null
  let metadataRole = 'STUDENT'

  if (!existingProfile) {
    const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>
    metadataRole = metadataValue(metadata, 'role').toUpperCase() || 'STUDENT'
    const metadataCareerId = metadataValue(metadata, 'careerId')
    const metadataCareer = isUuid(metadataCareerId)
      ? await prisma.career.findUnique({ where: { id: metadataCareerId } })
      : await prisma.career.findFirst({ where: { name: metadataValue(metadata, 'career') || undefined } })

    const metadataSchoolId = metadataValue(metadata, 'schoolId')
    const metadataSchool = isUuid(metadataSchoolId)
      ? await prisma.school.findUnique({ where: { id: metadataSchoolId } })
      : null

    if (metadataCareer && metadataSchool && metadataCareer.schoolId !== metadataSchool.id) {
      return res.status(400).json({ ok: false, error: 'CAREER_SCHOOL_MISMATCH' })
    }

    metadataProfile = {
      firstName: metadataValue(metadata, 'firstName'),
      lastName: metadataValue(metadata, 'lastName'),
      careerId: metadataCareer?.id ?? null,
      schoolId: metadataSchool?.id ?? metadataCareer?.schoolId ?? null,
      department: metadataValue(metadata, 'department') || null,
      phone: metadataValue(metadata, 'phone'),
      photoUrl: metadataValue(metadata, 'photoUrl') || null,
    }
  }

  const parsedPatch = profilePatchSchema.safeParse(req.body ?? {})
  if (!parsedPatch.success) {
    return res.status(400).json({ ok: false, error: 'INVALID_PROFILE' })
  }

  const currentProfile = existingProfile
    ? {
        firstName: existingProfile.firstName,
        lastName: existingProfile.lastName,
        careerId: existingProfile.careerId,
        schoolId: existingProfile.schoolId,
        department: existingProfile.department,
        phone: existingProfile.phone,
        photoUrl: existingProfile.photoUrl,
      }
    : metadataProfile!

  const parsedProfile = profileSchema.safeParse({ ...currentProfile, ...parsedPatch.data })
  if (!parsedProfile.success) {
    return res.status(422).json({ ok: false, error: 'PROFILE_INCOMPLETE' })
  }

  const profileData = parsedProfile.data
  const userRole = existingProfile
    ? existingProfile.role.name
    : metadataRole === 'PROFESSOR'
      ? 'PROFESSOR'
      : 'STUDENT'

  let resolvedCareer = null
  if (profileData.careerId) {
    resolvedCareer = await prisma.career.findUnique({
      where: { id: profileData.careerId },
      include: { school: true },
    })
    if (!resolvedCareer) {
      return res.status(400).json({ ok: false, error: 'CAREER_NOT_FOUND' })
    }
  }

  if (profileData.schoolId) {
    const schoolExists = await prisma.school.findUnique({ where: { id: profileData.schoolId } })
    if (!schoolExists) {
      return res.status(400).json({ ok: false, error: 'SCHOOL_NOT_FOUND' })
    }
  }

  if (resolvedCareer && profileData.schoolId && resolvedCareer.schoolId !== profileData.schoolId) {
    return res.status(400).json({ ok: false, error: 'CAREER_SCHOOL_MISMATCH' })
  }

  if (userRole === 'STUDENT') {
    if (!profileData.careerId || !resolvedCareer) {
      return res.status(422).json({ ok: false, error: 'CAREER_REQUIRED_FOR_STUDENT' })
    }
    profileData.schoolId = resolvedCareer.schoolId
  } else if (userRole === 'PROFESSOR') {
    if (!profileData.schoolId) {
      return res.status(422).json({ ok: false, error: 'SCHOOL_REQUIRED_FOR_PROFESSOR' })
    }
  }

  if (existingProfile) {
    const studentRole = await prisma.role.findUnique({ where: { name: 'STUDENT' } })
    const academicChanged = userRole === 'PROFESSOR' && (
      profileData.schoolId !== existingProfile.schoolId ||
      (profileData.department ?? null) !== (existingProfile.department ?? null)
    )

    let updateData: Record<string, unknown> = { ...profileData }

    if (academicChanged && studentRole && existingProfile.teacherVerification) {
      updateData = {
        ...updateData,
        roleId: studentRole.id,
      }
      await prisma.$transaction([
        prisma.user.update({
          where: { id: existingProfile.id },
          data: updateData,
        }),
        prisma.teacherVerification.update({
          where: { id: existingProfile.teacherVerification.id },
          data: {
            schoolId: profileData.schoolId!,
            department: profileData.department,
            careerId: profileData.careerId ?? null,
            status: 'NEEDS_CORRECTION',
            rejectionReason: 'Datos académicos modificados. Se requiere nueva validación administrativa.',
            version: { increment: 1 },
          },
        }),
        prisma.teacherVerificationDecision.create({
          data: {
            verificationId: existingProfile.teacherVerification.id,
            adminId: existingProfile.id,
            action: 'REQUEST_CORRECTION',
            reason: 'Datos académicos modificados por el usuario en perfil.',
            version: existingProfile.teacherVerification.version,
          },
        }),
      ])

      const refreshed = await prisma.user.findUnique({
        where: { id: existingProfile.id },
        include: profileInclude,
      })
      return res.status(200).json({ ok: true, user: serializeProfile(refreshed!) })
    }

    const updated = await prisma.user.update({
      where: { id: existingProfile.id },
      data: updateData,
      include: profileInclude,
    })
    return res.status(200).json({ ok: true, user: serializeProfile(updated) })
  }

  // Red de seguridad: si el trigger de alta no llegó a crear el perfil, lo creamos aquí como STUDENT.
  const studentRole = await prisma.role.findUnique({ where: { name: 'STUDENT' } })
  if (!studentRole) {
    return res.status(500).json({ ok: false, error: 'ROLE_SEED_MISSING' })
  }

  const created = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        authUserId: authUser.id,
        email,
        roleId: studentRole.id,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone,
        photoUrl: profileData.photoUrl ?? null,
        schoolId: profileData.schoolId ?? null,
        department: profileData.department ?? null,
        careerId: profileData.careerId ?? null,
        emailVerifiedAt: authUser.email_confirmed_at ? new Date(authUser.email_confirmed_at) : null,
      },
    })

    if (userRole === 'PROFESSOR') {
      await tx.teacherVerification.create({
        data: {
          userId: newUser.id,
          schoolId: profileData.schoolId!,
          department: profileData.department ?? null,
          careerId: profileData.careerId ?? null,
          status: 'DRAFT',
          version: 1,
        },
      })
    }

    return tx.user.findUniqueOrThrow({
      where: { id: newUser.id },
      include: profileInclude,
    })
  })

  return res.status(200).json({ ok: true, user: serializeProfile(created) })
}
