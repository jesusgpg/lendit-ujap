import { getSupabaseClient } from './supabase'

const bucket = 'payment-proofs'
const acceptedMimeTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])
export const paymentProofMaxBytes = 5 * 1024 * 1024

export async function uploadPaymentProof(file: File) {
  const extension = acceptedMimeTypes.get(file.type)
  if (!extension) throw new Error('El comprobante debe ser JPG, PNG o WebP.')
  if (file.size <= 0 || file.size > paymentProofMaxBytes) throw new Error('El comprobante debe pesar menos de 5 MB.')

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new Error('No se pudo leer la imagen del comprobante. Selecciona otra.')
  bitmap.close()

  const client = getSupabaseClient()
  const { data: sessionData, error: sessionError } = await client.auth.getSession()
  const userId = sessionData.session?.user.id
  if (sessionError || !userId) throw new Error('Inicia sesión para adjuntar el comprobante.')

  const path = `${userId}/payment-${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: '0',
  })
  if (error) throw new Error('No se pudo guardar el comprobante. Conserva la imagen y vuelve a intentarlo.')
  return path
}

export async function removeUnreferencedPaymentProof(path: string) {
  const client = getSupabaseClient()
  const { error } = await client.storage.from(bucket).remove([path])
  if (error) throw new Error('No se pudo retirar el comprobante sin asociar.')
}
