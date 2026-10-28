import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../types'
import {
  clearPendingRegistrationPhoto,
  getPendingRegistrationPhoto,
  purgeExpiredPendingPhotos,
  restorePendingRegistrationPhoto,
  storePendingRegistrationPhoto,
  _clearMemoryStoreForTesting,
  _setStorageDisabledForTesting,
} from './pendingRegistrationPhoto'

const mockGetSession = vi.hoisted(() => vi.fn())
const mockUploadItemPhoto = vi.hoisted(() => vi.fn())
const mockApiRequest = vi.hoisted(() => vi.fn())

vi.mock('./supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession,
    },
  }),
}))

vi.mock('./storage', () => ({
  uploadItemPhoto: mockUploadItemPhoto,
}))

vi.mock('./api', () => ({
  apiRequest: mockApiRequest,
}))

describe('pendingRegistrationPhoto service', () => {
  const testEmail = 'estudiante@ujap.edu.ve'
  const validDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...'

  // Distinct UUIDs: auth UUID differs strictly from business user UUID
  const authUserId = 'auth-uuid-supa-9999'
  const businessUserId = 'business-uuid-db-1111'

  const baseProfile: AuthUser = {
    id: businessUserId,
    name: 'María Pérez',
    firstName: 'María',
    lastName: 'Pérez',
    email: testEmail,
    phone: '0414-1234567',
    photo: '',
    role: 'STUDENT',
    permissions: [],
    emailVerifiedAt: '2026-10-26T20:00:00.000Z',
  }

  const validSession = {
    session: {
      user: {
        id: authUserId, // auth.users UUID
        email: testEmail,
        email_confirmed_at: '2026-10-26T20:00:00.000Z',
      },
    },
  }

  beforeEach(() => {
    _clearMemoryStoreForTesting()
    _setStorageDisabledForTesting(false)
    mockGetSession.mockReset()
    mockUploadItemPhoto.mockReset()
    mockApiRequest.mockReset()

    mockGetSession.mockResolvedValue({ data: validSession, error: null })
  })

  describe('storePendingRegistrationPhoto', () => {
    it('almacena una foto válida con correo normalizado', async () => {
      await storePendingRegistrationPhoto('  ESTUDIANTE@UJAP.EDU.VE ', validDataUrl)
      const stored = await getPendingRegistrationPhoto(testEmail)
      expect(stored).toBe(validDataUrl)
    })

    it('rechaza correos inválidos con mensaje descriptivo', async () => {
      await expect(storePendingRegistrationPhoto('correo-invalido', validDataUrl)).rejects.toThrow(
        'Escribe un correo institucional válido',
      )
    })

    it('rechaza datos que no sean una imagen data URL', async () => {
      await expect(storePendingRegistrationPhoto(testEmail, 'https://example.com/foto.jpg')).rejects.toThrow(
        'La foto debe ser una imagen válida en formato data URL.',
      )
    })

    it('rechaza fotos que superen el límite de 5 MB', async () => {
      const oversizedData = 'data:image/jpeg;base64,' + 'A'.repeat(7 * 1024 * 1024)
      await expect(storePendingRegistrationPhoto(testEmail, oversizedData)).rejects.toThrow(
        'La foto supera el límite máximo permitido de 5 MB.',
      )
    })

    it('almacenamiento no disponible da feedback útil', async () => {
      _setStorageDisabledForTesting(true)
      await expect(storePendingRegistrationPhoto(testEmail, validDataUrl)).rejects.toThrow(
        'El almacenamiento local del navegador no está disponible para guardar la foto temporalmente.',
      )
    })

    it('interactúa correctamente con la API de IndexedDB del navegador', async () => {
      const mockIDBStore = new Map<string, any>()
      const fakeIDB = {
        open: vi.fn(() => {
          const req: any = {
            result: {
              objectStoreNames: { contains: () => true },
              createObjectStore: vi.fn(),
              transaction: () => ({
                objectStore: () => ({
                  put: (item: any) => {
                    mockIDBStore.set(item.email, item)
                    const putReq: any = {}
                    setTimeout(() => putReq.onsuccess?.({ target: putReq }), 0)
                    return putReq
                  },
                  get: (key: string) => {
                    const getReq: any = { result: mockIDBStore.get(key) }
                    setTimeout(() => getReq.onsuccess?.({ target: getReq }), 0)
                    return getReq
                  },
                  delete: (key: string) => {
                    mockIDBStore.delete(key)
                    const delReq: any = {}
                    setTimeout(() => delReq.onsuccess?.({ target: delReq }), 0)
                    return delReq
                  },
                  getAll: () => {
                    const allReq: any = { result: Array.from(mockIDBStore.values()) }
                    setTimeout(() => allReq.onsuccess?.({ target: allReq }), 0)
                    return allReq
                  },
                }),
              }),
            },
          }
          setTimeout(() => req.onsuccess?.({ target: req }), 0)
          return req
        }),
      }

      vi.stubGlobal('indexedDB', fakeIDB)

      await storePendingRegistrationPhoto('idb-user@ujap.edu.ve', validDataUrl)
      expect(fakeIDB.open).toHaveBeenCalled()
      expect(mockIDBStore.has('idb-user@ujap.edu.ve')).toBe(true)

      const retrieved = await getPendingRegistrationPhoto('idb-user@ujap.edu.ve')
      expect(retrieved).toBe(validDataUrl)

      await clearPendingRegistrationPhoto('idb-user@ujap.edu.ve')
      expect(mockIDBStore.has('idb-user@ujap.edu.ve')).toBe(false)

      vi.unstubAllGlobals()
    })
  })

  describe('restorePendingRegistrationPhoto', () => {
    it('restaura con éxito separando auth UUID y business UUID realistamente', async () => {
      await storePendingRegistrationPhoto(testEmail, validDataUrl)
      const uploadedUrl = 'https://storage.supabase.co/v1/object/public/item-photos/user/avatar.jpg'

      mockUploadItemPhoto.mockResolvedValueOnce(uploadedUrl)
      // /api/me responde con el business UUID (distinto al auth UUID)
      mockApiRequest.mockResolvedValueOnce({
        ok: true,
        user: { ...baseProfile, id: businessUserId, photo: uploadedUrl },
      })

      const updated = await restorePendingRegistrationPhoto(testEmail, baseProfile)

      expect(mockUploadItemPhoto).toHaveBeenCalledWith(validDataUrl)
      expect(mockApiRequest).toHaveBeenCalledWith('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ photoUrl: uploadedUrl }),
      })
      expect(updated?.id).toBe(businessUserId)
      expect(updated?.photo).toBe(uploadedUrl)

      // Verifica que el borrador fue eliminado del almacenamiento
      const remaining = await getPendingRegistrationPhoto(testEmail)
      expect(remaining).toBeNull()
    })

    it('bloquea y conserva borrador si /api/me devuelve un business UUID incoherente', async () => {
      await storePendingRegistrationPhoto(testEmail, validDataUrl)
      const uploadedUrl = 'https://storage.supabase.co/v1/object/public/item-photos/user/avatar.jpg'

      mockUploadItemPhoto.mockResolvedValueOnce(uploadedUrl)
      // Respuesta del servidor con un ID de negocio no coincidente
      mockApiRequest.mockResolvedValueOnce({
        ok: true,
        user: { ...baseProfile, id: 'business-uuid-mismatch-999', photo: uploadedUrl },
      })

      await expect(restorePendingRegistrationPhoto(testEmail, baseProfile)).rejects.toThrow(
        'Incoherencia entre la sesión autenticada y el perfil de negocio a actualizar.',
      )

      // Conserva el borrador en almacenamiento
      const remaining = await getPendingRegistrationPhoto(testEmail)
      expect(remaining).toBe(validDataUrl)
    })

    it('previene y bloquea cambios de sesión durante el proceso asíncrono', async () => {
      await storePendingRegistrationPhoto(testEmail, validDataUrl)
      const uploadedUrl = 'https://storage.supabase.co/v1/object/public/item-photos/user/avatar.jpg'

      mockUploadItemPhoto.mockImplementation(async () => {
        // Simular que durante la subida, la sesión cambia a otro usuario o se cierra
        mockGetSession.mockResolvedValue({
          data: {
            session: {
              user: {
                id: 'other-auth-user',
                email: 'otro@ujap.edu.ve',
                email_confirmed_at: '2026-10-26T20:00:00.000Z',
              },
            },
          },
          error: null,
        })
        return uploadedUrl
      })

      await expect(restorePendingRegistrationPhoto(testEmail, baseProfile)).rejects.toThrow(
        'La sesión de usuario cambió o fue cerrada durante la restauración de la foto.',
      )

      // El borrador original queda preservado
      expect(await getPendingRegistrationPhoto(testEmail)).toBe(validDataUrl)
    })

    it('cuenta distinta no sube y devuelve null', async () => {
      await storePendingRegistrationPhoto(testEmail, validDataUrl)

      // Intento de restaurar para otra cuenta
      const otherProfile: AuthUser = {
        ...baseProfile,
        id: 'other-user-uuid',
        email: 'otro@ujap.edu.ve',
      }

      const result = await restorePendingRegistrationPhoto('otro@ujap.edu.ve', otherProfile)

      expect(result).toBeNull()
      expect(mockUploadItemPhoto).not.toHaveBeenCalled()
      // El borrador del usuario original permanece intacto
      expect(await getPendingRegistrationPhoto(testEmail)).toBe(validDataUrl)
    })

    it('identidad cruzada entre parámetro email y profile devuelve null', async () => {
      await storePendingRegistrationPhoto(testEmail, validDataUrl)

      const result = await restorePendingRegistrationPhoto('otro@ujap.edu.ve', baseProfile)
      expect(result).toBeNull()
      expect(mockUploadItemPhoto).not.toHaveBeenCalled()
    })

    it('sesión con correo no coincidente devuelve null sin subir', async () => {
      await storePendingRegistrationPhoto(testEmail, validDataUrl)

      // Sesión de un usuario diferente
      mockGetSession.mockResolvedValueOnce({
        data: {
          session: {
            user: {
              id: 'unauthorized-user-id',
              email: 'hacker@ujap.edu.ve',
              email_confirmed_at: '2026-10-26T20:00:00.000Z',
            },
          },
        },
        error: null,
      })

      const result = await restorePendingRegistrationPhoto(testEmail, baseProfile)
      expect(result).toBeNull()
      expect(mockUploadItemPhoto).not.toHaveBeenCalled()
      expect(await getPendingRegistrationPhoto(testEmail)).toBe(validDataUrl)
    })

    it('usuario no confirmado devuelve null sin subir', async () => {
      await storePendingRegistrationPhoto(testEmail, validDataUrl)

      mockGetSession.mockResolvedValueOnce({
        data: {
          session: {
            user: {
              id: authUserId,
              email: testEmail,
              email_confirmed_at: null, // No confirmado
            },
          },
        },
        error: null,
      })

      const unconfirmedProfile: AuthUser = {
        ...baseProfile,
        emailVerifiedAt: null,
      }

      const result = await restorePendingRegistrationPhoto(testEmail, unconfirmedProfile)
      expect(result).toBeNull()
      expect(mockUploadItemPhoto).not.toHaveBeenCalled()
    })

    it('foto existente no sobrescribe y limpia el borrador pendiente', async () => {
      await storePendingRegistrationPhoto(testEmail, validDataUrl)

      const profileWithPhoto: AuthUser = {
        ...baseProfile,
        photo: 'https://example.com/existing-avatar.jpg',
      }

      const result = await restorePendingRegistrationPhoto(testEmail, profileWithPhoto)

      expect(result).toBeNull()
      expect(mockUploadItemPhoto).not.toHaveBeenCalled()
      expect(mockApiRequest).not.toHaveBeenCalled()

      // El borrador pendiente se limpia para no acumular basura
      expect(await getPendingRegistrationPhoto(testEmail)).toBeNull()
    })

    it('expiración elimina el borrador y devuelve null', async () => {
      await storePendingRegistrationPhoto(testEmail, validDataUrl)

      // Avanzamos el reloj a más de 24 horas después
      const futureTime = Date.now() + 25 * 60 * 60 * 1000
      vi.spyOn(Date, 'now').mockReturnValue(futureTime)

      const result = await restorePendingRegistrationPhoto(testEmail, baseProfile)

      expect(result).toBeNull()
      expect(mockUploadItemPhoto).not.toHaveBeenCalled()
      expect(await getPendingRegistrationPhoto(testEmail)).toBeNull()

      vi.restoreAllMocks()
    })

    it('error de red o servidor conserva borrador para reintento posterior', async () => {
      await storePendingRegistrationPhoto(testEmail, validDataUrl)

      mockUploadItemPhoto.mockRejectedValueOnce(new Error('Fallo de conexión'))

      await expect(restorePendingRegistrationPhoto(testEmail, baseProfile)).rejects.toThrow('Fallo de conexión')

      // ¡El borrador debe conservarse en almacenamiento!
      const preserved = await getPendingRegistrationPhoto(testEmail)
      expect(preserved).toBe(validDataUrl)
    })

    it('evita subidas duplicadas concurrentes sobre la misma cuenta', async () => {
      await storePendingRegistrationPhoto(testEmail, validDataUrl)
      const uploadedUrl = 'https://storage.supabase.co/v1/object/public/item-photos/user/avatar.jpg'

      let resolveUpload: (url: string) => void
      const slowUpload = new Promise<string>((resolve) => {
        resolveUpload = resolve
      })

      mockUploadItemPhoto.mockReturnValueOnce(slowUpload)
      mockApiRequest.mockResolvedValue({
        ok: true,
        user: { ...baseProfile, photo: uploadedUrl },
      })

      // Dos invocaciones casi simultáneas
      const firstCall = restorePendingRegistrationPhoto(testEmail, baseProfile)
      const secondCall = restorePendingRegistrationPhoto(testEmail, baseProfile)

      // Desbloquear la subida
      resolveUpload!(uploadedUrl)

      const [res1, res2] = await Promise.all([firstCall, secondCall])

      expect(mockUploadItemPhoto).toHaveBeenCalledTimes(1)
      expect(res1?.photo).toBe(uploadedUrl)
      expect(res2?.photo).toBe(uploadedUrl)
    })
  })

  describe('clearPendingRegistrationPhoto & purgeExpiredPendingPhotos', () => {
    it('elimina la foto de registro del correo especificado', async () => {
      await storePendingRegistrationPhoto(testEmail, validDataUrl)
      expect(await getPendingRegistrationPhoto(testEmail)).toBe(validDataUrl)

      await clearPendingRegistrationPhoto(testEmail)
      expect(await getPendingRegistrationPhoto(testEmail)).toBeNull()
    })

    it('purga registros expirados conservando los vigentes', async () => {
      const now = Date.now()
      vi.spyOn(Date, 'now').mockReturnValue(now)

      await storePendingRegistrationPhoto('activo@ujap.edu.ve', validDataUrl)

      // Guardar uno viejo simulando tiempo pasado
      vi.spyOn(Date, 'now').mockReturnValue(now - 30 * 60 * 60 * 1000)
      await storePendingRegistrationPhoto('viejo@ujap.edu.ve', validDataUrl)

      // Regresar al presente
      vi.spyOn(Date, 'now').mockReturnValue(now)

      const purged = await purgeExpiredPendingPhotos()
      expect(purged).toBe(1)
      expect(await getPendingRegistrationPhoto('activo@ujap.edu.ve')).toBe(validDataUrl)
      expect(await getPendingRegistrationPhoto('viejo@ujap.edu.ve')).toBeNull()

      vi.restoreAllMocks()
    })
  })
})
