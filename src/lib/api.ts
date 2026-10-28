import { getSupabaseClient } from './supabase'

type ApiErrorPayload = {
  error?: string
  message?: string
}

const API_ERROR_MESSAGES: Record<string, string> = {
  INVALID_PROFILE: 'Revisa el nombre, apellido, teléfono y carrera antes de guardar el perfil.',
  LAST_ADMIN: 'No se puede: esta acción dejaría al sistema sin ningún administrador activo.',
  UNKNOWN_PERMISSION: 'Se envió un permiso que no existe. Recarga la página e inténtalo de nuevo.',
  SCHOOL_IN_USE: 'La escuela tiene carreras. Reasígnalas a otra escuela o retíralas primero.',
  SCHOOL_ALREADY_EXISTS: 'Ya existe una escuela con ese nombre.',
  SCHOOL_NOT_FOUND: 'La escuela ya no existe. Recarga la lista.',
  CAREER_IN_USE: 'Hay usuarios con esta carrera. Reasígnalos primero.',
  CAREER_ALREADY_EXISTS: 'Ya existe una carrera con ese nombre.',
  CAREER_NOT_FOUND: 'La carrera ya no existe. Recarga la lista.',
  CATEGORY_IN_USE: 'Hay objetos en esta categoría. Muévelos o retíralos primero.',
  CATEGORY_ALREADY_EXISTS: 'Ya existe una categoría con ese nombre.',
  CATEGORY_NOT_FOUND: 'La categoría ya no existe. Recarga la lista.',
  ROLE_IN_USE: 'Hay usuarios con este rol. Cámbiales el rol primero.',
  ROLE_PROTECTED: 'Los roles base no se pueden borrar.',
  USER_NOT_FOUND: 'El usuario ya no existe. Recarga la lista.',
  FORBIDDEN: 'No tienes permiso para esta acción.',
  EMPTY_UPDATE: 'No hay cambios que guardar.',
  UNSPLASH_NOT_CONFIGURED: 'Unsplash no está configurado en el servidor.',
  REQUEST_EXPIRED: 'La solicitud ha vencido porque la fecha de inicio ya pasó.',
  ITEM_REQUESTED_IN_RANGE: 'El objeto ya no está disponible en las fechas solicitadas.',
  INVALID_REQUEST_DATES: 'Las fechas del préstamo no son válidas o están en el pasado.',
  ITEM_NOT_AVAILABLE: 'El objeto no está disponible actualmente.',
  PAYMENT_REQUIRED: 'El solicitante debe completar el pago antes de que puedas aceptar.',
  INVALID_PAYMENT_PROFILE: 'Revisa el banco, teléfono y cédula registrados para Pago Móvil.',
  BCV_RATE_UNAVAILABLE: 'No se pudo consultar una tasa BCV vigente. Inténtalo más tarde.',
  UNSUPPORTED_PAYMENT_CURRENCY: 'La moneda de este pago no se puede convertir a bolívares.',
  INVALID_PAYMENT_DETAILS: 'Completa los datos del pago y adjunta un comprobante válido.',
  INVALID_TOP_UP_DETAILS: 'Revisa el monto, moneda y datos del pago de recarga.',
  PAYMENT_PROOF_REQUIRED: 'No pudimos validar el comprobante. Vuelve a adjuntarlo.',
  WALLET_INSUFFICIENT_FUNDS: 'Tu saldo disponible no cubre el importe de esta solicitud.',
  IDENTITY_KEY_REUSED: 'La clave de esta operación ya se utilizó con otros datos. Vuelve a intentarlo.',
  IDEMPOTENCY_KEY_REUSED: 'Esta recarga ya se procesó. Actualiza tu saldo para ver el resultado.',
  PAYMENTS_API_FAILED: 'No se pudo completar la operación. Vuelve a intentarlo.',
  PAYMENT_DESTINATION_NOT_CONFIGURED: 'La cuenta central de LendIt todavía no está configurada. No envíes un pago real.',
  NOT_A_RENTAL_REQUEST: 'Esta solicitud no requiere un pago de alquiler.',
  REQUEST_NOT_PENDING: 'La solicitud ya cambió de estado y no puede cobrarse.',
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const supabase = getSupabaseClient()
  const { data } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (data?.session?.access_token) {
    headers.set('Authorization', `Bearer ${data.session.access_token}`)
  }

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  })
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | T | null

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null
    const code = errorPayload?.error
    throw new Error((code && API_ERROR_MESSAGES[code]) ?? code ?? errorPayload?.message ?? 'No se pudo completar la solicitud.')
  }

  return payload as T
}
