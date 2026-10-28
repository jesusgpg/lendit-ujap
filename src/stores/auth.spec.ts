import { describe, expect, it, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { isInstitutionalEmail, isValidEmail, useAuthStore } from './auth'
import { getSupabaseClient } from '../lib/supabase'

// Mock de Supabase Client para pruebas aisladas y deterministas
let authChangeCallback: ((event: string, session: any) => void) | null = null

vi.mock('../lib/supabase', () => {
  const mockSupabase = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn((cb) => {
        authChangeCallback = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      verifyOtp: vi.fn(),
      resend: vi.fn(),
    },
  }
  return {
    getSupabaseClient: () => mockSupabase,
  }
})

// Mock de API request
vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}))

describe('Auth Store & Recovery Suite', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    authChangeCallback = null
    vi.mocked(getSupabaseClient().auth.getSession).mockResolvedValue({ data: { session: null }, error: null })
  })

  describe('email access rules', () => {
    it('accepts only the institutional UJAP domain for community accounts', () => {
      expect(isInstitutionalEmail('estudiante@ujap.edu.ve')).toBe(true)
      expect(isInstitutionalEmail('ESTUDIANTE@UJAP.EDU.VE')).toBe(true)
      expect(isInstitutionalEmail('estudiante@gmail.com')).toBe(false)
      expect(isInstitutionalEmail('estudiante@sub.ujap.edu.ve')).toBe(false)
    })

    it('accepts valid public email addresses for the admin entry point', () => {
      expect(isValidEmail('admin@gmail.com')).toBe(true)
      expect(isValidEmail('admin@ujap.edu.ve')).toBe(true)
      expect(isValidEmail('admin@')).toBe(false)
    })
  })

  describe('requestPasswordReset', () => {
    it('rechaza correo no institucional en modo institucional', async () => {
      const auth = useAuthStore()
      const res = await auth.requestPasswordReset('estudiante@gmail.com', 'institutional')
      expect(res.ok).toBe(false)
      expect(res.error).toBe('Usa tu correo institucional (@ujap.edu.ve).')
    })

    it('rechaza correo inválido en modo admin', async () => {
      const auth = useAuthStore()
      const res = await auth.requestPasswordReset('admin-invalido', 'admin')
      expect(res.ok).toBe(false)
      expect(res.error).toBe('Escribe un correo válido para el acceso administrativo.')
    })

    it('llama a resetPasswordForEmail con redirectTo correcto en éxito', async () => {
      const { getSupabaseClient } = await import('../lib/supabase')
      const mockClient = getSupabaseClient()
      vi.mocked(mockClient.auth.resetPasswordForEmail).mockResolvedValueOnce({
        data: {},
        error: null,
      } as any)

      const auth = useAuthStore()
      const res = await auth.requestPasswordReset('estudiante@ujap.edu.ve', 'institutional')
      expect(res.ok).toBe(true)
      expect(mockClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'estudiante@ujap.edu.ve',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/reset-password'),
        }),
      )
    })

    it('maneja rate limit con mensaje amigable', async () => {
      const { getSupabaseClient } = await import('../lib/supabase')
      const mockClient = getSupabaseClient()
      vi.mocked(mockClient.auth.resetPasswordForEmail).mockResolvedValueOnce({
        data: null,
        error: new Error('Rate limit exceeded for email sending'),
      } as any)

      const auth = useAuthStore()
      const res = await auth.requestPasswordReset('estudiante@ujap.edu.ve', 'institutional')
      expect(res.ok).toBe(false)
      expect(res.error).toContain('Demasiadas solicitudes')
    })
  })

  describe('updatePassword & recovery authorization', () => {
    it('rechaza actualización sin sesión de recuperación activa (sesión ordinaria o intento directo)', async () => {
      const auth = useAuthStore()
      auth.isPasswordRecoveryActive = false // sesión ordinaria
      const res = await auth.updatePassword('NuevaClave123')
      expect(res.ok).toBe(false)
      expect(res.error).toBe('No tienes una sesión de recuperación de contraseña autorizada.')
    })

    it('rechaza contraseñas con menos de 6 caracteres cuando la recuperación está autorizada', async () => {
      const auth = useAuthStore()
      auth.isPasswordRecoveryActive = true
      auth.passwordRecoveryUserId = 'test-user-id'
      const res = await auth.updatePassword('123')
      expect(res.ok).toBe(false)
      expect(res.error).toBe('La contraseña debe tener al menos 6 caracteres.')
      // No debe consumir el estado de recuperación por error de validación
      expect(auth.isPasswordRecoveryActive).toBe(true)
    })

    it('actualiza exitosamente con updateUser, cierra sesión y limpia bandera de recuperación', async () => {
      const { getSupabaseClient } = await import('../lib/supabase')
      const mockClient = getSupabaseClient()
      vi.mocked(mockClient.auth.updateUser).mockResolvedValueOnce({
        data: { user: { id: 'test-user-id' } },
        error: null,
      } as any)

      const auth = useAuthStore()
      auth.isPasswordRecoveryActive = true
      auth.passwordRecoveryUserId = 'test-user-id'
      vi.mocked(mockClient.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'test-user-id' } } }, error: null } as any)
      const res = await auth.updatePassword('NuevaClaveSegura123')
      expect(res.ok).toBe(true)
      expect(mockClient.auth.updateUser).toHaveBeenCalledWith({
        password: 'NuevaClaveSegura123',
      })
      expect(mockClient.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
      expect(auth.isPasswordRecoveryActive).toBe(false)
      expect(auth.user).toBeNull()
    })

    it('bloquea doble consumo (segunda llamada inmediata es rechazada)', async () => {
      const { getSupabaseClient } = await import('../lib/supabase')
      const mockClient = getSupabaseClient()
      vi.mocked(mockClient.auth.updateUser).mockResolvedValueOnce({
        data: { user: { id: 'test-user-id' } },
        error: null,
      } as any)

      const auth = useAuthStore()
      auth.isPasswordRecoveryActive = true
      auth.passwordRecoveryUserId = 'test-user-id'
      vi.mocked(mockClient.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'test-user-id' } } }, error: null } as any)

      // Primer consumo exitoso
      const firstRes = await auth.updatePassword('NuevaClaveSegura123')
      expect(firstRes.ok).toBe(true)
      expect(auth.isPasswordRecoveryActive).toBe(false)

      // Segundo consumo inmediato
      const secondRes = await auth.updatePassword('OtraClave123')
      expect(secondRes.ok).toBe(false)
      expect(secondRes.error).toBe('No tienes una sesión de recuperación de contraseña autorizada.')
      expect(mockClient.auth.updateUser).toHaveBeenCalledTimes(1)
    })

    it('clearPasswordRecoveryState restablece la bandera de recuperación', () => {
      const auth = useAuthStore()
      auth.isPasswordRecoveryActive = true
      auth.clearPasswordRecoveryState()
      expect(auth.isPasswordRecoveryActive).toBe(false)
    })

    it('activa isPasswordRecoveryActive ante evento PASSWORD_RECOVERY del SDK', async () => {
      const auth = useAuthStore()
      await auth.initialize()

      expect(authChangeCallback).toBeTypeOf('function')
      authChangeCallback!('PASSWORD_RECOVERY', { user: { id: 'test-user-id' } })
      expect(auth.isPasswordRecoveryActive).toBe(true)
      expect(auth.passwordRecoveryUserId).toBe('test-user-id')

      authChangeCallback!('SIGNED_OUT', null)
      expect(auth.isPasswordRecoveryActive).toBe(false)
    })

    it('registra el listener antes de que getSession procese el callback inicial', async () => {
      vi.mocked(getSupabaseClient().auth.getSession).mockImplementationOnce(async () => {
        expect(authChangeCallback).toBeTypeOf('function')
        authChangeCallback!('PASSWORD_RECOVERY', { user: { id: 'test-user-id' } })
        return { data: { session: null }, error: null }
      })
      const auth = useAuthStore()
      await auth.initialize()
      expect(auth.passwordRecoveryUserId).toBe('test-user-id')
    })

    it('un evento de recuperación sin sesión no autoriza cambiar clave', async () => {
      const auth = useAuthStore()
      await auth.initialize()
      authChangeCallback!('PASSWORD_RECOVERY', null)
      expect(auth.isPasswordRecoveryActive).toBe(false)
      expect((await auth.updatePassword('NuevaClave123')).ok).toBe(false)
      expect(getSupabaseClient().auth.updateUser).not.toHaveBeenCalled()
    })

    it('bloquea recuperación si la identidad cambió desde el enlace', async () => {
      const auth = useAuthStore()
      auth.isPasswordRecoveryActive = true
      auth.passwordRecoveryUserId = 'original-id'
      vi.mocked(getSupabaseClient().auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'different-id' } } }, error: null } as any)
      expect((await auth.updatePassword('NuevaClave123')).ok).toBe(false)
      expect(getSupabaseClient().auth.updateUser).not.toHaveBeenCalled()
    })

    it('no pierde recuperación por SIGNED_IN repetido de la misma cuenta', async () => {
      const auth = useAuthStore()
      await auth.initialize()
      authChangeCallback!('PASSWORD_RECOVERY', { user: { id: 'test-user-id' } })
      authChangeCallback!('SIGNED_IN', { user: { id: 'test-user-id' } })
      expect(auth.isPasswordRecoveryActive).toBe(true)
      authChangeCallback!('SIGNED_IN', { user: { id: 'different-id' } })
      expect(auth.isPasswordRecoveryActive).toBe(false)
    })
  })

  describe('resendConfirmationEmail', () => {
    it('rechaza correo no institucional', async () => {
      const auth = useAuthStore()
      const res = await auth.resendConfirmationEmail('otro@gmail.com')
      expect(res.ok).toBe(false)
      expect(res.error).toBe('Usa tu correo institucional (@ujap.edu.ve).')
    })

    it('llama a resend con emailRedirectTo a /auth/confirmacion', async () => {
      const { getSupabaseClient } = await import('../lib/supabase')
      const mockClient = getSupabaseClient()
      vi.mocked(mockClient.auth.resend).mockResolvedValueOnce({
        data: {},
        error: null,
      } as any)

      const auth = useAuthStore()
      const res = await auth.resendConfirmationEmail('docente@ujap.edu.ve')
      expect(res.ok).toBe(true)
      expect(mockClient.auth.resend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'signup',
          email: 'docente@ujap.edu.ve',
          options: expect.objectContaining({
            emailRedirectTo: expect.stringContaining('/auth/confirmacion'),
          }),
        }),
      )
    })
  })

  describe('confirmSignupWithCode', () => {
    it('verifies the email code and requires a confirmed session', async () => {
      const client = getSupabaseClient()
      vi.mocked(client.auth.verifyOtp).mockResolvedValueOnce({
        data: {
          user: { id: 'test-user-id', email_confirmed_at: '2026-10-27T12:00:00Z' },
          session: { access_token: 'test-session' },
        },
        error: null,
      } as any)

      const auth = useAuthStore()
      const result = await auth.confirmSignupWithCode('estudiante@ujap.edu.ve', ' 123456 ')

      expect(result).toEqual({ ok: true })
      expect(client.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'estudiante@ujap.edu.ve',
        token: '123456',
        type: 'email',
      })
    })

    it('explains that an expired or consumed code must be requested again', async () => {
      const client = getSupabaseClient()
      vi.mocked(client.auth.verifyOtp).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: new Error('Token has expired or is invalid') as any,
      } as any)

      const auth = useAuthStore()
      const result = await auth.confirmSignupWithCode('estudiante@ujap.edu.ve', '123456')

      expect(result).toEqual({ ok: false, error: 'El código expiró o ya fue usado. Solicita uno nuevo.' })
    })
  })
})
