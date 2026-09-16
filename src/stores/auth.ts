import { defineStore } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import { apiRequest } from '../lib/api'
import { getSupabaseClient } from '../lib/supabase'
import type { AuthUser, LoginCredentials, RegisterInput } from '../types'

interface AuthResult {
  ok: boolean
  error?: string
  requiresEmailConfirmation?: boolean
}

interface ProfileResponse {
  user: AuthUser
}

let authListenerRegistered = false

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

  if (!firstName || !lastName || !input.careerId || !phone) {
    return 'Completa todos los campos del registro.'
  }
  if (!isInstitutionalEmail(email)) {
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
  }),

  getters: {
    isAuthenticated: (state) => state.user !== null,
    hasPermission: (state) => (key: string) => state.user?.permissions.includes(key) ?? false,
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
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          throw error
        }

        if (data.session) {
          await this.syncProfile(data.session)
        }

        if (!authListenerRegistered) {
          supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
              this.user = null
              return
            }

            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
              globalThis.setTimeout(() => {
                void this.syncProfile(session).catch((error: unknown) => {
                  this.initializationError = errorMessage(error, 'No se pudo cargar tu perfil.')
                })
              }, 0)
            }
          })
          authListenerRegistered = true
        }
      } catch (error) {
        this.user = null
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
        return
      }

      try {
        const response = await apiRequest<ProfileResponse>('/api/me')
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
        this.user = response.user
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
        const { data, error } = await supabase.auth.signUp({
          email,
          password: input.password,
          options: {
            data: {
              firstName: input.firstName.trim(),
              lastName: input.lastName.trim(),
              careerId: input.careerId,
              role: input.role,
              phone: input.phone.trim(),
              photoUrl: input.photo,
            },
          },
        })

        if (error) {
          return { ok: false, error: errorMessage(error, 'No se pudo crear la cuenta.') }
        }

        if (data.session) {
          await this.syncProfile(data.session)
          const response = await apiRequest<ProfileResponse>('/api/me', {
            method: 'PATCH',
            body: JSON.stringify({ photoUrl: input.photo }),
          })
          this.user = response.user
          return { ok: true }
        }

        return { ok: true, requiresEmailConfirmation: true }
      } catch (error) {
        return { ok: false, error: errorMessage(error, 'No se pudo crear la cuenta.') }
      }
    },

    async login({ email, password, mode = 'institutional' }: LoginCredentials): Promise<AuthResult> {
      const normalizedEmail = email.trim().toLowerCase()
      if (mode === 'institutional' && !isInstitutionalEmail(normalizedEmail)) {
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
        return { ok: false, error: errorMessage(error, 'No se pudo iniciar sesión.') }
      }
    },

    async logout() {
      try {
        await getSupabaseClient().auth.signOut()
      } finally {
        this.user = null
      }
    },
  },
})
