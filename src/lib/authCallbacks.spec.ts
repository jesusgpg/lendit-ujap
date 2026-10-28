import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { verifyEmailConfirmation, verifyRecoverySession } from './authCallbacks'

function client(options: { session?: boolean; confirmed?: boolean; verifiedId?: string } = {}) {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: options.session === false ? null : { user: { id: 'auth-id' } } }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: options.verifiedId ?? 'auth-id', email_confirmed_at: options.confirmed === false ? null : '2026-10-26T12:00:00Z' } }, error: null }),
  }
  return { provider: { auth } as unknown as SupabaseClient, auth }
}

describe('provider-verified auth callbacks', () => {
  it('rechaza recuperación ordinaria sin evento vinculado a identidad', async () => {
    const c = client()
    await expect(verifyRecoverySession(c.provider, null)).rejects.toThrow('autorizada')
    expect(c.auth.getUser).not.toHaveBeenCalled()
  })
  it('rechaza recuperación cuando la sesión ya terminó', async () => {
    await expect(verifyRecoverySession(client({ session: false }).provider, 'auth-id')).rejects.toThrow('terminó')
  })
  it('rechaza identidad que el proveedor no puede validar', async () => {
    await expect(verifyRecoverySession(client({ verifiedId: 'other' }).provider, 'auth-id')).rejects.toThrow('válida')
  })
  it('acepta recuperación con identidad y sesión verificadas', async () => {
    expect((await verifyRecoverySession(client().provider, 'auth-id')).user.id).toBe('auth-id')
  })
  it('confirmación sin sesión no sincroniza ni anuncia éxito', async () => {
    const sync = vi.fn()
    await expect(verifyEmailConfirmation(client({ session: false }).provider, sync)).rejects.toThrow('confirmada')
    expect(sync).not.toHaveBeenCalled()
  })
  it('correo sin confirmar no se confunde con confirmación válida', async () => {
    const sync = vi.fn()
    await expect(verifyEmailConfirmation(client({ confirmed: false }).provider, sync)).rejects.toThrow('confirmación')
    expect(sync).not.toHaveBeenCalled()
  })
  it('fallo de sincronización de perfil no se transforma en éxito', async () => {
    const sync = vi.fn().mockRejectedValue(new Error('Perfil no disponible'))
    await expect(verifyEmailConfirmation(client().provider, sync)).rejects.toThrow('Perfil no disponible')
  })
  it('confirmación válida sincroniza perfil antes de completar', async () => {
    const sync = vi.fn().mockResolvedValue(undefined)
    await verifyEmailConfirmation(client().provider, sync)
    expect(sync).toHaveBeenCalledWith(expect.objectContaining({ user: { id: 'auth-id' } }))
  })
})
