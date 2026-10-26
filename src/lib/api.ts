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
  PAYMENT_REQUIRED: 'El solicitante debe completar el pago simulado antes de que puedas aceptar.',
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
