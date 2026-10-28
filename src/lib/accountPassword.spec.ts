import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  changeAccountPassword,
  createPasswordChangeController,
  validatePasswordChange,
} from './accountPassword'

function createMockClients(options?: {
  sessionUserId?: string
  sessionEmail?: string | null
  sessionError?: Error | null
  signInUser?: { id: string; email: string } | null
  isolatedSignInError?: { message: string } | null
  mainUpdateUserError?: { message: string } | null
}) {
  const sessionUserId = options?.sessionUserId ?? 'usr-123'
  const sessionEmail = options?.sessionEmail !== undefined ? options.sessionEmail : 'usuario@ujap.edu.ve'
  const sessionError = options?.sessionError ?? null
  const isolatedSignInError = options?.isolatedSignInError ?? null
  const mainUpdateUserError = options?.mainUpdateUserError ?? null

  const resolvedSignInUser =
    options?.signInUser !== undefined
      ? options.signInUser
      : sessionEmail
        ? { id: sessionUserId, email: sessionEmail }
        : null

  const isolatedSignInWithPassword = vi.fn().mockImplementation(async () => {
    return { data: { user: resolvedSignInUser }, error: isolatedSignInError }
  })
  const isolatedSignOut = vi.fn().mockImplementation(async () => {
    return { error: null }
  })

  let currentActiveSession: { user: { id: string; email: string } } | null = sessionEmail
    ? { user: { id: sessionUserId, email: sessionEmail } }
    : null

  const mainGetSession = vi.fn().mockImplementation(async () => {
    if (sessionError) {
      return { data: { session: null }, error: sessionError }
    }
    return {
      data: {
        session: currentActiveSession,
      },
      error: null,
    }
  })

  const mainUpdateUser = vi.fn().mockImplementation(async () => {
    return { data: { user: {} }, error: mainUpdateUserError }
  })

  const mainSignOut = vi.fn().mockImplementation(async () => {
    currentActiveSession = null
    return { error: null }
  })

  const isolatedClient = {
    auth: {
      signInWithPassword: isolatedSignInWithPassword,
      signOut: isolatedSignOut,
    },
  } as unknown as SupabaseClient

  const mainClient = {
    auth: {
      getSession: mainGetSession,
      updateUser: mainUpdateUser,
      signOut: mainSignOut,
    },
  } as unknown as SupabaseClient

  return {
    isolatedClient,
    mainClient,
    isolatedSignInWithPassword,
    isolatedSignOut,
    mainGetSession,
    mainUpdateUser,
    mainSignOut,
    getActiveSession: () => currentActiveSession,
  }
}

describe('accountPassword logic and security rules', () => {
  describe('validation rules', () => {
    it('requires current password', () => {
      const err = validatePasswordChange({
        currentPassword: '',
        newPassword: 'NuevaClave123',
        confirmPassword: 'NuevaClave123',
      })
      expect(err).toBe('Ingresa tu contraseña actual.')
    })

    it('requires new password', () => {
      const err = validatePasswordChange({
        currentPassword: 'ClaveActual123',
        newPassword: '',
        confirmPassword: '',
      })
      expect(err).toBe('Ingresa la nueva contraseña.')
    })

    it('enforces minimum length of 6 characters for new password', () => {
      const err = validatePasswordChange({
        currentPassword: 'ClaveActual123',
        newPassword: '12345',
        confirmPassword: '12345',
      })
      expect(err).toBe('La nueva contraseña debe tener al menos 6 caracteres.')
    })

    it('rejects new password if it is identical to current password', () => {
      const err = validatePasswordChange({
        currentPassword: 'MismaClave123',
        newPassword: 'MismaClave123',
        confirmPassword: 'MismaClave123',
      })
      expect(err).toBe('La nueva contraseña debe ser distinta a la actual.')
    })

    it('requires confirmation password', () => {
      const err = validatePasswordChange({
        currentPassword: 'ClaveActual123',
        newPassword: 'NuevaClave123',
        confirmPassword: '',
      })
      expect(err).toBe('Confirma la nueva contraseña.')
    })

    it('rejects confirmation mismatch', () => {
      const err = validatePasswordChange({
        currentPassword: 'ClaveActual123',
        newPassword: 'NuevaClave123',
        confirmPassword: 'OtraClaveDistinta',
      })
      expect(err).toBe('Las contraseñas no coinciden.')
    })

    it('accepts valid input', () => {
      const err = validatePasswordChange({
        currentPassword: 'ClaveActual123',
        newPassword: 'NuevaClave123',
        confirmPassword: 'NuevaClave123',
      })
      expect(err).toBeNull()
    })
  })

  describe('changeAccountPassword execution flows and session conservation', () => {
    it('mismatch no llama proveedor: validation mismatch never calls isolated or main clients', async () => {
      const mocks = createMockClients()

      const result = await changeAccountPassword(
        {
          currentPassword: 'ClaveActual123',
          newPassword: 'NuevaClave123',
          confirmPassword: 'NoCoincideClave',
        },
        {
          mainClient: mocks.mainClient,
          isolatedClient: mocks.isolatedClient,
        },
      )

      expect(result.ok).toBe(false)
      expect(result.error).toBe('Las contraseñas no coinciden.')
      expect(mocks.mainGetSession).not.toHaveBeenCalled()
      expect(mocks.isolatedSignInWithPassword).not.toHaveBeenCalled()
      expect(mocks.mainUpdateUser).not.toHaveBeenCalled()
    })

    it('fails gracefully when there is no active session on main client', async () => {
      const mocks = createMockClients({ sessionEmail: null })

      const result = await changeAccountPassword(
        {
          currentPassword: 'ClaveActual123',
          newPassword: 'NuevaClave123',
          confirmPassword: 'NuevaClave123',
        },
        {
          mainClient: mocks.mainClient,
          isolatedClient: mocks.isolatedClient,
        },
      )

      expect(result.ok).toBe(false)
      expect(result.error).toContain('sesión no está activa')
      expect(mocks.isolatedSignInWithPassword).not.toHaveBeenCalled()
      expect(mocks.mainUpdateUser).not.toHaveBeenCalled()
    })

    it('clave actual inválida no actualiza: invalid current credentials aborts before updateUser and signs out locally', async () => {
      const mocks = createMockClients({
        isolatedSignInError: { message: 'Invalid login credentials' },
      })

      const result = await changeAccountPassword(
        {
          currentPassword: 'ClaveErronea123',
          newPassword: 'NuevaClave123',
          confirmPassword: 'NuevaClave123',
        },
        {
          mainClient: mocks.mainClient,
          isolatedClient: mocks.isolatedClient,
        },
      )

      expect(result.ok).toBe(false)
      expect(result.error).toBe('La contraseña actual es incorrecta.')
      expect(mocks.isolatedSignInWithPassword).toHaveBeenCalledWith({
        email: 'usuario@ujap.edu.ve',
        password: 'ClaveErronea123',
      })
      // Must NOT proceed to update user
      expect(mocks.mainUpdateUser).not.toHaveBeenCalled()
      // Isolated client MUST be signed out explicitly with scope: 'local'
      expect(mocks.isolatedSignOut).toHaveBeenCalledWith({ scope: 'local' })
      expect(mocks.isolatedSignOut).not.toHaveBeenCalledWith({ scope: 'global' })
      // Main client session must be conserved
      expect(mocks.mainSignOut).not.toHaveBeenCalled()
      expect(mocks.getActiveSession()).not.toBeNull()
    })

    it('identity verification: rejects when isolated signIn user.id does not match active session user', async () => {
      const mocks = createMockClients({
        sessionUserId: 'usr-123',
        signInUser: { id: 'usr-999', email: 'usuario@ujap.edu.ve' },
      })

      const result = await changeAccountPassword(
        {
          currentPassword: 'ClaveCorrecta123',
          newPassword: 'NuevaClave123',
          confirmPassword: 'NuevaClave123',
        },
        {
          mainClient: mocks.mainClient,
          isolatedClient: mocks.isolatedClient,
        },
      )

      expect(result.ok).toBe(false)
      expect(result.error).toBe('La identidad verificada no coincide con el usuario de la sesión activa.')
      expect(mocks.mainUpdateUser).not.toHaveBeenCalled()
      expect(mocks.isolatedSignOut).toHaveBeenCalledWith({ scope: 'local' })
      expect(mocks.mainSignOut).not.toHaveBeenCalled()
      expect(mocks.getActiveSession()?.user.id).toBe('usr-123')
    })

    it('identity verification: rejects when isolated signIn user email does not match active session email', async () => {
      const mocks = createMockClients({
        sessionUserId: 'usr-123',
        sessionEmail: 'usuario@ujap.edu.ve',
        signInUser: { id: 'usr-123', email: 'otro@ujap.edu.ve' },
      })

      const result = await changeAccountPassword(
        {
          currentPassword: 'ClaveCorrecta123',
          newPassword: 'NuevaClave123',
          confirmPassword: 'NuevaClave123',
        },
        {
          mainClient: mocks.mainClient,
          isolatedClient: mocks.isolatedClient,
        },
      )

      expect(result.ok).toBe(false)
      expect(result.error).toBe('La identidad verificada no coincide con el usuario de la sesión activa.')
      expect(mocks.mainUpdateUser).not.toHaveBeenCalled()
      expect(mocks.isolatedSignOut).toHaveBeenCalledWith({ scope: 'local' })
      expect(mocks.mainSignOut).not.toHaveBeenCalled()
    })

    it('identity verification: rejects when isolated signIn returns no user data', async () => {
      const mocks = createMockClients({
        signInUser: null,
      })

      const result = await changeAccountPassword(
        {
          currentPassword: 'ClaveCorrecta123',
          newPassword: 'NuevaClave123',
          confirmPassword: 'NuevaClave123',
        },
        {
          mainClient: mocks.mainClient,
          isolatedClient: mocks.isolatedClient,
        },
      )

      expect(result.ok).toBe(false)
      expect(result.error).toBe('La identidad verificada no coincide con el usuario de la sesión activa.')
      expect(mocks.mainUpdateUser).not.toHaveBeenCalled()
    })

    it('updateUser fallido no muestra éxito: maps and returns provider error', async () => {
      const mocks = createMockClients({
        mainUpdateUserError: { message: 'New password should be different from the old password' },
      })

      const result = await changeAccountPassword(
        {
          currentPassword: 'ClaveActual123',
          newPassword: 'NuevaClave456',
          confirmPassword: 'NuevaClave456',
        },
        {
          mainClient: mocks.mainClient,
          isolatedClient: mocks.isolatedClient,
        },
      )

      expect(result.ok).toBe(false)
      expect(result.error).toBe('La nueva contraseña debe ser distinta a la actual.')
      expect(mocks.isolatedSignInWithPassword).toHaveBeenCalled()
      expect(mocks.mainUpdateUser).toHaveBeenCalledWith({ password: 'NuevaClave456' })
      expect(mocks.isolatedSignOut).toHaveBeenCalledWith({ scope: 'local' })
      expect(mocks.mainSignOut).not.toHaveBeenCalled()
    })

    it('succeeds with explicit scope: local signOut, conserving main session and updating password', async () => {
      const mocks = createMockClients()

      const result = await changeAccountPassword(
        {
          currentPassword: 'ClaveActual123',
          newPassword: 'NuevaClaveSegura123',
          confirmPassword: 'NuevaClaveSegura123',
        },
        {
          mainClient: mocks.mainClient,
          isolatedClient: mocks.isolatedClient,
        },
      )

      expect(result.ok).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.isolatedSignInWithPassword).toHaveBeenCalledWith({
        email: 'usuario@ujap.edu.ve',
        password: 'ClaveActual123',
      })
      expect(mocks.mainUpdateUser).toHaveBeenCalledWith({ password: 'NuevaClaveSegura123' })
      // Critical check: isolated client signOut is strictly scoped to 'local'
      expect(mocks.isolatedSignOut).toHaveBeenCalledWith({ scope: 'local' })
      expect(mocks.isolatedSignOut).not.toHaveBeenCalledWith({ scope: 'global' })
      expect(mocks.isolatedSignOut).not.toHaveBeenCalledWith()
      // Main client session is conserved and never signed out
      expect(mocks.mainSignOut).not.toHaveBeenCalled()
      expect(mocks.getActiveSession()).toEqual({
        user: { id: 'usr-123', email: 'usuario@ujap.edu.ve' },
      })
    })
  })

  describe('createPasswordChangeController', () => {
    it('doble envío bloqueado: prevents concurrent submissions', async () => {
      let resolveUpdate: (value: unknown) => void = () => {}
      const pendingPromise = new Promise((resolve) => {
        resolveUpdate = resolve
      })

      const mocks = createMockClients()
      mocks.mainUpdateUser.mockImplementation(async () => {
        await pendingPromise
        return { data: {}, error: null }
      })

      const controller = createPasswordChangeController({
        mainClient: mocks.mainClient,
        isolatedClient: mocks.isolatedClient,
      })

      const firstCall = controller.submit({
        currentPassword: 'ClaveActual123',
        newPassword: 'NuevaClave123',
        confirmPassword: 'NuevaClave123',
      })

      expect(controller.isInFlight()).toBe(true)

      const secondCall = await controller.submit({
        currentPassword: 'ClaveActual123',
        newPassword: 'NuevaClave123',
        confirmPassword: 'NuevaClave123',
      })

      expect(secondCall.ok).toBe(false)
      expect(secondCall.error).toContain('en curso')

      // Resolve the first call
      resolveUpdate({})
      const firstResult = await firstCall
      expect(firstResult.ok).toBe(true)
      expect(controller.isInFlight()).toBe(false)
    })

    it('éxito borra campos: triggers onSuccess callback on success', async () => {
      const mocks = createMockClients()
      const controller = createPasswordChangeController({
        mainClient: mocks.mainClient,
        isolatedClient: mocks.isolatedClient,
      })

      const formFields = {
        currentPassword: 'ClaveActual123',
        newPassword: 'NuevaClave123',
        confirmPassword: 'NuevaClave123',
      }

      let cleared = false
      const result = await controller.submit(formFields, {
        onSuccess: () => {
          formFields.currentPassword = ''
          formFields.newPassword = ''
          formFields.confirmPassword = ''
          cleared = true
        },
      })

      expect(result.ok).toBe(true)
      expect(cleared).toBe(true)
      expect(formFields.currentPassword).toBe('')
      expect(formFields.newPassword).toBe('')
      expect(formFields.confirmPassword).toBe('')
    })
  })
})
