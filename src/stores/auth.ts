import { isEligibleCampusEmail } from '../lib/emailEligibility'
import { defineStore } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import { apiRequest } from '../lib/api'
import { getSupabaseClient } from '../lib/supabase'
import { verifyRecoverySession } from '../lib/authCallbacks'
import { uploadItemPhoto } from '../lib/storage'
import {
  storePendingRegistrationPhoto,
  restorePendingRegistrationPhoto,
} from '../lib/pendingRegistrationPhoto'
import { useMessagesStore } from './messages'
import { usePaymentsStore } from './payments'
import type { AuthUser, LoginCredentials, RegisterInput } from '../types'

interface AuthResult {
  ok: boolean
  error?: string
  requiresEmailConfirmation?: boolean
}

interface ProfileResponse {
  user: AuthUser
}

export function isInstitutionalEmail(email: string) {
  return /^[^\s@]+@ujap\.edu\.ve$/i.test(email.trim())
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email.trim())
}

function isAdministrativeUser(user: AuthUser | null) {
  return user?.role === 'ADMIN' || user?.permissions.includes('roles.manage')
}

function errorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : ''
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Confirma tu correo antes de iniciar sesión.'
  }
  if (normalized.includes('user already registered')) {
    return 'Ya existe una cuenta con ese correo. Inicia sesión.'
  }
  if (normalized.includes('profile_incomplete')) {
    return 'Tu cuenta no tiene datos de perfil suficientes. Regístrate de nuevo o contacta a un administrador.'
  }
  if (normalized.includes('institutional_email_required')) {
    return 'Esta cuenta no está autorizada para el acceso administrativo.'
  }
  if (normalized.includes('account_disabled')) {
    return 'Tu cuenta está desactivada. Contacta a un administrador.'
  }
  if (message) {
    return message
  }
  return fallback
}

function validateCommonFields(input: RegisterInput) {
  const email = input.email.trim().toLowerCase()
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const phone = input.phone.trim()

  if (!firstName || !lastName || !phone) {
    return 'Completa todos los campos del registro.'
  }
  if (input.role === 'STUDENT' && !input.careerId) {
    return 'Selecciona tu carrera.'
  }
  if (input.role === 'PROFESSOR' && !input.schoolId) {
    return 'Selecciona tu facultad o escuela.'
  }
  if (!isEligibleCampusEmail(email)) {
    return 'Usa tu correo institucional (@ujap.edu.ve).'
  }
  if (input.password.length < 6) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }
  if (!input.photo) {
    return 'La foto de perfil es obligatoria.'
  }
  return null
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUser | null,
    isLoading: false,
    isInitialized: false,
    initializationError: null as string | null,
    isPasswordRecoveryActive: false,
    passwordRecoveryUserId: null as string | null,
    isResettingPassword: false,
    authListenerRegistered: false,
  }),

  getters: {
    isAuthenticated: (state) => state.user !== null,
    isAdmin: (state) => state.user?.role === 'ADMIN' || (state.user?.permissions.includes('roles.manage') ?? false),
    hasPermission: (state) => (key: string) => state.user?.permissions.includes(key) ?? false,
    isTeacherApplicant: (state) => Boolean(state.user?.teacherVerification && state.user.teacherVerification.status !== 'APPROVED'),
    isApprovedTeacher: (state) => state.user?.role === 'PROFESSOR' && state.user?.teacherVerification?.status === 'APPROVED',
    canPerformMarketplaceOperations: (state) => {
      if (!state.user) return false
      if (state.user.role === 'ADMIN' || state.user.permissions.includes('roles.manage')) return false
      if (state.user.teacherVerification && state.user.teacherVerification.status !== 'APPROVED') return false
      return true
    },
  },

  actions: {
    async initialize() {
      if (this.isInitialized || this.isLoading) {
        return
      }

      this.isLoading = true
      this.initializationError = null

      try {
        const supabase = getSupabaseClient()
        if (!this.authListenerRegistered) {
          supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
              this.user = null
              usePaymentsStore().clear()
              this.isPasswordRecoveryActive = false
              this.passwordRecoveryUserId = null
              useMessagesStore().clear()
              return
            }

            if (event === 'PASSWORD_RECOVERY') {
              this.passwordRecoveryUserId = session?.user?.id ?? null
              this.isPasswordRecoveryActive = Boolean(this.passwordRecoveryUserId)
              return
            }

            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
              // Supabase may re-emit SIGNED_IN when the same browser session
              // regains focus. Only a different identity cancels recovery here;
              // leaving its route, signing out or saving also clears the state.
              if (this.passwordRecoveryUserId && session?.user.id !== this.passwordRecoveryUserId) {
                this.clearPasswordRecoveryState()
              }
              globalThis.setTimeout(() => {
                void this.syncProfile(session).catch((error: unknown) => {
                  this.initializationError = errorMessage(error, 'No se pudo cargar tu perfil.')
                })
              }, 0)
            }
          })
          this.authListenerRegistered = true
        }
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          throw error
        }

        if (data.session) {
          await this.syncProfile(data.session)
        }
      } catch (error) {
        this.user = null
        usePaymentsStore().clear()
        this.initializationError = errorMessage(error, 'No se pudo inicializar la sesión.')
      } finally {
        this.isLoading = false
        this.isInitialized = true
      }
    },

    async syncProfile(session?: Session | null) {
      const supabase = getSupabaseClient()
      const activeSession = session ?? (await supabase.auth.getSession()).data?.session

      if (!activeSession) {
        this.user = null
        usePaymentsStore().clear()
        return
      }

      try {
        const response = await apiRequest<ProfileResponse>('/api/me')
        if (this.user?.id !== response.user.id) {
          useMessagesStore().clear()
          usePaymentsStore().clear()
        }
        this.user = response.user
      } catch (error) {
        // Cuentas creadas antes de que el trigger de base de datos estuviera activo
        // no tienen perfil LendIt. El backend lo puede reconstruir desde los metadatos
        // seguros que Supabase guardó durante el registro.
        if (!(error instanceof Error) || error.message !== 'PROFILE_REQUIRED') {
          throw error
        }

        const response = await apiRequest<ProfileResponse>('/api/me', {
          method: 'PATCH',
          body: JSON.stringify({}),
        })
        if (this.user?.id !== response.user.id) {
          useMessagesStore().clear()
          usePaymentsStore().clear()
        }
        this.user = response.user
      }

      // Integración con servicio de foto pendiente de Agente C
      if (this.user && !this.user.photo) {
        try {
          const restoredUser = await restorePendingRegistrationPhoto(this.user.email, this.user)
          if (restoredUser) {
            this.user = restoredUser
          }
        } catch {
          // Si el servicio no está disponible o falla, conserva el perfil actual
        }
      }
    },

    async register(input: RegisterInput): Promise<AuthResult> {
      const validationError = validateCommonFields(input)
      if (validationError) {
        return { ok: false, error: validationError }
      }

      try {
        const supabase = getSupabaseClient()
        const email = input.email.trim().toLowerCase()
        const redirectOrigin = typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : 'http://localhost:5173'
        const emailRedirectTo = `${redirectOrigin.replace(/\/+$/, '')}/auth/confirmacion`

        const { data, error } = await supabase.auth.signUp({
          email,
          password: input.password,
          options: {
            emailRedirectTo,
            data: {
              firstName: input.firstName.trim(),
              lastName: input.lastName.trim(),
              careerId: input.careerId || null,
              schoolId: input.schoolId || null,
              department: input.department?.trim() || null,
              role: input.role,
              phone: input.phone.trim(),
            },
          },
        })

        if (error) {
          return { ok: false, error: errorMessage(error, 'No se pudo crear la cuenta.') }
        }

        if (data.session) {
          await this.syncProfile(data.session)
          // La foto se sube a Storage aquí (no como metadata de Auth): un data URL
          // en los metadatos del usuario viaja embebido en cada JWT y puede inflar
          // los headers de Authorization lo suficiente para que el servidor los rechace.
          if (input.photo) {
            const photoUrl = await uploadItemPhoto(input.photo)
            const response = await apiRequest<ProfileResponse>('/api/me', {
              method: 'PATCH',
              body: JSON.stringify({ photoUrl }),
            })
            this.user = response.user
          }
          return { ok: true }
        }

        // Si requiere confirmación de correo, guardar la foto pendiente vía Agente C
        if (input.photo) {
          try {
            await storePendingRegistrationPhoto(email, input.photo)
          } catch {
            // No bloquea la creación de la cuenta si el almacenamiento local falla
          }
        }

        return { ok: true, requiresEmailConfirmation: true }
      } catch (error) {
        return { ok: false, error: errorMessage(error, 'No se pudo crear la cuenta.') }
      }
    },

    async requestPasswordReset(email: string, mode: 'institutional' | 'admin' = 'institutional'): Promise<AuthResult> {
      const normalizedEmail = email.trim().toLowerCase()
      if (mode === 'institutional' && !isEligibleCampusEmail(normalizedEmail)) {
        return { ok: false, error: 'Usa tu correo institucional (@ujap.edu.ve).' }
      }
      if (mode === 'admin' && !isValidEmail(normalizedEmail)) {
        return { ok: false, error: 'Escribe un correo válido para el acceso administrativo.' }
      }

      try {
        const origin = typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : 'http://localhost:5173'
        const redirectTo = `${origin.replace(/\/+$/, '')}/auth/reset-password`

        const { error } = await getSupabaseClient().auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo,
        })

        if (error) {
          const msg = error.message.toLowerCase()
          if (msg.includes('rate limit')) {
            return { ok: false, error: 'Demasiadas solicitudes de recuperación. Espera un momento antes de volver a intentar.' }
          }
          return { ok: false, error: errorMessage(error, 'No se pudo procesar la solicitud de recuperación.') }
        }

        return { ok: true }
      } catch (error) {
        return { ok: false, error: errorMessage(error, 'No se pudo procesar la solicitud de recuperación.') }
      }
    },

    async updatePassword(newPassword: string): Promise<AuthResult> {
      if (!this.isPasswordRecoveryActive || !this.passwordRecoveryUserId) {
        return { ok: false, error: 'No tienes una sesión de recuperación de contraseña autorizada.' }
      }

      if (newPassword.length < 6) {
        return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' }
      }

      if (this.isResettingPassword) return { ok: false, error: 'Ya hay un cambio de contraseña en curso.' }
      this.isResettingPassword = true

      try {
        const client = getSupabaseClient()
        await verifyRecoverySession(client, this.passwordRecoveryUserId)
        const { error } = await client.auth.updateUser({
          password: newPassword,
        })

        if (error) {
          return { ok: false, error: errorMessage(error, 'No se pudo actualizar la contraseña.') }
        }

        // Desactivar inmediatamente la autorización de recuperación (evita reenvíos o doble consumo)
        this.clearPasswordRecoveryState()

        // Cerrar la sesión de recuperación para forzar inicio de sesión limpio con la nueva clave
        try {
          await client.auth.signOut({ scope: 'local' })
        } catch {
          // Silencioso
        }
        this.user = null
        usePaymentsStore().clear()

        return { ok: true }
      } catch (error) {
        return { ok: false, error: errorMessage(error, 'No se pudo actualizar la contraseña.') }
      } finally {
        this.isResettingPassword = false
      }
    },

    clearPasswordRecoveryState() {
      this.isPasswordRecoveryActive = false
      this.passwordRecoveryUserId = null
    },

    async confirmSignupWithCode(email: string, token: string): Promise<AuthResult> {
      const normalizedEmail = email.trim().toLowerCase()
      const normalizedToken = token.trim()

      if (!isEligibleCampusEmail(normalizedEmail)) {
        return { ok: false, error: 'Usa tu correo institucional (@ujap.edu.ve).' }
      }
      if (!normalizedToken) {
        return { ok: false, error: 'Escribe el código que recibiste por correo.' }
      }

      try {
        const { data, error } = await getSupabaseClient().auth.verifyOtp({
          email: normalizedEmail,
          token: normalizedToken,
          type: 'email',
        })

        if (error) {
          const message = error.message.toLowerCase()
          if (message.includes('expired') || message.includes('otp_expired') || message.includes('not found')) {
            return { ok: false, error: 'El código expiró o ya fue usado. Solicita uno nuevo.' }
          }
          if (message.includes('invalid') || message.includes('token')) {
            return { ok: false, error: 'El código no coincide. Revísalo e inténtalo de nuevo.' }
          }
          return { ok: false, error: errorMessage(error, 'No se pudo confirmar el correo.') }
        }

        if (!data.session || !data.user?.email_confirmed_at) {
          return { ok: false, error: 'No se pudo comprobar la confirmación. Solicita un código nuevo.' }
        }

        return { ok: true }
      } catch (error) {
        return { ok: false, error: errorMessage(error, 'No se pudo confirmar el correo.') }
      }
    },

    async resendConfirmationEmail(email: string): Promise<AuthResult> {
      const normalizedEmail = email.trim().toLowerCase()
      if (!isEligibleCampusEmail(normalizedEmail)) {
        return { ok: false, error: 'Usa tu correo institucional (@ujap.edu.ve).' }
      }

      try {
        const origin = typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : 'http://localhost:5173'
        const emailRedirectTo = `${origin.replace(/\/+$/, '')}/auth/confirmacion`

        const { error } = await getSupabaseClient().auth.resend({
          type: 'signup',
          email: normalizedEmail,
          options: {
            emailRedirectTo,
          },
        })

        if (error) {
          const msg = error.message.toLowerCase()
          if (msg.includes('rate limit')) {
            return { ok: false, error: 'Demasiadas solicitudes de reenvío. Espera unos minutos.' }
          }
          return { ok: false, error: errorMessage(error, 'No se pudo reenviar el correo de confirmación.') }
        }

        return { ok: true }
      } catch (error) {
        return { ok: false, error: errorMessage(error, 'No se pudo reenviar el correo.') }
      }
    },

    async login({ email, password, mode = 'institutional' }: LoginCredentials): Promise<AuthResult> {
      const normalizedEmail = email.trim().toLowerCase()
      if (mode === 'institutional' && !isEligibleCampusEmail(normalizedEmail)) {
        return { ok: false, error: 'Usa tu correo institucional (@ujap.edu.ve).' }
      }
      if (mode === 'admin' && !isValidEmail(normalizedEmail)) {
        return { ok: false, error: 'Escribe un correo válido para el acceso administrativo.' }
      }
      if (password.length < 6) {
        return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' }
      }

      try {
        const { data, error } = await getSupabaseClient().auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })

        if (error) {
          return { ok: false, error: errorMessage(error, 'No se pudo iniciar sesión.') }
        }
        if (!data.session) {
          return { ok: false, error: 'No se pudo crear la sesión.' }
        }

        await this.syncProfile(data.session)

        if (mode === 'admin' && !isAdministrativeUser(this.user)) {
          await this.logout()
          return { ok: false, error: 'Esta cuenta no tiene permisos de administrador.' }
        }
        if (mode === 'institutional' && isAdministrativeUser(this.user)) {
          await this.logout()
          return { ok: false, error: 'Usa el acceso administrativo para esta cuenta.' }
        }

        return { ok: true }
      } catch (error) {
        try {
          await getSupabaseClient().auth.signOut()
        } catch {
          // La sesión local se limpia aunque Supabase no responda al cerrar sesión.
        }
        this.user = null
        usePaymentsStore().clear()
        return { ok: false, error: errorMessage(error, 'No se pudo iniciar sesión.') }
      }
    },

    async logout() {
      // Se limpia de inmediato para que la UI refleje la salida sin esperar
      // la respuesta remota, que puede tardar o fallar por red.
      this.user = null
      usePaymentsStore().clear()
      useMessagesStore().clear()
      await getSupabaseClient().auth.signOut()
    },
  },
})
