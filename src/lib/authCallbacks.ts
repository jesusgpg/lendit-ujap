import type { Session, SupabaseClient } from '@supabase/supabase-js'

/** Provider verification, not a declaration in the URL, proves the active identity. */
export async function verifyRecoverySession(client: SupabaseClient, expectedUserId: string | null): Promise<Session> {
  if (!expectedUserId) throw new Error('No tienes una sesión de recuperación de contraseña autorizada.')
  const { data, error } = await client.auth.getSession()
  if (error || !data.session || data.session.user.id !== expectedUserId) {
    throw new Error('La sesión de recuperación terminó o cambió de cuenta. Solicita un nuevo enlace.')
  }
  const verified = await client.auth.getUser()
  if (verified.error || verified.data.user?.id !== expectedUserId) {
    throw new Error('El enlace de recuperación ya no tiene una sesión válida. Solicita uno nuevo.')
  }
  return data.session
}

export async function verifyEmailConfirmation(client: SupabaseClient, syncProfile: (session: Session) => Promise<void>): Promise<void> {
  const { data, error } = await client.auth.getSession()
  if (error || !data.session) throw new Error('No se encontró una sesión confirmada. Abre el enlace enviado a tu correo.')
  const verified = await client.auth.getUser()
  if (verified.error || !verified.data.user?.email_confirmed_at || verified.data.user.id !== data.session.user.id) {
    throw new Error('No se pudo comprobar la confirmación del correo. Abre un enlace válido o solicita otro.')
  }
  await syncProfile(data.session)
}
