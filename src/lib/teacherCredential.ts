import { getSupabaseClient } from './supabase'
import { apiRequest } from './api'
import type { TeacherVerification } from '../types'

const bucket = 'teacher-credentials'
export const teacherCredentialMaxBytes = 5 * 1024 * 1024
const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']

export async function loadTeacherVerification(): Promise<TeacherVerification | null> {
  const response = await apiRequest<{ ok: boolean; verification: TeacherVerification | null }>('/api/teacher-verifications/me')
  return response.verification
}

export async function uploadTeacherCredentialFile(file: File): Promise<string> {
  if (!acceptedTypes.includes(file.type)) {
    throw new Error('Selecciona una imagen JPG, PNG o WebP.')
  }
  if (file.size > teacherCredentialMaxBytes || file.size === 0) {
    throw new Error('La imagen debe pesar entre 1 byte y 5 MB.')
  }

  // Pre-upload decode verification
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) {
    throw new Error('No se puede leer la imagen seleccionada. Intenta con otra foto.')
  }
  bitmap.close()

  const client = getSupabaseClient()
  const { data } = await client.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) {
    throw new Error('Inicia sesión para subir tu credencial.')
  }

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/credential-${Date.now()}.${extension}`

  const { error } = await client.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: '0',
  })

  if (error) {
    throw new Error(`Error al guardar la credencial en el almacenamiento: ${error.message}`)
  }

  return path
}

export async function submitTeacherVerification(payload: {
  schoolId: string
  department?: string | null
  careerId?: string | null
  documentPath: string
  expectedVersion?: number
}): Promise<TeacherVerification> {
  const response = await apiRequest<{ ok: boolean; verification: TeacherVerification }>('/api/teacher-verifications/me', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return response.verification
}
