import { getSupabaseClient } from './supabase'

const itemPhotoBucket = 'item-photos'

export async function uploadItemPhoto(dataUrl: string) {
  const supabase = getSupabaseClient()
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id

  if (!userId) {
    throw new Error('Inicia sesión antes de subir una foto.')
  }

  const response = await fetch(dataUrl)
  if (!response.ok) {
    throw new Error('No se pudo preparar la foto del objeto.')
  }

  const image = await response.blob()
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { data, error } = await supabase.storage.from(itemPhotoBucket).upload(path, image, {
    cacheControl: '31536000',
    contentType: 'image/jpeg',
    upsert: false,
  })

  if (error || !data?.path) {
    throw new Error(error?.message ?? 'No se pudo subir la foto del objeto.')
  }

  const { data: publicUrl } = supabase.storage.from(itemPhotoBucket).getPublicUrl(data.path)
  return publicUrl.publicUrl
}

export async function removeItemPhoto(photoUrl: string | null | undefined) {
  if (!photoUrl) return
  await removeItemPhotos([photoUrl])
}

export async function uploadItemPhotos(dataUrls: string[]): Promise<string[]> {
  const uploadedUrls: string[] = []
  const newlyUploadedFromStorage: string[] = []

  try {
    for (const urlOrData of dataUrls) {
      if (/^https?:\/\//i.test(urlOrData)) {
        uploadedUrls.push(urlOrData)
      } else {
        const uploaded = await uploadItemPhoto(urlOrData)
        uploadedUrls.push(uploaded)
        newlyUploadedFromStorage.push(uploaded)
      }
    }
    return uploadedUrls
  } catch (error) {
    if (newlyUploadedFromStorage.length > 0) {
      await removeItemPhotos(newlyUploadedFromStorage).catch(() => undefined)
    }
    throw error
  }
}

export async function removeItemPhotos(photoUrls: (string | null | undefined)[]): Promise<void> {
  const marker = `/storage/v1/object/public/${itemPhotoBucket}/`
  const paths: string[] = []

  for (const photoUrl of photoUrls) {
    if (!photoUrl) continue
    const markerIndex = photoUrl.indexOf(marker)
    if (markerIndex < 0) continue
    const path = decodeURIComponent(photoUrl.slice(markerIndex + marker.length))
    if (path && !paths.includes(path)) {
      paths.push(path)
    }
  }

  if (paths.length === 0) return

  const { error } = await getSupabaseClient().storage.from(itemPhotoBucket).remove(paths)
  if (error) {
    throw new Error(error.message)
  }
}

const catalogImageBucket = 'catalog-images'

// Sube una imagen de catálogo (data URL transitorio de un archivo local) y devuelve la URL pública.
export async function uploadCatalogImage(dataUrl: string, scope: 'categories' | 'schools' | 'careers') {
  const supabase = getSupabaseClient()
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session?.user.id) throw new Error('Inicia sesión antes de subir una imagen.')
  const response = await fetch(dataUrl)
  if (!response.ok) throw new Error('No se pudo preparar la imagen.')
  const image = await response.blob()
  if (image.size > 5 * 1024 * 1024) throw new Error('La imagen no puede pesar más de 5 MB.')
  const path = `${scope}/${crypto.randomUUID()}.jpg`
  const { data, error } = await supabase.storage.from(catalogImageBucket).upload(path, image, {
    cacheControl: '31536000', contentType: 'image/jpeg', upsert: false,
  })
  if (error || !data?.path) throw new Error(error?.message ?? 'No se pudo subir la imagen.')
  return supabase.storage.from(catalogImageBucket).getPublicUrl(data.path).data.publicUrl
}

// Solo elimina archivos propios del bucket de catálogo; nunca enlaces externos ni fotos de Unsplash.
export async function removeCatalogImage(url: string | null | undefined) {
  if (!url) return
  const marker = `/storage/v1/object/public/${catalogImageBucket}/`
  const index = url.indexOf(marker)
  if (index < 0) return
  const path = decodeURIComponent(url.slice(index + marker.length))
  const { error } = await getSupabaseClient().storage.from(catalogImageBucket).remove([path])
  if (error) throw new Error(error.message)
}
