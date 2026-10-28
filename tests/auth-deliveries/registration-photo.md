# Entrega Sección C — Foto Pendiente de Registro y Accesibilidad

- **Fecha:** 2026-10-26 (Revisión: Separación estricta de Auth UUID vs Business UUID y estabilidad de sesión)
- **Agente:** C (Foto de Registro y Accesibilidad)
- **Alcance de archivos propios:**
  - `src/lib/pendingRegistrationPhoto.ts` (servicio corregido)
  - `src/lib/pendingRegistrationPhoto.spec.ts` (pruebas unitarias deterministas con UUIDs realistas)
  - `src/components/PhotoDropzone.vue` (prop de etiqueta contextual accesible, preservando objetos y multiimagen)
  - `src/components/RegisterForm.vue` (etiquetado accesible, ayuda de persistencia temporal y aviso de confirmación con enlace a `/auth/confirmacion`)
  - `tests/auth-deliveries/registration-photo.md` (reporte de entrega para integración del Agente A)

---

## 1. Resumen y límites de propiedad

En estricto cumplimiento de `AGENTS.md` y `docs/auth-parallel-implementation-brief.md`:
- **Archivos editados:** únicamente `src/components/PhotoDropzone.vue` (soporte de etiqueta contextual accesible) y `src/components/RegisterForm.vue`.
- **Archivos creados/actualizados:** `src/lib/pendingRegistrationPhoto.ts`, `src/lib/pendingRegistrationPhoto.spec.ts` y este reporte `tests/auth-deliveries/registration-photo.md`.
- **Archivos respetados (sin invasión ni edición):** `src/stores/auth.ts`, `src/router/index.ts`, `src/main.ts`, `src/components/LoginForm.vue`, `src/views/AccountView.vue`, `src/components/AccountSecurityPanel.vue`, `package.json`, `pnpm-lock.yaml`, `.gitignore`, `contracts/`, `tests/api/` y scripts OpenAPI/Supertest.
- **Sin nuevas dependencias:** Toda la implementación de almacenamiento y sincronización utiliza APIs web nativas y utilidades existentes del proyecto (`apiRequest`, `uploadItemPhoto`, `getSupabaseClient`).

---

## 2. Corrección Arquitectónica: Separación de Auth UUID y Business UUID

### Diagnóstico del error corregido
En la versión inicial, `restorePendingRegistrationPhoto` comparaba erróneamente:
```typescript
if (session.user.id !== profile.id) return null
```
En la arquitectura de LendIt UJAP:
- `session.user.id` corresponde a `auth.users.id` (generado por Supabase Auth).
- `profile.id` corresponde a `public.User.id` (generado por PostgreSQL/Prisma).
Son **dos UUIDs completamente distintos** para el mismo usuario. Compararlos directamente provocaba que la foto nunca se restaurara en usuarios reales, error que quedaba oculto en mocks donde ambos IDs eran idénticos.

### Solución implementada sin inventar campos en tipos
1. **Identificación y autorización mediante sesión activa:**
   - Se extrae el `initialAuthUserId` (`session.user.id`) y el correo normalizado de la sesión (`session.user.email`).
   - Se valida que el correo de la sesión coincida exactamente con el parámetro `email` y con `profile.email`.
   - Se valida que el usuario esté confirmado (`session.user.email_confirmed_at` o `profile.emailVerifiedAt`).
2. **Prevención de cambios de sesión durante llamadas asíncronas:**
   - Durante la operación asíncrona (`uploadItemPhoto` y `PATCH /api/me`), se verifica que la sesión de Supabase no haya cambiado de usuario (`currentAuthId !== initialAuthUserId`) ni se haya deslogueado.
   - Si la sesión muta o se cierra en medio del proceso, la operación se cancela lanzando error y **se preserva el borrador en el almacenamiento** para evitar pérdidas o contaminación cruzada.
3. **Validación de coherencia con `/api/me`:**
   - La llamada `PATCH /api/me` envía el token Bearer de la sesión autenticada.
   - El backend mapea internamente `authUserId` a la fila `public.User` y retorna el objeto `user: AuthUser` de negocio.
   - El servicio valida explícitamente:
     ```typescript
     if (serverProfile.id !== profile.id || normalizeEmail(serverProfile.email) !== normalizedEmail) {
       throw new Error('Incoherencia entre la sesión autenticada y el perfil de negocio a actualizar.')
     }
     ```
   - Solo tras validar que el perfil devuelto por el servidor tiene el mismo `profile.id` (business UUID) y el mismo correo institucional, se elimina el borrador temporal y se retorna el usuario actualizado.

---

## 3. Contrato de Servicio (`src/lib/pendingRegistrationPhoto.ts`)

```typescript
export async function storePendingRegistrationPhoto(email: string, dataUrl: string): Promise<void>
export async function restorePendingRegistrationPhoto(email: string, profile: AuthUser): Promise<AuthUser | null>
export async function clearPendingRegistrationPhoto(email: string): Promise<void>
```

Adicionalmente, se exportan funciones de apoyo útiles:
- `getPendingRegistrationPhoto(email: string): Promise<string | null>`
- `purgeExpiredPendingPhotos(): Promise<number>`

### Guía de integración para el Agente A en `src/stores/auth.ts`

El Agente A (único escritor autorizado del store de auth) puede integrar el servicio de la siguiente manera:

1. **Guardado en `register(input)`:**
   Cuando `supabase.auth.signUp` indique que se requiere confirmación por correo (`!data.session`), si el usuario proporcionó una foto (`input.photo`), guardar el borrador antes de devolver la respuesta:
   ```typescript
   import { storePendingRegistrationPhoto, restorePendingRegistrationPhoto } from '../lib/pendingRegistrationPhoto'

   // Dentro de register(), tras signUp exitoso que requiera confirmación:
   if (input.photo) {
     await storePendingRegistrationPhoto(input.email, input.photo)
   }
   return { ok: true, requiresEmailConfirmation: true }
   ```

2. **Restauración en `syncProfile(session)`:**
   Tras sincronizar el perfil con backend y validar la sesión activa, si el perfil no cuenta con foto (`!this.user.photo`), intentar la restauración:
   ```typescript
   if (this.user && !this.user.photo && session.user?.email) {
     try {
       const updatedUser = await restorePendingRegistrationPhoto(session.user.email, this.user)
       if (updatedUser) {
         this.user = updatedUser
       }
     } catch (err) {
       // Si ocurre fallo de red o servidor, el borrador se conserva en el navegador
       // para un posterior intento sin interrumpir el inicio de sesión.
     }
   }
   ```

3. **Garantías de seguridad del contrato:**
   - Si `profile.photo` ya tiene una imagen, `restorePendingRegistrationPhoto` **nunca sobrescribe** la foto existente y purga el borrador obsoleto para no dejar basura.
   - Si la cuenta no coincide o la sesión activa no está confirmada, devuelve `null` sin realizar subidas.
   - En caso de fallo de red al subir la imagen a Supabase Storage o al actualizar `/api/me`, la función lanza el error y **conserva intacto el borrador en el almacenamiento** para el siguiente intento.
   - Evita subidas duplicadas si se ejecutan múltiples llamadas concurrentes sobre el mismo correo mediante un mapa de promesas en vuelo.

---

## 4. Almacenamiento Persistente y Reglas de Ciclo de Vida

- **Motor principal:** IndexedDB (`lendit_pending_registration`, almacén `pending_photos`, clave primaria `email`).
  - Permite sobrevivir al clic de confirmación cuando el usuario abre el enlace desde su correo en una pestaña nueva del mismo navegador.
- **Mecanismos de respaldo:**
  - `localStorage` con prefijo `lendit_pending_photo:` en caso de navegadores con IndexedDB restringido.
  - Almacén en memoria para entornos de prueba headless sin DOM ni almacenamiento global.
  - Si el almacenamiento está completamente bloqueado o no disponible, lanza un error con mensaje amigable: `"El almacenamiento local del navegador no está disponible para guardar la foto temporalmente."`
- **Aislamiento por identidad:**
  - Todas las operaciones normalizan el correo (`email.trim().toLowerCase()`).
  - Las fotos de un correo jamás son accesibles ni vinculadas a otra cuenta.
- **TTL y límites:**
  - **TTL:** 24 horas (`PENDING_PHOTO_TTL_MS = 24 * 60 * 60 * 1000`).
  - **Límite de tamaño:** 5 MB (`MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024`). Valida que el formato sea un data URL de imagen (`data:image/*`).
  - **Purga automática:** Al guardar fotos o al intentar restaurar registros vencidos, se purgan automáticamente las entradas con más de 24 horas.
- **Higiene de seguridad:**
  - No se almacena la foto en metadatos de usuario ni en tokens JWT (evitando desbordamiento de cabeceras HTTP de autorización).
  - Nunca se almacenan contraseñas en el servicio de fotos.

---

## 5. Accesibilidad y Experiencia de Usuario (`RegisterForm.vue` y `PhotoDropzone.vue`)

1. **`PhotoDropzone.vue`:**
   - Se añadió la propiedad opcional `ariaLabel?: string`.
   - Se configuraron nombres accesibles dinámicos para lectores de pantalla (`Subir foto de perfil para el carnet`, `Cambiar foto de perfil para el carnet`).
   - Se añadieron atributos `:aria-label` en el botón interactivo de reemplazo y en el `input[type="file"]`.
   - **Preservación total:** Los valores por defecto (`alt: 'Foto del objeto'`, `multiple: false`, `maxFiles: 8`) y el comportamiento para publicación de objetos se mantienen 100% idénticos e intactos.

2. **`RegisterForm.vue`:**
   - La sección de foto cuenta ahora con etiqueta contextual asociada (`#register-photo-label`) y texto de ayuda explicativo (`#photo-persistence-help`).
   - Al requerirse confirmación de correo institucional tras el registro, se presenta un panel informativo accesible (`role="status"`, `aria-live="polite"`), utilizando los tokens visuales del sistema (`var(--navy-bg)`, `var(--navy-2)`, `var(--navy)`, `var(--ink)`):
     - Muestra el correo institucional registrado.
     - Confirma que la foto está resguardada de forma segura en el navegador.
     - Proporciona un enlace directo a `/auth/confirmacion` para usuarios que necesiten reenviar el correo, sin competir con la lógica de confirmación del Agente A.

---

## 6. Pruebas Unitarias y Verificación Determinista

Se desarrolló una suite completa en `src/lib/pendingRegistrationPhoto.spec.ts` con 19 pruebas unitarias deterministas:

- **Casos de prueba destacados:**
  - **Auth UUID vs Business UUID:** Configurados intencionalmente como UUIDs completamente diferentes (`auth-uuid-supa-9999` vs `business-uuid-db-1111`), verificando la restauración exitosa y coherente.
  - **Incoherencia de Business UUID en `/api/me`:** Si el backend responde con un `user.id` no coincidente, la operación falla y el borrador se conserva en almacenamiento.
  - **Cambio de sesión durante async:** Si la sesión de Supabase muta o se cierra durante la subida, se aborta la restauración y se preserva el borrador.
  - **Bloqueo de cuentas distintas:** Si la sesión o el perfil no coinciden con el correo registrado, retorna `null` y no se sube nada.
  - **Usuario no confirmado:** Retorna `null` sin subir.
  - **Foto existente:** Jamás sobreescribe y purga el borrador obsoleto.
  - **Expiración TTL:** Borra el registro vencido y retorna `null`.
  - **Tolerancia a errores de red:** Conserva el borrador en almacenamiento ante excepciones de `uploadItemPhoto` o `apiRequest`.
  - **Deduplicación de concurrencia:** Múltiples llamadas simultáneas reutilizan la misma promesa de subida en vuelo.
  - **API de IndexedDB:** Verifica la interacción nativa con la API `IndexedDB` del navegador.

### Resultados de la suite propia
```
pnpm test --run src/lib/pendingRegistrationPhoto.spec.ts
✓ src/lib/pendingRegistrationPhoto.spec.ts (19 tests) 103ms
Test Files  1 passed (1)
Tests  19 passed (19)
```

### Compilación y chequeo de tipos
```
pnpm build
vue-tsc -b && tsc -p tsconfig.api.json && vite build
✓ built in 1.85s
```

> **Nota sobre test ajeno (`src/stores/auth.spec.ts`):** Durante la ejecución de la suite global, el test `updatePassword > rechaza contraseñas con menos de 6 caracteres` en `src/stores/auth.spec.ts` presentó un fallo de aserción. En estricto respeto a las reglas del brief ("Registrar si un fallo pertenece a archivo de otro agente; no arreglarlo invadiendo propiedad"), dicho archivo pertenece al Agente A y no fue modificado.

---

## 7. Limitaciones honestas documentadas

1. **Ámbito de dispositivo y navegador:** La persistencia temporal reside en el almacenamiento del navegador donde se realizó el registro. Si un usuario se realiza en un dispositivo y abre el enlace de confirmación en otro, la foto no viajará entre dispositivos y deberá cargarse desde «Mi cuenta».
2. **Borrado de datos del navegador:** Si el usuario borra las cookies o el almacenamiento local antes de confirmar la cuenta, el borrador temporal se perderá.
3. **Ventana de expiración (24 horas):** Por higiene de almacenamiento local y privacidad, las fotos pendientes caducan a las 24 horas si la cuenta no es confirmada.
