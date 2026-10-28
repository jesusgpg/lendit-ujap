import type { AuthUser } from '../types'
import { getSupabaseClient } from './supabase'
import { uploadItemPhoto } from './storage'
import { apiRequest } from './api'

export const PENDING_PHOTO_DB_NAME = 'lendit_pending_registration'
export const PENDING_PHOTO_STORE_NAME = 'pending_photos'
export const PENDING_PHOTO_DB_VERSION = 1
export const PENDING_PHOTO_TTL_MS = 24 * 60 * 60 * 1000 // 24 horas
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
export const LOCAL_STORAGE_PREFIX = 'lendit_pending_photo:'

export interface PendingRegistrationPhotoRecord {
  email: string
  dataUrl: string
  createdAt: number
  expiresAt: number
  sizeBytes: number
}

function normalizeEmail(email: string): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email.trim())
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',')
  const base64Data = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl
  return Math.round((base64Data.length * 3) / 4)
}

// Control de almacenamiento y fallback para entornos con IndexedDB bloqueado/inactivo
let storageDisabledForTesting = false
const memoryStore = new Map<string, PendingRegistrationPhotoRecord>()
const inFlightRestorations = new Map<string, Promise<AuthUser | null>>()

export function _setStorageDisabledForTesting(disabled: boolean) {
  storageDisabledForTesting = disabled
}

export function _clearMemoryStoreForTesting() {
  memoryStore.clear()
}

function getIndexedDB(): IDBFactory | null {
  try {
    if (typeof indexedDB !== 'undefined' && indexedDB !== null) {
      return indexedDB
    }
  } catch {
    // Entornos con sandbox estricto
  }
  return null
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) {
      return localStorage
    }
  } catch {
    // Entornos con cookies/storage deshabilitado
  }
  return null
}

function openDB(): Promise<IDBDatabase> {
  const idb = getIndexedDB()
  if (!idb) {
    return Promise.reject(new Error('IndexedDB no disponible.'))
  }

  return new Promise((resolve, reject) => {
    const request = idb.open(PENDING_PHOTO_DB_NAME, PENDING_PHOTO_DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(PENDING_PHOTO_STORE_NAME)) {
        db.createObjectStore(PENDING_PHOTO_STORE_NAME, { keyPath: 'email' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Error al abrir la base de datos local.'))
    request.onblocked = () => reject(new Error('Base de datos local bloqueada por otra pestaña.'))
  })
}

async function saveRecord(record: PendingRegistrationPhotoRecord): Promise<void> {
  if (storageDisabledForTesting) {
    throw new Error('El almacenamiento local del navegador no está disponible para guardar la foto temporalmente.')
  }

  let idbSuccess = false
  const idb = getIndexedDB()
  if (idb) {
    try {
      const db = await openDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PENDING_PHOTO_STORE_NAME, 'readwrite')
        const store = tx.objectStore(PENDING_PHOTO_STORE_NAME)
        const req = store.put(record)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
        tx.onabort = () => reject(tx.error ?? new Error('Transacción abortada'))
      })
      idbSuccess = true
      return
    } catch {
      // Proceder con fallback
    }
  }

  const ls = getLocalStorage()
  if (ls) {
    try {
      ls.setItem(LOCAL_STORAGE_PREFIX + record.email, JSON.stringify(record))
      return
    } catch {
      // Fallback a memoria si la cuota de localStorage falló
    }
  }

  if (!idbSuccess && !ls && typeof window === 'undefined') {
    // Entorno Node/Vitest sin DOM
    memoryStore.set(record.email, record)
    return
  }

  if (!idbSuccess && !ls) {
    throw new Error('El almacenamiento local del navegador no está disponible para guardar la foto temporalmente.')
  }

  // Si fallaron tanto IDB como LS en un navegador real con cuota llena
  memoryStore.set(record.email, record)
}

async function getRecord(email: string): Promise<PendingRegistrationPhotoRecord | null> {
  const idb = getIndexedDB()
  if (idb) {
    try {
      const db = await openDB()
      const record = await new Promise<PendingRegistrationPhotoRecord | null>((resolve, reject) => {
        const tx = db.transaction(PENDING_PHOTO_STORE_NAME, 'readonly')
        const store = tx.objectStore(PENDING_PHOTO_STORE_NAME)
        const req = store.get(email)
        req.onsuccess = () => resolve((req.result as PendingRegistrationPhotoRecord) ?? null)
        req.onerror = () => reject(req.error)
      })
      if (record) return record
    } catch {
      // Seguir al fallback
    }
  }

  const ls = getLocalStorage()
  if (ls) {
    try {
      const raw = ls.getItem(LOCAL_STORAGE_PREFIX + email)
      if (raw) {
        return JSON.parse(raw) as PendingRegistrationPhotoRecord
      }
    } catch {
      // Fallback a memoria
    }
  }

  return memoryStore.get(email) ?? null
}

async function deleteRecord(email: string): Promise<void> {
  const idb = getIndexedDB()
  if (idb) {
    try {
      const db = await openDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PENDING_PHOTO_STORE_NAME, 'readwrite')
        const store = tx.objectStore(PENDING_PHOTO_STORE_NAME)
        const req = store.delete(email)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    } catch {
      // Continuar con limpieza en otros stores
    }
  }

  const ls = getLocalStorage()
  if (ls) {
    try {
      ls.removeItem(LOCAL_STORAGE_PREFIX + email)
    } catch {
      // Ignorar error al limpiar
    }
  }

  memoryStore.delete(email)
}

async function getAllRecords(): Promise<PendingRegistrationPhotoRecord[]> {
  const recordsMap = new Map<string, PendingRegistrationPhotoRecord>()

  const idb = getIndexedDB()
  if (idb) {
    try {
      const db = await openDB()
      const list = await new Promise<PendingRegistrationPhotoRecord[]>((resolve, reject) => {
        const tx = db.transaction(PENDING_PHOTO_STORE_NAME, 'readonly')
        const store = tx.objectStore(PENDING_PHOTO_STORE_NAME)
        const req = store.getAll()
        req.onsuccess = () => resolve((req.result as PendingRegistrationPhotoRecord[]) ?? [])
        req.onerror = () => reject(req.error)
      })
      for (const rec of list) {
        recordsMap.set(rec.email, rec)
      }
    } catch {
      // Seguir al fallback
    }
  }

  const ls = getLocalStorage()
  if (ls) {
    try {
      for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i)
        if (key && key.startsWith(LOCAL_STORAGE_PREFIX)) {
          const raw = ls.getItem(key)
          if (raw) {
            const parsed = JSON.parse(raw) as PendingRegistrationPhotoRecord
            if (!recordsMap.has(parsed.email)) {
              recordsMap.set(parsed.email, parsed)
            }
          }
        }
      }
    } catch {
      // Ignorar error
    }
  }

  for (const [email, rec] of memoryStore.entries()) {
    if (!recordsMap.has(email)) {
      recordsMap.set(email, rec)
    }
  }

  return Array.from(recordsMap.values())
}

/**
 * Purga fotos pendientes cuya vigencia TTL haya expirado.
 * Devuelve el total de fotos eliminadas.
 */
export async function purgeExpiredPendingPhotos(): Promise<number> {
  const records = await getAllRecords()
  const now = Date.now()
  let purgedCount = 0

  for (const record of records) {
    if (record.expiresAt <= now) {
      await deleteRecord(record.email)
      purgedCount++
    }
  }

  return purgedCount
}

/**
 * Consulta la foto pendiente guardada en el navegador para un correo dado.
 * Devuelve null si no existe o si ya expiró (en cuyo caso la purga).
 */
export async function getPendingRegistrationPhoto(email: string): Promise<string | null> {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return null

  const record = await getRecord(normalizedEmail)
  if (!record) return null

  if (record.expiresAt <= Date.now()) {
    await deleteRecord(normalizedEmail)
    return null
  }

  return record.dataUrl
}

/**
 * Guarda temporalmente la foto de perfil en almacenamiento persistente del navegador
 * indexada por identidad (correo electrónico normalizado).
 * Valida formato data URL, límites de peso (5 MB) y limpia entradas expiradas.
 */
export async function storePendingRegistrationPhoto(email: string, dataUrl: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    throw new Error('Escribe un correo institucional válido para conservar la foto.')
  }

  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    throw new Error('La foto debe ser una imagen válida en formato data URL.')
  }

  const sizeBytes = estimateDataUrlBytes(dataUrl)
  if (sizeBytes > MAX_PHOTO_SIZE_BYTES) {
    throw new Error('La foto supera el límite máximo permitido de 5 MB.')
  }

  try {
    await purgeExpiredPendingPhotos()
  } catch {
    // Si la purga falla, continuamos con el guardado
  }

  const now = Date.now()
  const record: PendingRegistrationPhotoRecord = {
    email: normalizedEmail,
    dataUrl,
    createdAt: now,
    expiresAt: now + PENDING_PHOTO_TTL_MS,
    sizeBytes,
  }

  await saveRecord(record)
}

/**
 * Restaura y vincula la foto guardada al perfil del usuario recién confirmado.
 * 
 * Verificaciones obligatorias de seguridad y separación de identidades:
 * 1. Correo y usuario corresponden a la misma identidad normalizada.
 * 2. Existe sesión real autenticada en Supabase que coincide con el correo solicitado.
 *    NOTA DE ARQUITECTURA: session.user.id es el UUID de auth (auth.users), mientras
 *    profile.id es el UUID de negocio (public.User). Son IDs distintos y NO deben
 *    compararse entre sí.
 * 3. El usuario ya confirmó su correo electrónico.
 * 4. Si el perfil ya posee una foto activa, NUNCA la sobreescribe y purga el borrador pendiente.
 * 5. Se verifica continuamente durante el proceso asíncrono que la sesión autenticada no haya cambiado
 *    o finalizado.
 * 6. Se valida que /api/me devuelva un perfil coherente con el profile.id (business UUID) y correo.
 * 7. Si ocurre un error de red o coherencia, CONSERVA el borrador para un posterior intento.
 * 8. En éxito comprobado, elimina el borrador del almacenamiento y retorna el AuthUser actualizado.
 * 9. Evita subidas duplicadas concurrentes sobre la misma cuenta.
 */
export async function restorePendingRegistrationPhoto(
  email: string,
  profile: AuthUser,
): Promise<AuthUser | null> {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail || !profile || !profile.email || !profile.id) {
    return null
  }

  // 1. Verificar coincidencia de identidad de correo con el perfil
  if (normalizeEmail(profile.email) !== normalizedEmail) {
    return null
  }

  // 2. Si el perfil ya cuenta con foto, jamás sobreescribir y descartar el borrador pendiente
  if (profile.photo && profile.photo.trim() !== '') {
    await clearPendingRegistrationPhoto(normalizedEmail)
    return null
  }

  // 3. Comprobar sesión real en Supabase y extraer auth UUID
  const supabase = getSupabaseClient()
  const { data: sessionData } = await supabase.auth.getSession()
  const initialSession = sessionData?.session
  const initialAuthUserId = initialSession?.user?.id
  const initialSessionEmail = normalizeEmail(initialSession?.user?.email ?? '')

  if (!initialSession || !initialSession.user || !initialAuthUserId) {
    return null
  }

  if (initialSessionEmail !== normalizedEmail) {
    return null
  }

  // 4. Comprobar confirmación de correo
  const isConfirmed = Boolean(
    initialSession.user.email_confirmed_at ||
    (initialSession.user as { confirmed_at?: string | null }).confirmed_at ||
    profile.emailVerifiedAt,
  )
  if (!isConfirmed) {
    return null
  }

  // 5. Verificar si existe borrador persistente para esta cuenta
  const record = await getRecord(normalizedEmail)
  if (!record) {
    return null
  }

  // 6. Verificar expiración
  if (record.expiresAt <= Date.now()) {
    await clearPendingRegistrationPhoto(normalizedEmail)
    return null
  }

  // 7. Evitar subidas duplicadas concurrentes para el mismo correo
  if (inFlightRestorations.has(normalizedEmail)) {
    return await inFlightRestorations.get(normalizedEmail)!
  }

  const restorePromise = (async () => {
    try {
      // Guarda de seguridad: verificar que la sesión de Supabase no haya cambiado durante la operación asíncrona
      const verifySessionStable = async () => {
        const { data: currentSessionData } = await supabase.auth.getSession()
        const currentAuthId = currentSessionData?.session?.user?.id
        const currentEmail = normalizeEmail(currentSessionData?.session?.user?.email ?? '')
        if (currentAuthId !== initialAuthUserId || currentEmail !== normalizedEmail) {
          throw new Error('La sesión de usuario cambió o fue cerrada durante la restauración de la foto.')
        }
      }

      await verifySessionStable()

      // Subir la imagen mediante la utilidad de almacenamiento existente
      const photoUrl = await uploadItemPhoto(record.dataUrl)

      await verifySessionStable()

      // Actualizar perfil del usuario vía PATCH /api/me utilizando el token de la sesión activa
      const response = await apiRequest<{ ok?: boolean; user: AuthUser }>('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ photoUrl }),
      })

      await verifySessionStable()

      const serverProfile = response.user
      if (!serverProfile) {
        throw new Error('El servidor no retornó los datos actualizados del perfil.')
      }

      // Validar coherencia: el perfil retornado por /api/me debe tener el mismo business UUID y email
      if (serverProfile.id !== profile.id || normalizeEmail(serverProfile.email) !== normalizedEmail) {
        throw new Error('Incoherencia entre la sesión autenticada y el perfil de negocio a actualizar.')
      }

      // En éxito comprobado: limpiar almacenamiento persistente
      await clearPendingRegistrationPhoto(normalizedEmail)

      return serverProfile
    } catch (error) {
      // En fallo: CONSERVAR el borrador en almacenamiento (no ejecutar clear)
      throw error
    } finally {
      inFlightRestorations.delete(normalizedEmail)
    }
  })()

  inFlightRestorations.set(normalizedEmail, restorePromise)
  return await restorePromise
}

/**
 * Elimina la foto pendiente de registro asociada al correo.
 */
export async function clearPendingRegistrationPhoto(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return
  await deleteRecord(normalizedEmail)
}
