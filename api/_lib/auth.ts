import { createClient, type User } from '@supabase/supabase-js'
import { prisma } from './prisma.js'

export type ApiRequest = {
  method?: string
  headers?: Record<string, string | string[] | undefined>
  body?: unknown
  query?: Record<string, string | string[] | undefined>
}

export type ApiResponse = {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
}

let serverClient: ReturnType<typeof createClient> | null = null

function getServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are not configured')
  }

  if (!serverClient) {
    serverClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    })
  }

  return serverClient
}

function getAuthorizationHeader(req: ApiRequest): string | null {
  const header = req.headers?.authorization
  if (Array.isArray(header)) {
    return header[0] ?? null
  }
  return header ?? null
}

export async function getAuthenticatedUser(req: ApiRequest): Promise<
  | { user: User; error: null }
  | { user: null; error: 'UNAUTHORIZED' | 'AUTH_NOT_CONFIGURED' }
> {
  const authorization = getAuthorizationHeader(req)
  if (!authorization?.startsWith('Bearer ')) {
    return { user: null, error: 'UNAUTHORIZED' }
  }

  try {
    const token = authorization.slice('Bearer '.length).trim()
    const { data, error } = await getServerClient().auth.getUser(token)

    if (error || !data?.user) {
      return { user: null, error: 'UNAUTHORIZED' }
    }

    return { user: data.user, error: null }
  } catch (error) {
    if (error instanceof Error && error.message.includes('not configured')) {
      return { user: null, error: 'AUTH_NOT_CONFIGURED' }
    }
    return { user: null, error: 'UNAUTHORIZED' }
  }
}

export interface AuthenticatedProfile {
  id: string
  roleId: string
  roleName: string
  permissions: string[]
}

export function isInstitutionalEmail(email: string) {
  return /^[^\s@]+@ujap\.edu\.ve$/i.test(email.trim())
}

export function isAdministrativeRole(roleName: string, permissions: string[]) {
  return roleName === 'ADMIN' || permissions.includes('roles.manage')
}

// Perfil de LendIt (tabla User) asociado al usuario autenticado de Supabase, con su rol
// y el set de permisos resuelto (Role -> RolePermission -> Permission).
// authUserId es null hasta que el trigger de la migración cree el perfil (o api/me lo haga a mano).
export async function getAuthenticatedProfile(req: ApiRequest): Promise<
  | { profile: AuthenticatedProfile; error: null }
  | {
      profile: null
      error: 'UNAUTHORIZED' | 'AUTH_NOT_CONFIGURED' | 'PROFILE_REQUIRED' | 'ACCOUNT_DISABLED' | 'INSTITUTIONAL_EMAIL_REQUIRED'
    }
> {
  const authentication = await getAuthenticatedUser(req)
  if (!authentication.user) {
    return { profile: null, error: authentication.error }
  }

  const profile = await prisma.user.findUnique({
    where: { authUserId: authentication.user.id },
    select: {
      id: true,
      isActive: true,
      role: {
        select: {
          id: true,
          name: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  })

  if (!profile) {
    return { profile: null, error: 'PROFILE_REQUIRED' }
  }
  if (!profile.isActive) {
    return { profile: null, error: 'ACCOUNT_DISABLED' }
  }

  const email = authentication.user.email?.trim()
  const permissions = profile.role.permissions.map((rp) => rp.permission.key)
  if (!email || (!isInstitutionalEmail(email) && !isAdministrativeRole(profile.role.name, permissions))) {
    return { profile: null, error: 'INSTITUTIONAL_EMAIL_REQUIRED' }
  }

  return {
    profile: {
      id: profile.id,
      roleId: profile.role.id,
      roleName: profile.role.name,
      permissions,
    },
    error: null,
  }
}

export function hasPermission(profile: AuthenticatedProfile, key: string): boolean {
  return profile.permissions.includes(key)
}

export function statusForProfileError(
  error: 'UNAUTHORIZED' | 'AUTH_NOT_CONFIGURED' | 'PROFILE_REQUIRED' | 'ACCOUNT_DISABLED' | 'INSTITUTIONAL_EMAIL_REQUIRED',
): number {
  if (error === 'AUTH_NOT_CONFIGURED') return 500
  if (error === 'PROFILE_REQUIRED') return 409
  if (error === 'ACCOUNT_DISABLED' || error === 'INSTITUTIONAL_EMAIL_REQUIRED') return 403
  return 401
}
