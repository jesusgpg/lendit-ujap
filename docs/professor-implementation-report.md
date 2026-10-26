# Informe de Implementación y QA: Flujo Docente LendIt UJAP (Versión Corregida con Límites Transparentes)

**Fecha:** 26 de octubre de 2026
**Entorno:** Local (`localhost:5173` Web Vite / `localhost:8787` Dev API Node)
**Base de datos:** Supabase PostgreSQL remota compartida (17 migraciones aplicadas, esquema al día)
**Rama activa:** `fix/users-login` (árbol de trabajo local intacto, sin commits ni push)
**Auditoría y Autorización:** Revision correctiva solicitada por el usuario: eliminar mutaciones de prueba sobre cuentas personales, aislar o marcar pendiente la concurrencia del último administrador, completar las 4 permutaciones bidireccionales de préstamo/alquiler y declarar con honestidad los límites de cobertura reales.

---

## 1. Resumen Ejecutivo de Correcciones y Declaración de Límites

En esta revisión se subsanaron las prácticas inseguras de prueba detectadas y se completaron los flujos de marketplace pendientes:

1. **Salvaguarda Estricta para Cuentas Personales:**
   - Se identificó que una versión previa del runner de pruebas intentó evaluar la regla del último administrador creando un usuario temporal y emitiendo un `PATCH /api/users/:id` contra la cuenta del administrador personal (`jesusp2095@gmail.com`), confiando en su restauración dentro de un bloque `finally`.
   - **Corrección aplicada:** Se eliminó por completo cualquier mutación hacia cuentas personales. Se implementó una lista negra de protección estricta en el cliente de pruebas (`PROTECTED_USER_IDS` que incluye a `jesusp2095@gmail.com`, `jpena@ujap.edu.ve`, `jpena13@ujap.edu.ve` y cualquier cuenta con rol `ADMIN`). Cualquier intento de petición `POST`, `PATCH`, `PUT` o `DELETE` dirigida a estas identidades es abortado de inmediato a nivel de cliente antes de emitir tráfico HTTP (`SECURITY FATAL: Blocked attempted mutation against protected account`).
2. **Estado Verificado del Administrador Real (Solo Lectura):**
   - Se verificó en modo **estricto de solo lectura** directamente en la base de datos que el administrador personal `jesusp2095@gmail.com` permanece 100% activo (`isActive: true`) y con su rol `ADMIN` íntegro.
3. **Límite Honesto: Concurrencia de Último Administrador Marcada PENDIENTE:**
   - La prueba de estrés concurrente del último administrador por HTTP exige un entorno efímero aislado (por ejemplo, una base de datos local en contenedor o réplica descartable).
   - En el entorno actual, conectado a la base de datos remota compartida de Supabase, **no se ejecuta la mutación concurrente de administradores** para garantizar riesgo cero de degradación accidental.
   - El control transaccional de negocio en `api/users/[id].ts` (que valida `canManageRoles` y cuenta usuarios activos con permiso `roles.manage`) se mantiene activo en código, pero el caso de prueba concurrente de integración se declara formalmente como **PENDIENTE (Requiere base de datos efímera aislada)** sin simular aprobaciones ficticias.
4. **Cobertura Bidireccional Completa de Préstamo y Alquiler (4 Permutaciones):**
   - Se implementaron y ejecutaron de punta a punta las 4 combinaciones bidireccionales posibles utilizando exclusivamente las cuentas de prueba seguras (`docente.qa@ujap.edu.ve` y `estudiante@ujap.edu.ve`):
     - **Permutación 1:** Profesor solicita PRÉSTAMO a Estudiante -> Aprobación -> Devolución exitosa (`RETURNED`).
     - **Permutación 2:** Estudiante solicita PRÉSTAMO a Profesor -> Aprobación -> Devolución exitosa (`RETURNED`).
     - **Permutación 3:** Estudiante solicita ALQUILER a Profesor con pago simulado -> Aprobación -> Devolución exitosa (`RETURNED`).
     - **Permutación 4:** Profesor solicita ALQUILER a Estudiante con pago simulado -> Aprobación -> Devolución exitosa (`RETURNED`).
5. **Aislamiento de Sesiones Supabase en Pruebas de Storage:**
   - Se separaron las instancias de cliente (`teacherClient`, `studentClient`, `adminClient`, `serviceClient`) evitando la contaminación cruzada de sesiones de autenticación que falseaba las pruebas de RLS.
   - Se verificó que un alumno autenticado no puede descargar la credencial privada de un docente (`StorageApiError: Object not found` / NoSuchKey devuelto por RLS).

---

## 2. Inventario de Migraciones de Base de Datos (17 Aplicadas)

Estado verificado con `pnpm prisma migrate status`: esquema completamente sincronizado con Supabase PostgreSQL.

| # | Migración | Descripción y Propósito |
|---|---|---|
| 01 | `20261020000000_init_core_security` | Esquema base, usuarios, roles, permisos y autenticación |
| 02 | `20261020010000_storage_and_campus_system` | Buckets de storage y configuración institucional |
| 03 | `20261021000000_marketplace_security` | Esquema de ítems, categorías y condiciones |
| 04 | `20261021010000_rls_policies` | Políticas RLS para ítems y perfiles |
| 05 | `20261022000000_requests_and_agreements` | Solicitudes de préstamo, alquiler y estados |
| 06 | `20261022010000_request_security_audit` | Auditoría de transiciones de acuerdos |
| 07 | `20261023000000_reviews_system` | Sistema de reputación y reseñas |
| 08 | `20261023010000_notifications_and_audit` | Notificaciones internas y logs de auditoría |
| 09 | `20261024000000_admin_reports_and_moderation` | Moderación de reportes y penalizaciones |
| 10 | `20261024010000_payments_simulation` | Simulación de pagos de alquiler y depósitos en garantía |
| 11 | `20261024020000_chat_system` | Mensajería contextual en tiempo real |
| 12 | `20261024030000_cron_and_scheduled_jobs` | Tareas programadas de vencimiento |
| 13 | `20261024040000_performance_indexes` | Índices de rendimiento en claves foráneas y búsquedas |
| 14 | `20261025000000_academic_faculties_and_careers` | Estructura académica de facultades y carreras UJAP |
| 15 | `20261025060000_fix_admin_users_view_permission` | Permiso administrativo para gestión de usuarios |
| 16 | `20261025070000_teacher_verification_and_academic_profile` | Tabla `TeacherVerification`, `TeacherVerificationDecision`, `School` en `User`, enums de verificación |
| 17 | `20261026010000_teacher_credential_versions_and_freeze` | **Aditiva:** `TeacherCredentialSubmission` para congelación de credenciales por versión, `submittedVersion` y reglas de inmutabilidad |

---

## 3. Arquitectura de Guardias y Bloqueos Implementados

### Backend (Node / Express / Prisma):

1. **Autenticación e Identidad (`api/_lib/auth.ts`):**
   - Incorporación de `teacherVerification` en la interfaz `AuthenticatedProfile` y en la función `getAuthenticatedProfile()`.
   - Helpers de control:
     - `isTeacherApplicant(profile)`: Detecta solicitantes en estado no aprobado (`DRAFT`, `PENDING`, `NEEDS_CORRECTION`, `REJECTED`).
     - `isApprovedProfessor(profile)`: Identifica docentes aprobados (`role === 'PROFESSOR'` y `teacherVerification.status === 'APPROVED'`).
     - `canPerformNewMarketplaceOperations(profile)`: Bloquea nuevas publicaciones y solicitudes para docentes no aprobados.
2. **Catálogo y Publicaciones (`api/items.ts`):**
   - `GET /api/items`: Solicitantes docentes solo ven ítems de audiencia universal pública (`visibleRoleIds.length === 0`).
   - `POST /api/items`: Publicación bloqueada para solicitantes no aprobados (`403 TEACHER_VERIFICATION_REQUIRED`).
   - Audiencias por rol: Se utiliza el campo contractual `restrictedToRoles`, asociando de forma segura los roles permitidos en `ItemVisibility`.
3. **Solicitudes de Préstamos y Alquileres (`api/_lib/requests.ts`):**
   - `createRequest`: Bloquea nuevas solicitudes generadas por solicitantes docentes (`403 TEACHER_VERIFICATION_REQUIRED`).
   - `action: 'return'`: Las acciones de resolución y devolución de acuerdos existentes permanecen totalmente habilitadas.
4. **Mensajería Contextual (`api/messages.ts`):**
   - Se preserva el intercambio de mensajes en conversaciones de acuerdos activos preexistentes incluso durante la suspensión académica de un docente.
5. **Perfil y Fallback de Registro (`api/me.ts`):**
   - Removida la asignación arbitraria de `defaultCareer`.
   - Se valida compatibilidad escuela-carrera: si se especifican tanto escuela como carrera y no corresponden, responde `400 CAREER_SCHOOL_MISMATCH`.
   - Estudiantes requieren carrera obligatoria (`422 CAREER_REQUIRED_FOR_STUDENT`). Docentes requieren escuela obligatoria (`422 SCHOOL_REQUIRED_FOR_PROFESSOR`).
   - La alteración de datos académicos por parte de un docente aprobado degrada preventivamente el estado a `NEEDS_CORRECTION` y el rol a `STUDENT` de forma transaccional.
6. **Envío y Validación de Credencial (`api/teacher-verifications/me.ts`):**
   - Verificación de existencia real del archivo en Supabase Storage con `download()`.
   - Inspección binaria de magic bytes (JPEG/PNG/WebP) y límite de 5 MB.
   - Creación de snapshot inmutable con SHA-256 en `TeacherCredentialSubmission`.
   - Concurrencia optimista Compare-And-Swap (CAS) con `expectedVersion`.
7. **Decisión Administrativa Atómica (`api/admin/teacher-verifications/[id]/decision.ts`):**
   - Actualización atómica vía `updateMany({ where: { id: verification.id, version: expectedVersion } })`.
   - Colisión entre decisiones concurrentes devuelven `409 CONCURRENCY_CONFLICT`.

### Frontend (Vue 3 / Pinia / Vite):

1. **Store de Autenticación (`src/stores/auth.ts`):** Getters `isTeacherApplicant`, `isApprovedTeacher`, `canPerformMarketplaceOperations`.
2. **Guardias de Rutas (`src/main.ts`):** Bloquea `/cuenta/carnet` para solicitantes docentes; redirige `/publicar` a `/cuenta/acreditacion`.
3. **Vistas Adaptadas:**
   - [`src/views/AccountView.vue`](file:///C:/Users/jpena/Documents/Proyectos%20Personales/lendit-ujap/src/views/AccountView.vue): Pestaña de carnet oculta para docentes; muestra insignia `Docente (En validación)`.
   - [`src/views/PublishView.vue`](file:///C:/Users/jpena/Documents/Proyectos%20Personales/lendit-ujap/src/views/PublishView.vue): Mensaje informativo de publicación deshabilitada hasta la acreditación.
   - [`src/views/CatalogView.vue`](file:///C:/Users/jpena/Documents/Proyectos%20Personales/lendit-ujap/src/views/CatalogView.vue): Intercepta solicitudes con alerta contextual.
   - [`src/views/StudentHomeView.vue`](file:///C:/Users/jpena/Documents/Proyectos%20Personales/lendit-ujap/src/views/StudentHomeView.vue): Banner persistente indicando acreditación en curso.

---

## 4. Resultados Reales de la Suite QA Automatizada

Traza de ejecución obtenida ejecutando `pnpm tsx scripts/qa-runner.ts` contra el backend local (`:8787`) y PostgreSQL:

```
=== SUITE COMPLETA DE QA: VALIDACIÓN DOCENTE Y MUTACIONES SEGURAS ===

Usuarios autenticados:
  Admin:   jesusp2095@gmail.com (DB ID: 348ad39d-3ff0-4b43-ae38-4bc47b72afc8) [PROTEGIDO]
  Docente: docente.qa@ujap.edu.ve (Auth: 17fbf7e7-fbff-4e87-9d9d-6051b6612424)
  Alumno:  estudiante@ujap.edu.ve (Auth: ca86dca1-bde3-4b54-8ab4-b5bd6d6a82e8)
  Cuentas protegidas contra mutación: 3

--- 1. Validación de Perfil y Rechazo de Incompatibilidades ---
  ✓ [PASS] Estudiante requiere carrera (carrera no puede quedar vacía o nula) (3276ms)
  ✓ [PASS] Rechazo cuando carrera no pertenece a la escuela indicada (mismatch) (2382ms)
  ✓ [PASS] Rechazo de documentPath con path traversal (..) o fuera de la carpeta propia (691ms)

--- 2. Aislamiento de Storage y Validación de Contenido Real ---
  ✓ [PASS] Rechazo cuando el archivo referenciado NO existe realmente en storage (1228ms)
  ✓ [PASS] Rechazo de archivo que no sea imagen real (contenido inválido/texto) (1563ms)
  ✓ [PASS] Carga de imagen PNG válida y creación de TeacherCredentialSubmission con SHA256 (3382ms)
  ✓ [PASS] Aislamiento Storage RLS: Alumno no puede descargar la credencial privada del profesor (480ms)

--- 3. Ciclo de Vida: Corrección, Rechazo, Reenvío y Concurrencia CAS ---
  ✓ [PASS] Intento de reenvío mientras está PENDING es rechazado con 409 ALREADY_PENDING (1137ms)
  ✓ [PASS] Usuario sin permiso teachers.review recibe 403 FORBIDDEN en endpoints de revisión (808ms)
  ✓ [PASS] Admin solicita corrección con motivo explicativo -> pasa a NEEDS_CORRECTION (3994ms)
  ✓ [PASS] Docente corrige datos y reenvía a revisión -> pasa a PENDING con versión incrementada (2335ms)
  ✓ [PASS] Admin rechaza postulación con motivo -> pasa a REJECTED (2580ms)
  ✓ [PASS] Docente subsana rechazo y reenvía -> pasa a PENDING nuevamente (2241ms)
  ✓ [PASS] Concurrencia real CAS: Decisiones concurrentes con la misma expectedVersion -> una gana, otra 409 (3698ms)

--- 4. Audiencias de Publicaciones y Restricciones de Solicitantes ---
  ✓ [PASS] Crear ítems con audiencias: Solo Estudiantes, Solo Profesores y Pública (7474ms)
  ✓ [PASS] Estudiante en catálogo NO ve ítem exclusivo de profesores (1138ms)
  ✓ [PASS] Profesor en catálogo NO ve ítem exclusivo de estudiantes (1135ms)
  ✓ [PASS] Estudiante intentando pedir ítem de profesores vía HTTP directo recibe 403 (1208ms)
  ✓ [PASS] Profesor intentando pedir ítem de estudiantes vía HTTP directo recibe 403 (1536ms)

--- 5. Interacciones Bidireccionales Completas Hasta Devolución ---
  ✓ [PASS] Profesor pide préstamo a Estudiante -> Aprobación -> Devolución exitosa (11597ms)
  ✓ [PASS] Estudiante pide préstamo a Profesor -> Aprobación -> Devolución exitosa (12181ms)
  ✓ [PASS] Estudiante pide alquiler a Profesor con pago simulado -> Aprobación -> Devolución (12882ms)
  ✓ [PASS] Profesor pide alquiler a Estudiante con pago simulado -> Aprobación -> Devolución (16239ms)

--- 6. Chat Bidireccional y Preservación Tras Suspensión ---
  ✓ [PASS] Estudiante y profesor intercambian mensajes en el chat del acuerdo activo (4244ms)
  ✓ [PASS] Suspensión docente por edición de perfil: se suspende rol y bloquea nuevas operaciones (10391ms)
  ✓ [PASS] Restaurar acreditación docente a APPROVED (3497ms)

--- 7. Verificación de Seguridad y Protección del Administrador ---
  ✓ [PASS] Verificación de solo lectura: Administrador del sistema permanece activo con rol ADMIN (1159ms)
  ⚠ [PENDIENTE / OMITIDO POR SEGURIDAD] Concurrencia HTTP en protección del último administrador
      Motivo: Requiere entorno de ejecución con base de datos efímera aislada. En el entorno actual (base de datos compartida remota) está estrictamente prohibido mutar o simular degradaciones contra administradores para no comprometer la cuenta real ni arriesgar la persistencia administrativa.

======================================================
RESUMEN DE PRUEBAS DE QA EJECUTADAS
======================================================
Total casos evaluados: 28
  - Pruebas ejecutadas y aprobadas: 27
  - Casos marcados PENDIENTE (entorno aislado requerido): 1
  - Pruebas fallidas: 0
```

---

## 5. Verificación de Compilación y Suites Unitarias

1. **Suite Unitaria Vitest (`pnpm test --run`):**
   - 5 archivos evaluados, 14 pruebas ejecutadas, **14 aprobadas (100%)**.
   - `api/_lib/workflowRules.spec.ts` (5 pruebas): audiencias por rol y bloqueos de solicitantes docentes.
   - `src/data/app.spec.ts` (2 pruebas).
   - `src/stores/requests.spec.ts` (2 pruebas).
   - `src/stores/articles.spec.ts` (3 pruebas).
   - `src/stores/auth.spec.ts` (2 pruebas).
2. **Compilación de Producción (`pnpm build`):**
   - `vue-tsc -b`: 0 errores de tipado TypeScript/Vue.
   - `tsc -p tsconfig.api.json`: 0 errores en backend Node.
   - `vite build`: bundle cliente generado exitosamente en 1.60 s.
3. **Disponibilidad de Servidores de Desarrollo:**
   - Vite Web (`http://localhost:5173`): HTTP 200.
   - Dev API Node (`http://localhost:8787/api/health`): HTTP 200.

---

## 6. Cuadro de Cuentas y Estado de Seguridad

| Cuenta | Rol en BD | Estado | Política de Interacción en Pruebas |
|---|---|---|---|
| `jesusp2095@gmail.com` | `ADMIN` | Activo | **Protegida (Solo Lectura):** Mutaciones bloqueadas en cliente de pruebas. Verificada íntegra sin cambios de rol ni contraseña. |
| `jpena@ujap.edu.ve` | `STUDENT` | Activo | **Protegida:** Sesión y perfil personal intactos; mutaciones prohibidas. |
| `jpena13@ujap.edu.ve` | `STUDENT` | Activo | **Protegida:** Cuenta secundaria personal; mutaciones prohibidas. |
| `estudiante@ujap.edu.ve` | `STUDENT` | Activo | **Fixture QA Alumno:** Utilizado para solicitudes de préstamo/alquiler, simulación de pagos, mensajería y pruebas RLS. |
| `docente.qa@ujap.edu.ve` | `PROFESSOR` | Activo / Acreditado | **Fixture QA Docente:** Utilizado para ciclo de acreditación, congelación de credenciales, concurrencia CAS y suspensión. |

*Limpieza post-prueba:* Se eliminaron de la base de datos todos los ítems, préstamos, alquileres, pagos simulados y mensajes transitorios creados con prefijo `#UJAP-TEST-*` o identificadores de prueba QA.

---

## 7. Conclusión y Estado de Entrega

- **Migraciones:** 17 migraciones aplicadas y activas en Supabase PostgreSQL.
- **Pruebas Automatizadas de Integración:** 27 pruebas reales ejecutadas y aprobadas exitosamente.
- **Límite Declarado:** 1 caso (concurrencia HTTP de degradación del último administrador) documentado formalmente como PENDIENTE de entorno efímero aislado.
- **Integridad:** Las cuentas personales no sufren mutaciones de prueba. Árbol de trabajo en rama `fix/users-login` sin commits ni push, listo para revisión.

## 8. Cierre de la prueba aislada del último administrador

Verificación adicional ejecutada por Codex el 25 de octubre de 2026 mediante `pnpm test:last-admin` (`scripts/qa-last-admin.ts`): **23 comprobaciones aprobadas, salida 0**.

- PostgreSQL 18 temporal en localhost, puerto 55439, con esquema Prisma real y usuarios exclusivamente ficticios. No carga `.env`; sustituye las URLs de BD antes de importar la aplicación. No conecta a Supabase ni modifica cuentas remotas.
- Peticiones HTTP a los handlers reales `api/users/[id].ts` y `api/roles/[id].ts`, usando Prisma y transacciones/bloqueos reales. Únicamente el proveedor de identidad está simulado mediante un servidor HTTP local; esto no es una prueba del servicio Supabase Auth.
- Tres casos con un único administrador: desactivación, degradación de rol y retirada de `roles.manage`; todos devuelven `409 LAST_ADMIN` y conservan un administrador activo.
- Veinte carreras concurrentes (cinco repeticiones de cuatro escenarios): desactivaciones, degradaciones, retirada de permisos y combinación de cambio de usuario con cambio de permisos. En cada carrera se observa una respuesta 200, una 409 `LAST_ADMIN` y exactamente un administrador efectivo restante.
- El servidor HTTP, el proveedor de identidad y PostgreSQL se detienen al finalizar; la carpeta temporal de esta ejecución se elimina. Requiere PostgreSQL local; se puede configurar su directorio con `QA_POSTGRES_BIN`.

El caso omitido en el runner remoto queda cubierto por esta suite aislada independiente. Se conserva la omisión en el runner remoto para impedir que esta prueba vuelva a ejecutarse sobre cuentas personales. Las cifras 27 aprobadas / 1 omitida de la sección 4 corresponden a aquella ejecución histórica; estas 23 comprobaciones son una ejecución adicional.
