import { getSupabaseClient } from './supabase'

const bucket = 'student-cards'
export const studentCardMaxBytes = 5 * 1024 * 1024
const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']

async function cardLocation() {
  const client = getSupabaseClient()
  const { data } = await client.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Inicia sesión para gestionar tu carnet.')
  return { client, folder: id, path: `${id}/carnet` }
}

export async function loadStudentCard(): Promise<{ url: string; updatedAt: string } | null> {
  const { client, folder, path } = await cardLocation()
  const { data, error } = await client.storage.from(bucket).list(folder, { search: 'carnet', limit: 10 })
  if (error) throw new Error('No se pudo cargar tu carnet. Inténtalo de nuevo.')
  const file = data?.find((entry) => entry.name === 'carnet')
  if (!file) return null
  const signed = await client.storage.from(bucket).createSignedUrl(path, 300)
  if (signed.error || !signed.data) throw new Error('No se pudo abrir tu carnet. Inténtalo de nuevo.')
  return { url: signed.data.signedUrl, updatedAt: file.updated_at ?? '' }
}

export async function saveStudentCard(file: File) {
  if (!acceptedTypes.includes(file.type)) throw new Error('Selecciona una imagen JPG, PNG o WebP.')
  if (file.size > studentCardMaxBytes || file.size === 0) throw new Error('La imagen debe pesar entre 1 byte y 5 MB.')
  // Decode before upload; reject corrupt files and files with a misleading MIME type.
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new Error('No se puede leer esa imagen. Selecciona otra foto.')
  bitmap.close()
  const { client, path } = await cardLocation()
  const { error } = await client.storage.from(bucket).upload(path, file, {
    upsert: true, contentType: file.type, cacheControl: '0',
  })
  if (error) throw new Error('No se pudo guardar el carnet. Conserva la imagen y vuelve a intentarlo.')
}

export async function removeStudentCard() {
  const { client, path } = await cardLocation()
  const { error } = await client.storage.from(bucket).remove([path])
  if (error) throw new Error('No se pudo eliminar el carnet. Inténtalo de nuevo.')
}
