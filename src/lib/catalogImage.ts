import { removeCatalogImage, uploadCatalogImage } from './storage'

type Scope = 'categories' | 'schools' | 'careers'

/**
 * Comprueba si una URL de imagen está siendo utilizada por otra entidad en el catálogo
 * (categorías, escuelas o carreras) distinta a la entidad actual.
 */
export function isCatalogImageShared(
  url: string | null | undefined,
  currentEntity: { type: 'category' | 'school' | 'career'; idOrKey: string },
  catalog: {
    categories?: Array<{ key: string; imagenUrl?: string | null }>
    schools?: Array<{ id: string; imagenUrl?: string | null }>
    careers?: Array<{ id: string; imagenUrl?: string | null }>
  }
): boolean {
  if (!url) return false
  const inCategories = (catalog.categories ?? []).some(
    (c) => (currentEntity.type !== 'category' || c.key !== currentEntity.idOrKey) && c.imagenUrl === url,
  )
  if (inCategories) return true

  const inSchools = (catalog.schools ?? []).some(
    (s) => (currentEntity.type !== 'school' || s.id !== currentEntity.idOrKey) && s.imagenUrl === url,
  )
  if (inSchools) return true

  const inCareers = (catalog.careers ?? []).some(
    (cr) => (currentEntity.type !== 'career' || cr.id !== currentEntity.idOrKey) && cr.imagenUrl === url,
  )
  return inCareers
}

/**
 * Guarda una entidad con imagen siguiendo el contrato del brief:
 * 1) sube el archivo local (data URL) solo si hay uno nuevo;
 * 2) guarda la entidad; si falla, borra la subida huérfana y conserva la imagen previa;
 * 3) tras guardar, elimina la imagen anterior solo si era un archivo propio reemplazado y no compartido.
 * Devuelve `cleanupWarning` si la limpieza del archivo anterior falló (la entidad ya quedó guardada).
 */
export async function saveWithCatalogImage<T>(options: {
  scope: Scope
  previousUrl: string | null
  nextUrl: string | null
  isShared?: boolean
  save: (finalUrl: string | null) => Promise<T>
}): Promise<{ result: T; cleanupWarning: boolean }> {
  const { scope, previousUrl, nextUrl, isShared, save } = options
  let finalUrl = nextUrl
  let uploaded: string | null = null
  if (nextUrl?.startsWith('data:')) {
    uploaded = await uploadCatalogImage(nextUrl, scope)
    finalUrl = uploaded
  }
  let result: T
  try {
    result = await save(finalUrl)
  } catch (error) {
    if (uploaded) await removeCatalogImage(uploaded).catch(() => undefined)
    throw error
  }
  let cleanupWarning = false
  if (previousUrl && previousUrl !== finalUrl && !isShared) {
    try { await removeCatalogImage(previousUrl) } catch { cleanupWarning = true }
  }
  return { result, cleanupWarning }
}
