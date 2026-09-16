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
  careerId: z.string().uuid(),
  phone: z.string().trim().min(7).max(30),
  photoUrl: z.string().url().nullable().optional(),
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
  emailVerifiedAt: Date | null
  role: { name: string; permissions: { permission: { key: string } }[] }
  career: { id: string; name: string }
}

function serializeProfile(profile: ProfileRecord) {
  return {
    id: profile.id,
    name: `${profile.firstName} ${profile.lastName}`,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    career: profile.career.name,
    careerId: profile.career.id,
    phone: profile.phone,
    photo: profile.photoUrl ?? '',
    role: profile.role.name,
    permissions: profile.role.permissions.map((rp) => rp.permission.key),
    emailVerifiedAt: profile.emailVerifiedAt?.toISOString() ?? null,
  }
}

const profileInclude = {
  role: { select: { name: true, permissions: { select: { permission: { select: { key: true } } } } } },
  career: { select: { id: true, name: true } },
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

  const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>
  const defaultCareer = await prisma.career.findFirst({ orderBy: { name: 'asc' } })
  const metadataCareerId = metadataValue(metadata, 'careerId')
  const metadataCareer = isUuid(metadataCareerId)
    ? await prisma.career.findUnique({ where: { id: metadataCareerId } })
    : await prisma.career.findFirst({ where: { name: metadataValue(metadata, 'career') || undefined } })

  const metadataProfile = {
    firstName: metadataValue(metadata, 'firstName'),
    lastName: metadataValue(metadata, 'lastName'),
    careerId: (metadataCareer ?? defaultCareer)?.id ?? '',
    phone: metadataValue(metadata, 'phone'),
    photoUrl: metadataValue(metadata, 'photoUrl') || null,
  }

  const parsedPatch = profilePatchSchema.safeParse(req.body ?? {})
  if (!parsedPatch.success) {
    return res.status(400).json({ ok: false, error: 'INVALID_PROFILE' })
  }

  const currentProfile = existingProfile
    ? {
        firstName: existingProfile.firstName,
        lastName: existingProfile.lastName,
        careerId: existingProfile.career.id,
        phone: existingProfile.phone,
        photoUrl: existingProfile.photoUrl,
      }
    : metadataProfile

  const parsedProfile = profileSchema.safeParse({ ...currentProfile, ...parsedPatch.data })
  if (!parsedProfile.success) {
    return res.status(422).json({ ok: false, error: 'PROFILE_INCOMPLETE' })
  }

  const profileData = parsedProfile.data

  if (existingProfile) {
    const updated = await prisma.user.update({
      where: { id: existingProfile.id },
      data: profileData,
      include: profileInclude,
    })
    return res.status(200).json({ ok: true, user: serializeProfile(updated) })
  }

  // Red de seguridad: si el trigger de alta no llegó a crear el perfil, lo creamos aquí como STUDENT.
  const studentRole = await prisma.role.findUnique({ where: { name: 'STUDENT' } })
  if (!studentRole) {
    return res.status(500).json({ ok: false, error: 'ROLE_SEED_MISSING' })
  }

  const created = await prisma.user.create({
    data: {
      authUserId: authUser.id,
      email,
      roleId: studentRole.id,
      ...profileData,
      emailVerifiedAt: authUser.email_confirmed_at ? new Date(authUser.email_confirmed_at) : null,
    },
    include: profileInclude,
  })

  return res.status(200).json({ ok: true, user: serializeProfile(created) })
}
