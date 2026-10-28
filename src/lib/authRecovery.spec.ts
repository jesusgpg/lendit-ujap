import { describe, expect, it, beforeEach } from 'vitest'
import {
  parseAuthCallbackParams,
  isUnauthenticatedRecoveryAttempt,
  isLegitimateRecoveryCallback,
  validateNewPassword,
  validatePasswordConfirmation,
  safeJoinUrl,
  getCooldownRemaining,
  startCooldown,
  clearCooldown,
  resolvePostAuthRoute,
} from './authRecovery'

describe('authRecovery utility suite', () => {
  describe('parseAuthCallbackParams', () => {
    it('extrae parámetros de tipo recovery desde fragmento hash', () => {
      const hash = '#access_token=test-token&refresh_token=test-refresh&type=recovery'
      const parsed = parseAuthCallbackParams(hash)
      expect(parsed.type).toBe('recovery')
      expect(parsed.accessToken).toBe('test-token')
      expect(parsed.refreshToken).toBe('test-refresh')
      expect(parsed.errorCode).toBeNull()
    })

    it('extrae errores de expiración desde fragmento hash', () => {
      const hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
      const parsed = parseAuthCallbackParams(hash)
      expect(parsed.errorCode).toBe('otp_expired')
      expect(parsed.errorDescription).toBe('Email link is invalid or has expired')
    })

    it('extrae parámetros desde query string', () => {
      const query = '?error=access_denied&error_description=Token+expired'
      const parsed = parseAuthCallbackParams(query)
      expect(parsed.errorCode).toBe('access_denied')
      expect(parsed.errorDescription).toBe('Token expired')
    })

    it('devuelve nulos para entradas vacías', () => {
      const parsed = parseAuthCallbackParams('')
      expect(parsed.type).toBeNull()
      expect(parsed.accessToken).toBeNull()
      expect(parsed.errorCode).toBeNull()
    })

    it('extrae el parámetro code de PKCE desde query string', () => {
      const query = '?code=pkce-auth-code-123'
      const parsed = parseAuthCallbackParams(query)
      expect(parsed.code).toBe('pkce-auth-code-123')
    })
  })

  describe('isUnauthenticatedRecoveryAttempt', () => {
    it('detecta intento declarativo con type=recovery pero sin token ni code', () => {
      const parsed = parseAuthCallbackParams('#type=recovery')
      expect(isUnauthenticatedRecoveryAttempt(parsed)).toBe(true)
    })

    it('rechaza falsos positivos cuando existe access_token', () => {
      const parsed = parseAuthCallbackParams('#access_token=valid-token&type=recovery')
      expect(isUnauthenticatedRecoveryAttempt(parsed)).toBe(false)
    })

    it('rechaza falsos positivos cuando existe código PKCE', () => {
      const parsed = parseAuthCallbackParams('?code=pkce-code&type=recovery')
      expect(isUnauthenticatedRecoveryAttempt(parsed)).toBe(false)
    })

    it('no marca como intento si no es tipo recovery', () => {
      const parsed = parseAuthCallbackParams('#type=signup')
      expect(isUnauthenticatedRecoveryAttempt(parsed)).toBe(false)
    })
  })

  describe('isLegitimateRecoveryCallback', () => {
    it('reconoce callback legítimo con access_token y type=recovery', () => {
      const parsed = parseAuthCallbackParams('#access_token=token-123&type=recovery')
      expect(isLegitimateRecoveryCallback(parsed)).toBe(true)
    })

    it('reconoce callback legítimo con código PKCE', () => {
      const parsed = parseAuthCallbackParams('?code=pkce-auth-code')
      expect(isLegitimateRecoveryCallback(parsed)).toBe(true)
    })

    it('invalida si viene con error del proveedor', () => {
      const parsed = parseAuthCallbackParams('#error=access_denied&error_code=otp_expired')
      expect(isLegitimateRecoveryCallback(parsed)).toBe(false)
    })

    it('invalida si no contiene ni token ni code', () => {
      const parsed = parseAuthCallbackParams('#type=recovery')
      expect(isLegitimateRecoveryCallback(parsed)).toBe(false)
    })
  })

  describe('validateNewPassword & validatePasswordConfirmation', () => {
    it('rechaza contraseñas menores a 6 caracteres', () => {
      const res = validateNewPassword('12345')
      expect(res.valid).toBe(false)
      expect(res.error).toContain('al menos 6 caracteres')
    })

    it('acepta contraseñas válidas', () => {
      const res = validateNewPassword('Valida123!')
      expect(res.valid).toBe(true)
      expect(res.error).toBeUndefined()
    })

    it('rechaza confirmación si no coincide', () => {
      const res = validatePasswordConfirmation('ClaveSegura1', 'ClaveSegura2')
      expect(res.valid).toBe(false)
      expect(res.error).toBe('Las contraseñas no coinciden.')
    })

    it('acepta coincidencia exacta', () => {
      const res = validatePasswordConfirmation('ClaveSegura1', 'ClaveSegura1')
      expect(res.valid).toBe(true)
      expect(res.error).toBeUndefined()
    })
  })

  describe('safeJoinUrl', () => {
    it('une correctamente una base con barra final', () => {
      const url = safeJoinUrl('https://lendit-ujap.vercel.app/', '/auth/reset-password')
      expect(url).toBe('https://lendit-ujap.vercel.app/auth/reset-password')
    })

    it('une correctamente una base sin barra final', () => {
      const url = safeJoinUrl('https://lendit-ujap.vercel.app', 'auth/reset-password')
      expect(url).toBe('https://lendit-ujap.vercel.app/auth/reset-password')
    })

    it('maneja localhost con puerto', () => {
      const url = safeJoinUrl('http://localhost:5173', '/auth/reset-password')
      expect(url).toBe('http://localhost:5173/auth/reset-password')
    })
  })

  describe('Cooldown helpers', () => {
    beforeEach(() => {
      clearCooldown('test-action')
    })

    it('inicia y consulta cooldown restante', () => {
      expect(getCooldownRemaining('test-action')).toBe(0)
      startCooldown('test-action')
      const remaining = getCooldownRemaining('test-action', 60)
      expect(remaining).toBeGreaterThan(50)
      expect(remaining).toBeLessThanOrEqual(60)
    })

    it('limpia el cooldown correctamente', () => {
      startCooldown('test-action')
      expect(getCooldownRemaining('test-action')).toBeGreaterThan(0)
      clearCooldown('test-action')
      expect(getCooldownRemaining('test-action')).toBe(0)
    })
  })

  describe('resolvePostAuthRoute', () => {
    it('redirige a /admin para usuarios ADMIN', () => {
      expect(resolvePostAuthRoute('ADMIN')).toBe('/admin')
    })

    it('redirige a /inicio para estudiantes', () => {
      expect(resolvePostAuthRoute('STUDENT')).toBe('/inicio')
    })

    it('redirige a /inicio para docentes', () => {
      expect(resolvePostAuthRoute('PROFESSOR', 'APPROVED')).toBe('/inicio')
    })
  })
})
