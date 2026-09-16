import { createClient } from '@supabase/supabase-js'
import { prisma } from '../../_lib/prisma.js'
import { getAuthenticatedProfile, hasPermission, statusForProfileError, type ApiRequest, type ApiResponse } from '../../_lib/auth.js'

type PasswordRecoveryAuthApi = {
  resetPasswordForEmail: (
    email: string,
    options?: { redirectTo?: string },
  ) => Promise<{ error: Error | null }>
}

export default async function handler(req: ApiRequest & { query?: { id?: string } }, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  const id = req.query?.id
  if (!id) {
    return res.status(400).json({ ok: false, error: 'MISSING_USER_ID' })
  }

  try {
    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) {
      return res.status(statusForProfileError(error)).json({ ok: false, error })
    }
    if (!hasPermission(profile, 'users.manage')) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    const targetUser = await prisma.user.findUnique({ where: { id }, select: { email: true } })
    if (!targetUser) {
      return res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' })
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ ok: false, error: 'AUTH_NOT_CONFIGURED' })
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    // Keep the serverless type-check independent of Supabase's inherited auth
    // declarations while calling the public method at runtime.
    const auth = supabase.auth as unknown as PasswordRecoveryAuthApi
    const { error: resetError } = await auth.resetPasswordForEmail(targetUser.email, {
      redirectTo: process.env.APP_URL,
    })
    if (resetError) {
      return res.status(502).json({ ok: false, error: resetError.message })
    }

    return res.status(200).json({ ok: true })
  } catch (resetError) {
    console.error('Password reset failed', resetError instanceof Error ? resetError.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'PASSWORD_RESET_FAILED' })
  }
}
