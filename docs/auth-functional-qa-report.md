# Informe de Auditoría y Pruebas Funcionales: Autenticación, Sesiones y Regresiones LendIt UJAP

**Fecha:** 2026-10-26  
**Entorno auditado:** Producción (`https://lendit-ujap.vercel.app`) y Servidor de desarrollo de API (`http://localhost:8787`).  
**Rama:** `fix/users-login` | Preservado fix de compilación en imports `.js` (commit `98cc4da`).  
**Herramientas empleadas:** Orca Browser & Orca CLI (v1.4.241), Postman CLI (v1.73.0), scripts automatizados en TypeScript (`scripts/qa-auth-functional.ts` y `scripts/qa-auth-inspection.ts`) con Prisma 7.10 y `@supabase/supabase-js` 2.116.  
**Estado de base de datos:** Conexión relacional PostgreSQL activa y verificada; NoSQL/MongoDB no intervenido hoy según mandato.

---

## 1. Resumen Ejecutivo y Hallazgos Críticos

Se ejecutó la auditoría exhaustiva solicitada sobre los flujos de registro, confirmación de correo electrónico, recuperación y restablecimiento de contraseña, gestión de sesiones y regresiones de producto.

### Totales de Casos Evaluados
- **Total casos auditados formalmente:** 19
- **Aprobados (PASS):** 10
- **Fallidos por defecto o inconsistencia (FAIL):** 4
- **No implementados en la plataforma (NO IMPLEMENTADO):** 4
- **Bloqueados por falta de buzón receptor o entorno externo (BLOQUEADO):** 1

```
┌─────────────────────────────────────────────────────────────┐
│  RESULTADOS QA FUNCIONAL LENDIT UJAP - 2026-10-26           │
├──────────────────────┬─────────┬──────┬─────────┬───────────┤
│ Área                 │ PASS    │ FAIL │ NO IMPL │ BLOQUEADO │
├──────────────────────┼─────────┼──────┼─────────┼───────────┤
│ Registro & Docente   │ 2       │ 2    │ 0       │ 0         │
│ Confirmación Correo  │ 0       │ 1    │ 1       │ 1         │
│ Recuperación Clave   │ 1       │ 1    │ 2       │ 0         │
│ Login & Sesiones     │ 4       │ 0    │ 0       │ 0         │
│ Gestión de Cuenta    │ 0       │ 0    │ 1       │ 0         │
│ Regresiones Smoke    │ 1       │ 0    │ 0       │ 0         │
│ Producción & Health  │ 2       │ 0    │ 0       │ 0         │
├──────────────────────┼─────────┼──────┼─────────┼───────────┤
│ TOTAL (19)           │ 10      │ 4    │ 4       │ 1         │
└──────────────────────┴─────────┴──────┴─────────┴───────────┘
```

---

## 2. Hallazgos Principales (P0 / P1 / P2)

### [P0] Pérdida irreversible de foto de perfil cuando se exige confirmación de correo
- **Ubicación:** `src/stores/auth.ts` (líneas 215–231).
- **Problema:** En el método `auth.register()`, la subida de foto a Supabase Storage (`uploadItemPhoto`) y su persistencia vía `PATCH /api/me` se ejecutan **exclusivamente** dentro del bloque `if (data.session)`. Cuando Supabase exige confirmación de correo, `data.session` es `null`, por lo que el método retorna `{ ok: true, requiresEmailConfirmation: true }` y **descarta por completo** el contenido de `input.photo`.
- **Impacto:** Cualquier estudiante o docente que se registre con confirmación de correo obligatoria perderá su foto; cuando confirme el correo e inicie sesión por primera vez con `auth.login()`, su perfil quedará permanentemente sin foto (`photoUrl: null`), incumpliendo el requisito institucional de carnetización digital.

### [P0] Recuperación autoservicio de contraseña NO IMPLEMENTADA
- **Ubicación:** `src/views/LoginView.vue`, `src/views/AdminLoginView.vue`, `src/components/LoginForm.vue`, `src/stores/auth.ts`.
- **Problema:** 
  1. En las pantallas de login institucional y administrativo no existe ningún enlace ni formulario de "¿Olvidaste tu contraseña?".
  2. En `src/stores/auth.ts`, el listener `supabase.auth.onAuthStateChange` únicamente escucha `SIGNED_IN`, `INITIAL_SESSION`, `TOKEN_REFRESHED` y `SIGNED_OUT`. No existe ningún manejador para el evento `PASSWORD_RECOVERY` ni procesamiento de tokens `#type=recovery`.
  3. No existe ninguna vista, componente o llamada a `supabase.auth.updateUser({ password })` en todo el frontend para permitir al usuario ingresar una nueva contraseña.

### [P0] Estado de Envíos de Correo y Falsos Positivos HTTP 200 (jpena13 y jesusp2095)
- **Ubicación:** Supabase Auth vs. Prisma DB y Bandejas Reales.
- **Intento 1 (`jpena13@ujap.edu.ve`):**
  - El usuario notificó no tener acceso a este buzón.
  - La inspección técnica demostró que la cuenta no existía en `auth.users` (`User not found`).
  - La respuesta HTTP 200 `{ error: null }` obtenida en la solicitud previa fue producto de la protección anti-enumeración de Supabase; ningún correo fue enviado.
  - El perfil en Prisma fue posteriormente anonimizado y desactivado por solicitud explícita del usuario (`deleted-7ec600db-cd07-4a04-8ee9-3854fbab19b3@deleted.invalid`, `authUserId: null`). Cuenta descartada para QA.
- **Intento 2 (`jesusp2095@gmail.com` - Administrador Real):**
  - El usuario suministró `jesusp2095@gmail.com` como buzón controlado.
  - Codex ejecutó **UNA** solicitud `resetPasswordForEmail` con `redirectTo: 'https://lendit-ujap.vercel.app/admin/login'`.
  - Supabase Auth aceptó la solicitud y registró `recovery_sent_at: 2026-10-27T01:55:01.607684Z`.
  - **Recepción humana:** PENDIENTE de confirmación por el usuario. Un código HTTP 200 o la aceptación de Supabase **no demuestran entrega efectiva** (posibles demoras de red, clasificación como SPAM o límites de transporte SMTP).
  - **Defecto encadenado:** Aun si el correo es recibido, el enlace redirige a `/admin/login#access_token=...&type=recovery`, donde la interfaz **no captura el evento de recuperación ni permite cambiar la clave**, dejando el flujo bloqueado de cara al usuario.
  - **Regla estricta:** NO se repitió el envío, ni se cambió la contraseña, rol o perfil del único administrador.

### [P1] Redirección incompleta en reseteo administrativo de clave
- **Ubicación:** `backend/users/[id]/reset-password.ts` (línea 49).
- **Problema:** El endpoint administrativo ejecutado por los administradores en `UsersManagerPanel.vue` envía a Supabase `redirectTo: process.env.APP_URL` (la raíz de la aplicación). Cuando el destinatario hace clic en el enlace, aterriza en la página de inicio o en `/login`, donde la interfaz no captura el evento de recuperación ni despliega un formulario de cambio de clave.

### [P1] Falta de `emailRedirectTo` en `signUp` y carencia de pantalla de reenvío con cooldown
- **Ubicación:** `src/stores/auth.ts` (línea 195) y `src/router/index.ts`.
- **Problema:** `auth.register()` no provee `emailRedirectTo`, dependiendo enteramente de la Site URL configurada en el panel externo de Supabase. Además, no existe ruta dedicada de callback (ej. `/auth/callback`) ni interfaz para que un usuario que no recibió su enlace solicite un reenvío con cooldown.

### [P1] Accesibilidad en registro: Etiqueta incorrecta en botón de foto de perfil
- **Ubicación:** `src/components/RegisterForm.vue` (línea 287) y `src/components/PhotoDropzone.vue`.
- **Problema:** En el árbol de accesibilidad auditado mediante Orca Browser, el botón de carga anuncia `"Subir foto del objeto"` (texto heredado de la vista de publicar artículos) en lugar de `"Subir foto de perfil"` o `"Subir foto de carnet"`.

### [P1] Cambio de contraseña y control de sesiones desde la cuenta NO IMPLEMENTADOS
- **Ubicación:** `src/views/AccountView.vue`.
- **Problema:** La vista `/cuenta` solo incluye pestañas de Perfil, Acreditación/Carnet y Accesibilidad. No existe interfaz para cambiar contraseña desde sesión activa, ni reautenticación, ni cierre de sesiones en otros dispositivos.

---

## 3. Matriz Detallada de Pruebas y Resultados

| ID | Área | Prioridad | Caso de Prueba | Resultado | Resumen de Comportamiento |
| :--- | :--- | :---: | :--- | :---: | :--- |
| **REG-01** | Registro | **P1** | Validaciones reactivas de formulario | **PASS** | `RegisterForm.vue` valida campos obligatorios, contraseña >=6 y conmuta dinámicamente campos según rol estudiante/docente. |
| **REG-02** | Registro | **P1** | Accesibilidad del selector de foto | **FAIL** | El botón de carga anuncia accesiblemente `"Subir foto del objeto"` en lugar de `"Subir foto de perfil"`. |
| **REG-03** | Registro | **P0** | Persistencia de foto con confirmación | **FAIL** | Si `data.session` es nulo (email sin confirmar), la foto no se almacena y se pierde permanentemente. |
| **REG-04** | Registro | **P1** | Rechazo de incompatibilidad carrera/escuela | **PASS** | El backend rechaza con HTTP 400 y código `CAREER_SCHOOL_MISMATCH` cuando la carrera no pertenece a la facultad. |
| **CONF-01** | Confirmación | **P1** | Especificación de `emailRedirectTo` | **FAIL** | `signUp` omite el parámetro `emailRedirectTo`, dependiendo de la configuración por defecto de Supabase. |
| **CONF-02** | Confirmación | **P1** | Callback dedicado y reenvío con cooldown | **NO IMPL** | No existe ruta de callback ni interfaz para solicitar reenvío de confirmación de cuenta. |
| **CONF-03** | Confirmación / Recuperación | **P0** | Recepción real de correo (jpena13 y jesusp2095) | **PENDIENTE / BLOQUEADO** | jpena13 descartada (no existía en Auth y anonimizada en DB). jesusp2095 aceptada por Supabase pero entrega real pendiente de confirmación humana; un HTTP 200 no certifica entrega. |
| **REC-01** | Recuperación | **P0** | Autoservicio en login público y admin | **NO IMPL** | Ninguna pantalla de inicio de sesión dispone de enlace o formulario "¿Olvidaste tu contraseña?". |
| **REC-02** | Recuperación | **P0** | Listener de evento `PASSWORD_RECOVERY` | **NO IMPL** | La app no captura el evento de recuperación ni dispone de formulario para `updateUser({ password })`. |
| **REC-03** | Recuperación | **P0** | Permisos en `/api/users/:id/reset-password` | **PASS** | El backend rechaza con HTTP 403 `FORBIDDEN` si el llamador no posee el permiso administrativo `users.manage`. |
| **REC-04** | Recuperación | **P1** | Destino de reseteo administrativo | **FAIL** | Envía `redirectTo: APP_URL` genérico, sin llevar a una pantalla capaz de capturar el token de recuperación. |
| **AUTH-01** | Sesiones | **P0** | Login estudiante con credenciales válidas | **PASS** | Autenticación correcta contra Supabase Auth, emisión de JWT y perfil estudiante cargado en `/api/me`. |
| **AUTH-02** | Sesiones | **P0** | Rechazo de credenciales inválidas | **PASS** | Supabase devuelve error de credenciales inválidas y la UI mapea a `"Correo o contraseña incorrectos."`. |
| **AUTH-03** | Sesiones | **P0** | Rechazo de Bearer token adulterado | **PASS** | El backend rechaza solicitudes con tokens falsos respondiendo HTTP 401 JSON `{"ok":false,"error":"UNAUTHORIZED"}`. |
| **AUTH-04** | Sesiones | **P1** | Renovación de sesión con refresh token | **PASS** | Llamada a `refreshSession` emite un nuevo JWT sin forzar reautenticación del usuario. |
| **ACC-01** | Cuenta | **P1** | Cambio de contraseña desde `/cuenta` | **NO IMPL** | No existe opción ni formulario en la interfaz de configuración de cuenta. |
| **REG-SMOKE** | Regresiones | **P1** | Catálogo público en producción | **PASS** | Endpoint `/api/categories` responde HTTP 200 con listado completo de categorías e imágenes validadas. |
| **PROD-01** | Producción | **P0** | Healthcheck en Vercel | **PASS** | `https://lendit-ujap.vercel.app/api/health` retorna HTTP 200 con `{"ok":true,"database":"up"}`. |
| **PROD-02** | Producción | **P0** | Protección de endpoints en Vercel | **PASS** | `https://lendit-ujap.vercel.app/api/me` sin sesión retorna HTTP 401 JSON consistente sin caídas del runtime. |

---

## 4. Evidencia de Ejecución

### 4.1. Pruebas de API en Producción (Vercel) con Postman CLI
```bash
$ postman request GET https://lendit-ujap.vercel.app/api/health
→ GET https://lendit-ujap.vercel.app/api/health 
  200 OK ★ 647ms time ★ 27B size ★ 11 headers
  ┌ ↓ application/json; charset=utf-8
  │ {"ok":true,"database":"up"}
  └

$ postman request GET https://lendit-ujap.vercel.app/api/me
→ GET https://lendit-ujap.vercel.app/api/me 
  401 Unauthorized ★ 269ms time ★ 35B size ★ 11 headers
  ┌ ↓ application/json; charset=utf-8
  │ {"ok":false,"error":"UNAUTHORIZED"}
  └
```

### 4.2. Inspección Visual y Accesibilidad con Orca Browser
- **Navegación a `/login`:**
  - Árbol de elementos accesible inspeccionado: inputs de `Correo institucional`, `Contraseña` con botón de visibilidad de texto, botón `Entrar`, enlace a `Regístrate` y enlace a `Acceso administrativo`.
  - **Ausencia total:** Ningún nodo de recuperación de contraseña accesible en el DOM.
- **Navegación a `/register`:**
  - Validación de campos requeridos activada visualmente al enviar formulario vacío:
    - `"Escribe tu nombre."`
    - `"Escribe tu apellido."`
    - `"Usa tu correo institucional (@ujap.edu.ve)."`
    - `"La contraseña debe tener al menos 6 caracteres."`
    - `"Escribe un teléfono válido."`
  - Conmutador de roles reactivo:
    - Al seleccionar **Estudiante**: select de Carrera obligatorio con carreras del catálogo.
    - Al seleccionar **Profesor**: select de Facultad o Escuela obligatorio, campo opcional de Cátedra, select filtrado de Carrera adscrita y banner explicativo de acreditación docente.
  - Defecto accesible detectado en `PhotoDropzone`: `button "Subir foto del objeto" [ref=e17]` dentro de la sección de foto de carnet.

### 4.3. Suite Automatizada de QA Funcional (`scripts/qa-auth-functional.ts`)
```text
=== EJECUTANDO SUITE DE AUDITORÍA Y QA FUNCIONAL ===

--- 1. Registro y Solicitud Docente ---
  ✓ [PASS] [P1] REG-01: Validación de campos requeridos y restricciones académicas en UI
  ✗ [FAIL] [P1] REG-02: Accesibilidad de etiqueta en botón de foto de perfil
  ✗ [FAIL] [P0] REG-03: Persistencia de foto de perfil tras confirmación de correo
  ✓ [PASS] [P1] REG-04: Rechazo backend de incoherencia carrera-facultad (CAREER_SCHOOL_MISMATCH)

--- 2. Confirmación de Correo ---
  ✗ [FAIL] [P1] CONF-01: Configuración de redirección emailRedirectTo en signUp
  ⊘ [NO IMPLEMENTADO] [P1] CONF-02: Ruta dedicada de callback y pantalla de reenvío con cooldown
  ⚠ [BLOQUEADO] [P0] CONF-03: Recepción y entrega en buzón institucional real

--- 3. Recuperación de Contraseña ---
  ⊘ [NO IMPLEMENTADO] [P0] REC-01: Enlace y formulario autoservicio "¿Olvidaste tu contraseña?" en login público y administrativo
  ⊘ [NO IMPLEMENTADO] [P0] REC-02: Escuchador de evento PASSWORD_RECOVERY y formulario de nueva contraseña
  ✓ [PASS] [P0] REC-03: Control de acceso en endpoint administrativo /api/users/:id/reset-password
  ✗ [FAIL] [P1] REC-04: Redirección incompleta en reseteo administrativo (APP_URL genérico)

--- 4. Login, Sesiones y Roles ---
  ✓ [PASS] [P0] AUTH-01: Inicio de sesión estudiante con credenciales válidas
  ✓ [PASS] [P0] AUTH-02: Rechazo de credenciales incorrectas
  ✓ [PASS] [P0] AUTH-03: Rechazo de Bearer token adulterado o inválido en backend
  ✓ [PASS] [P1] AUTH-04: Renovación de sesión mediante refresh token

--- 5. Cambio de Contraseña desde Cuenta ---
  ⊘ [NO IMPLEMENTADO] [P1] ACC-01: Formulario de cambio de contraseña dentro de /cuenta

--- 6. Smoke de Regresión ---
  ✓ [PASS] [P1] REG-SMOKE-01: Catálogo de categorías disponible en producción

--- 7. Producción y Salud de la API ---
  ✓ [PASS] [P0] PROD-01: Healthcheck de API y conectividad de base de datos en Vercel
  ✓ [PASS] [P0] PROD-02: Endpoints protegidos retornan 401 JSON en producción sin sesión
```

---

## 5. Estado de Fixtures y Seguridad de Datos

1. **Fixtures autorizados utilizados:**
   - Estudiante QA (`estudiante@ujap.edu.ve`): Rol `STUDENT`, `emailVerifiedAt` activo en DB y Supabase Auth. Estado conservado intacto.
   - Docente QA (`docente.qa@ujap.edu.ve`): Rol `PROFESSOR`, acreditación docente verificada en DB y Supabase Auth. Estado conservado intacto.
   - Las contraseñas y tokens nunca fueron impresos en consola ni expuestos en archivos versionables.
2. **Cuentas protegidas verificadas (solo lectura):**
   - `jesusp2095@gmail.com` (Único Administrador real): Intacto. Se registró la solicitud previa de recuperación en Supabase Auth (`recovery_sent_at: 2026-10-27T01:55:01Z`), pero no se ejecutaron repeticiones de envío, degradaciones ni cambios de rol o contraseña.
   - `jpena@ujap.edu.ve`: Intacto.
   - `jpena13@ujap.edu.ve`: Ausente en `auth.users`. Su perfil en PostgreSQL fue anonimizado e inactivado (`deleted-7ec600db-cd07-4a04-8ee9-3854fbab19b3@deleted.invalid`, `authUserId: null`) a petición expresa del usuario; no se interactúa con ella.

---

## 6. Plan Correctivo Ordenado y Separado

Para subsanar las no conformidades detectadas sin mezclar responsabilidades de código y configuración de infraestructura, se desglosa el siguiente plan correctivo:

### Grupo A: Cambios de Código en el Repositorio LendIt

1. **Persistencia de Foto de Perfil en Registro (P0):**
   - Modificar `src/stores/auth.ts`: cuando `signUp` retorna `requiresEmailConfirmation: true`, no se puede llamar a `/api/me` inmediatamente porque no hay sesión activa.
   - *Solución recomendada:* Almacenar temporalmente la foto seleccionada en `sessionStorage` o `IndexedDB` local; al detectar el primer `SIGNED_IN` del usuario tras confirmar su correo en `syncProfile`, si el perfil en base de datos no tiene `photoUrl`, subir automáticamente la foto pendiente y limpiar el almacenamiento temporal.
2. **Implementación de Recuperación Autoservicio (P0):**
   - Crear componente modal o ruta `/recuperar-contrasena` con formulario de correo institucional que llame a `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset-password` })`.
   - Agregar enlaces visibles "¿Olvidaste tu contraseña?" en `LoginForm.vue` tanto para modo institucional como para modo administrativo.
3. **Escuchador de `PASSWORD_RECOVERY` y Pantalla de Nueva Contraseña (P0):**
   - En `src/stores/auth.ts`: agregar en `supabase.auth.onAuthStateChange` la detección de `event === 'PASSWORD_RECOVERY'`.
   - Crear la vista `/auth/reset-password` (o modal reactivo) que permita ingresar la nueva contraseña, validarla (mínimo 6 caracteres) y ejecutar `await supabase.auth.updateUser({ password: newPassword })`.
4. **Redirección Específica en Reseteo Administrativo (P1):**
   - En `backend/users/[id]/reset-password.ts`: actualizar `redirectTo` para apuntar a `${process.env.APP_URL}/auth/reset-password` en lugar de la raíz genérica.
5. **Corrección de Accesibilidad en Registro (P1):**
   - En `src/components/RegisterForm.vue`: cambiar el aria-label y prop de `PhotoDropzone` para que anuncie `"Subir foto de perfil para carnet"` en lugar de `"Subir foto del objeto"`.
6. **Formulario de Cambio de Contraseña en `/cuenta` (P1):**
   - En `src/views/AccountView.vue`: añadir una sección "Seguridad" que permita al usuario autenticado cambiar su contraseña actual mediante `supabase.auth.updateUser`.

### Grupo B: Configuración de Supabase y SMTP

1. **Configuración de SMTP Personalizado:**
   - Pendiente verificar la configuraci?n efectiva de SMTP, sus l?mites y los logs de entrega. Esta auditor?a no demuestra qu? proveedor est? configurado ni un l?mite concreto por hora.
   - Si el proveedor actual no permite los destinatarios o el volumen necesarios, configurar un SMTP autorizado y sus registros de dominio. Comprobar despu?s la recepci?n en un buz?n controlado; configurar SMTP no garantiza por s? solo la entrega.
2. **Allowlist de Redirecciones (Redirect URLs):**
   - En el panel de Supabase (Authentication -> URL Configuration -> Redirect URLs), asegurar que estén explícitamente registradas las URLs:
     - `https://lendit-ujap.vercel.app/`
     - `https://lendit-ujap.vercel.app/login`
     - `https://lendit-ujap.vercel.app/auth/reset-password`
     - `http://localhost:5173/**` (para desarrollo local).
3. **Cuenta retirada jpena13@ujap.edu.ve:**
   - La cuenta existe en la base de datos Postgres (`public.User`), pero su registro en `auth.users` está ausente. Se debe coordinar su creación o vinculación en `auth.users` si el usuario requiere acceder con dicho correo.

### Grupo C: Pasos Humanos Inevitables

1. **Provisión de Buzón Receptor de Prueba:**
   - Para desbloquear la prueba de confirmación y recuperación real de correo en el dominio `@ujap.edu.ve`, se requiere asignar una cuenta de correo institucional dedicada para QA cuyo buzón sea accesible por el evaluador.
2. **Validación de Recepción por el Usuario:**
   - Dado que el usuario autorizó previamente el envío a `jpena13@ujap.edu.ve` y la recepción está pendiente, el usuario debe confirmar manualmente si recibió algún mensaje y si los enlaces generados abren la aplicación de forma esperada.

---

## 7. Instrucciones para Reproducir las Pruebas

Para reproducir localmente la suite de pruebas ejecutada en esta auditoría:

```bash
# 1. Asegurar dependencias y build de Prisma
pnpm db:generate

# 2. Iniciar servidor de API local si no está corriendo (puerto 8787)
pnpm exec tsx server/dev-api.ts

# 3. En otra terminal, ejecutar la suite completa de QA funcional de autenticación
pnpm exec tsx scripts/qa-auth-functional.ts

# 4. Verificar healthcheck de producción con Postman CLI
postman request GET https://lendit-ujap.vercel.app/api/health
postman request GET https://lendit-ujap.vercel.app/api/me

# 5. Inspeccionar árbol de accesibilidad y pantallas en Orca Browser
orca goto --url "https://lendit-ujap.vercel.app/login"
orca snapshot
orca goto --url "https://lendit-ujap.vercel.app/register"
orca snapshot
```
