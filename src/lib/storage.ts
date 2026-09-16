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

  const marker = `/storage/v1/object/public/${itemPhotoBucket}/`
  const markerIndex = photoUrl.indexOf(marker)
  if (markerIndex < 0) return

  const path = decodeURIComponent(photoUrl.slice(markerIndex + marker.length))
  if (!path) return

  const { error } = await getSupabaseClient().storage.from(itemPhotoBucket).remove([path])
  if (error) {
    throw new Error(error.message)
  }
}
