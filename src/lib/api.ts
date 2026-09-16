import { getSupabaseClient } from './supabase'

type ApiErrorPayload = {
  error?: string
  message?: string
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
    throw new Error(errorPayload?.error ?? errorPayload?.message ?? 'No se pudo completar la solicitud.')
  }

  return payload as T
}
