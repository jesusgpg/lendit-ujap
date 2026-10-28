import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabase'

export interface ChangeAccountPasswordInput {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface ChangeAccountPasswordResult {
  ok: boolean
  error?: string
}

export interface ChangeAccountPasswordDependencies {
  mainClient?: SupabaseClient
  isolatedClient?: SupabaseClient
  createIsolatedClient?: () => SupabaseClient
}

/**
 * Creates an isolated Supabase client without session persistence
 * or url detection. Used strictly for verifying the current password
 * via signInWithPassword without polluting the global auth state,
 * local storage, or triggering auth listener events in the main app.
 */
export function createIsolatedAuthClient(url?: string, key?: string): SupabaseClient {
  const supabaseUrl = url ?? (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  const supabasePublishableKey = key ?? (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Supabase no está configurado. Faltan las variables de entorno de autenticación.')
  }

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    },
  })
}

/**
 * Validates password change constraints before making any network calls.
 * Ensures minimum 6 characters (coherent with LendIt's policy in auth.ts),
 * checks non-empty values, enforces difference from current password,
 * and verifies that the confirmation matches.
 */
export function validatePasswordChange(input: ChangeAccountPasswordInput): string | null {
  const current = input.currentPassword
  const next = input.newPassword
  const confirm = input.confirmPassword

  if (!current) {
    return 'Ingresa tu contraseña actual.'
  }
  if (!next) {
    return 'Ingresa la nueva contraseña.'
  }
  if (next.length < 6) {
    return 'La nueva contraseña debe tener al menos 6 caracteres.'
  }
  if (next === current) {
    return 'La nueva contraseña debe ser distinta a la actual.'
  }
  if (!confirm) {
    return 'Confirma la nueva contraseña.'
  }
  if (next !== confirm) {
    return 'Las contraseñas no coinciden.'
  }
  return null
}

/**
 * Maps known Supabase error messages into clear, human-friendly Spanish.
 */
export function mapAuthError(message: string, fallback: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials') || normalized.includes('invalid credentials')) {
    return 'La contraseña actual es incorrecta.'
  }
  if (normalized.includes('should be different') || normalized.includes('same_password')) {
    return 'La nueva contraseña debe ser distinta a la actual.'
  }
  if (normalized.includes('at least 6') || normalized.includes('weak_password')) {
    return 'La nueva contraseña debe tener al menos 6 caracteres.'
  }
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Demasiados intentos. Espera unos momentos antes de intentar nuevamente.'
  }
  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'Error de conexión. Comprueba tu conexión a internet.'
  }
  return message || fallback
}

/**
 * Securely changes the user's password:
 * 1. Validates inputs locally (mismatch will exit early without calling any client).
 * 2. Verifies the user has an active session on the main Supabase client.
 * 3. Re-authenticates using an isolated client so global tokens, listeners,
 *    and local storage remain untouched.
 * 4. Verifies that the re-authenticated user identity exactly matches the active user id and email.
 * 5. Calls updateUser({ password }) on the main client with the active session.
 * 6. Cleans up isolated client resources with explicit { scope: 'local' } to avoid
 *    revoking real sessions globally on the Supabase Auth server.
 */
export async function changeAccountPassword(
  input: ChangeAccountPasswordInput,
  deps?: ChangeAccountPasswordDependencies,
): Promise<ChangeAccountPasswordResult> {
  const validationError = validatePasswordChange(input)
  if (validationError) {
    return { ok: false, error: validationError }
  }

  let mainClient: SupabaseClient
  try {
    mainClient = deps?.mainClient ?? getSupabaseClient()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'No se pudo conectar con el servicio de autenticación.',
    }
  }

  let activeUserId: string | undefined
  let email: string | undefined
  try {
    const { data: sessionData, error: sessionError } = await mainClient.auth.getSession()
    if (sessionError || !sessionData?.session?.user?.email || !sessionData?.session?.user?.id) {
      return {
        ok: false,
        error: 'Tu sesión no está activa o ha expirado. Inicia sesión nuevamente.',
      }
    }
    activeUserId = sessionData.session.user.id
    email = sessionData.session.user.email
  } catch {
    return {
      ok: false,
      error: 'No se pudo verificar la sesión actual.',
    }
  }

  let isolatedClient: SupabaseClient
  try {
    isolatedClient =
      deps?.isolatedClient ??
      (deps?.createIsolatedClient ? deps.createIsolatedClient() : createIsolatedAuthClient())
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'No se pudo iniciar el verificador seguro de credenciales.',
    }
  }

  try {
    // 3. Re-autenticación en cliente temporal aislado
    const { data: signInData, error: signInError } = await isolatedClient.auth.signInWithPassword({
      email,
      password: input.currentPassword,
    })

    if (signInError) {
      return {
        ok: false,
        error: mapAuthError(signInError.message, 'La contraseña actual es incorrecta.'),
      }
    }

    // 4. Verificación explícita de correspondencia de identidad (id y email)
    if (
      !signInData?.user ||
      signInData.user.id !== activeUserId ||
      signInData.user.email?.toLowerCase() !== email.toLowerCase()
    ) {
      return {
        ok: false,
        error: 'La identidad verificada no coincide con el usuario de la sesión activa.',
      }
    }

    // 5. Actualización de credencial en el cliente principal
    const { error: updateError } = await mainClient.auth.updateUser({
      password: input.newPassword,
    })

    if (updateError) {
      return {
        ok: false,
        error: mapAuthError(updateError.message, 'No se pudo actualizar la contraseña.'),
      }
    }

    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? mapAuthError(err.message, 'No se pudo actualizar la contraseña.')
          : 'No se pudo actualizar la contraseña.',
    }
  } finally {
    // 6. Limpieza explícita del cliente aislado con scope: 'local'
    // IMPORTANTE: el scope default en Supabase es 'global', el cual revocaría la sesión
    // en el servidor para todos los clientes y dispositivos.
    // Usar 'local' garantiza que no se envíe la solicitud de revocación global a Supabase.
    try {
      await isolatedClient.auth.signOut({ scope: 'local' }).catch(() => {})
    } catch {
      // Ignorar errores en limpieza local de cliente temporal
    }
  }
}

/**
 * Controller to manage in-flight state and prevent double submission.
 */
export function createPasswordChangeController(deps?: ChangeAccountPasswordDependencies) {
  let inFlight = false

  return {
    isInFlight() {
      return inFlight
    },
    async submit(
      input: ChangeAccountPasswordInput,
      callbacks?: {
        onSuccess?: () => void
        onError?: (error: string) => void
      },
    ): Promise<ChangeAccountPasswordResult> {
      if (inFlight) {
        const error = 'Ya hay una actualización de contraseña en curso.'
        callbacks?.onError?.(error)
        return { ok: false, error }
      }

      inFlight = true
      try {
        const result = await changeAccountPassword(input, deps)
        if (result.ok) {
          callbacks?.onSuccess?.()
        } else if (result.error) {
          callbacks?.onError?.(result.error)
        }
        return result
      } finally {
        inFlight = false
      }
    },
  }
}
