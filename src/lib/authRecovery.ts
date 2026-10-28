/**
 * Utilidades puras para recuperación de contraseña, confirmación de correo
 * y gestión de parámetros de redirección de autenticación.
 */

export interface ParsedAuthCallback {
  type: string | null
  accessToken: string | null
  refreshToken: string | null
  errorCode: string | null
  errorDescription: string | null
  code: string | null
}

/**
 * Parsea tanto fragmentos de hash (#access_token=...&type=recovery) como
 * query strings (?code=... o ?error=...) generados por Supabase Auth.
 */
export function parseAuthCallbackParams(rawUrlOrSearchOrHash: string): ParsedAuthCallback {
  const result: ParsedAuthCallback = {
    type: null,
    accessToken: null,
    refreshToken: null,
    errorCode: null,
    errorDescription: null,
    code: null,
  }

  if (!rawUrlOrSearchOrHash) {
    return result
  }

  // Extraer partes de hash y de query
  let hashPart = ''
  let queryPart = ''

  if (rawUrlOrSearchOrHash.includes('#')) {
    const afterHash = rawUrlOrSearchOrHash.split('#')[1] ?? ''
    hashPart = afterHash.split('?')[0] ?? ''
  }

  if (rawUrlOrSearchOrHash.includes('?')) {
    const querySection = rawUrlOrSearchOrHash.split('?')[1] ?? ''
    queryPart = querySection.split('#')[0] ?? ''
  }

  // Si se pasó directamente una cadena tipo "access_token=...&type=..."
  if (!rawUrlOrSearchOrHash.includes('?') && !rawUrlOrSearchOrHash.includes('#') && rawUrlOrSearchOrHash.includes('=')) {
    hashPart = rawUrlOrSearchOrHash
  }

  const parseParams = (str: string) => {
    const params = new URLSearchParams(str)
    if (!result.type && params.get('type')) result.type = params.get('type')
    if (!result.accessToken && params.get('access_token')) result.accessToken = params.get('access_token')
    if (!result.refreshToken && params.get('refresh_token')) result.refreshToken = params.get('refresh_token')
    if (!result.code && params.get('code')) result.code = params.get('code')
    if (!result.errorCode && (params.get('error_code') || params.get('error'))) {
      result.errorCode = params.get('error_code') || params.get('error')
    }
    if (!result.errorDescription && params.get('error_description')) {
      result.errorDescription = decodeURIComponent(params.get('error_description')!.replace(/\+/g, ' '))
    }
  }

  if (hashPart) parseParams(hashPart)
  if (queryPart) parseParams(queryPart)

  return result
}

/**
 * Valida si los parámetros representan un intento declarativo no autenticado
 * (por ejemplo type=recovery sin access_token ni código PKCE).
 */
export function isUnauthenticatedRecoveryAttempt(callback: ParsedAuthCallback): boolean {
  if (callback.type === 'recovery' && !callback.accessToken && !callback.code) {
    return true
  }
  return false
}

/**
 * Determina si los parámetros corresponden a un callback legítimo de recuperación.
 */
export function isLegitimateRecoveryCallback(callback: ParsedAuthCallback): boolean {
  if (callback.errorCode) return false
  if (callback.type === 'recovery' && Boolean(callback.accessToken)) return true
  if (Boolean(callback.code)) return true
  return false
}

/**
 * Valida la longitud y robustez mínima de la contraseña según la política de LendIt.
 */
export function validateNewPassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.trim().length === 0) {
    return { valid: false, error: 'Escribe tu nueva contraseña.' }
  }
  if (password.length < 6) {
    return { valid: false, error: 'La contraseña debe tener al menos 6 caracteres.' }
  }
  if (password.length > 72) {
    return { valid: false, error: 'La contraseña no puede exceder 72 caracteres.' }
  }
  return { valid: true }
}

/**
 * Valida que la contraseña y su confirmación coincidan.
 */
export function validatePasswordConfirmation(password: string, confirmation: string): { valid: boolean; error?: string } {
  const base = validateNewPassword(password)
  if (!base.valid) {
    return base
  }
  if (password !== confirmation) {
    return { valid: false, error: 'Las contraseñas no coinciden.' }
  }
  return { valid: true }
}

/**
 * Une una URL base con una ruta relativa de manera segura sin dobles barras ni pérdidas de origen.
 */
export function safeJoinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, '')
  const normalizedPath = '/' + path.trim().replace(/^\/+/, '')
  try {
    const parsed = new URL(normalizedPath, normalizedBase)
    return parsed.toString()
  } catch {
    return `${normalizedBase}${normalizedPath}`
  }
}

const DEFAULT_COOLDOWN_SECONDS = 60
const memoryCooldowns = new Map<string, number>()

/**
 * Consulta cuántos segundos restan de cooldown para una acción identificada por clave.
 */
export function getCooldownRemaining(key: string, cooldownSeconds = DEFAULT_COOLDOWN_SECONDS): number {
  let timestamp: number | null = null

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const storageKey = `lendit_cooldown_${key}`
      const val = window.sessionStorage.getItem(storageKey)
      if (val) timestamp = parseInt(val, 10)
    } catch {
      // fallback a memoria
    }
  }

  if (timestamp === null || isNaN(timestamp)) {
    timestamp = memoryCooldowns.get(key) ?? null
  }

  if (!timestamp) return 0

  const elapsed = Math.floor((Date.now() - timestamp) / 1000)
  const remaining = cooldownSeconds - elapsed
  return remaining > 0 ? remaining : 0
}

/**
 * Inicia el cooldown en sessionStorage o memoria.
 */
export function startCooldown(key: string): void {
  const now = Date.now()
  memoryCooldowns.set(key, now)

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(`lendit_cooldown_${key}`, now.toString())
    } catch {
      // memoria ya guarda el dato
    }
  }
}

/**
 * Limpia el cooldown para pruebas o tras un éxito de sesión.
 */
export function clearCooldown(key: string): void {
  memoryCooldowns.delete(key)

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(`lendit_cooldown_${key}`)
    } catch {
      // ignorar
    }
  }
}

/**
 * Resuelve la ruta adecuada según el rol y estado del perfil.
 */
export function resolvePostAuthRoute(role?: string | null, teacherStatus?: string | null): string {
  if (role === 'ADMIN') {
    return '/admin'
  }
  if (role === 'PROFESSOR' && teacherStatus && teacherStatus !== 'APPROVED') {
    return '/inicio'
  }
  return '/inicio'
}
