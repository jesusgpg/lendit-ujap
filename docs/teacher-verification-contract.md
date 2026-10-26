# Contrato de API — Verificación Docente y Perfil Académico

Fecha: 2026-10-25
Alcance: Endpoints para el ciclo de vida de postulaciones docentes, credenciales privadas, revisión administrativa y permisos por rol.

---

## 1. Perfil y Sesión (`/api/me`)

### `GET /api/me`
Obtiene los datos del usuario autenticado, su rol y su estado académico.

- **Autenticación:** Requerida (`Bearer <token>`).
- **Respuesta 200 OK:**
```json
{
  "ok": true,
  "user": {
    "id": "uuid",
    "name": "Prof. Roberto Gómez",
    "firstName": "Roberto",
    "lastName": "Gómez",
    "email": "rgomez@ujap.edu.ve",
    "phone": "+584121234567",
    "photo": "https://...",
    "role": "STUDENT | PROFESSOR | ADMIN",
    "permissions": ["profile.update", "items.publish", "items.rent", "reviews.create"],
    "schoolId": "uuid | null",
    "school": "Facultad de Ingeniería | null",
    "department": "Cátedra de Algoritmos | null",
    "careerId": "uuid | null",
    "career": "Ingeniería en Computación | null",
    "emailVerifiedAt": "2026-10-25T12:00:00.000Z",
    "teacherVerification": {
      "id": "uuid",
      "status": "DRAFT | PENDING | NEEDS_CORRECTION | REJECTED | APPROVED",
      "version": 1,
      "schoolId": "uuid",
      "schoolName": "Facultad de Ingeniería",
      "department": "Cátedra de Algoritmos",
      "careerId": "uuid | null",
      "careerName": "Ingeniería en Computación | null",
      "documentPath": "authUserId/credential.webp | null",
      "rejectionReason": "string | null",
      "updatedAt": "2026-10-25T14:30:00.000Z"
    }
  }
}
```
- **Errores:**
  - `401 UNAUTHORIZED`: Token ausente o inválido.
  - `403 ACCOUNT_DISABLED` / `INSTITUTIONAL_EMAIL_REQUIRED`: Cuenta inactiva o dominio no institucional.
  - `409 PROFILE_REQUIRED`: Perfil no creado.

---

### `PATCH /api/me`
Actualiza datos de perfil del usuario autenticado.

- **Autenticación:** Requerida (`Bearer <token>`). Permiso `profile.update`.
- **Cuerpo (JSON):**
```json
{
  "firstName": "Roberto",
  "lastName": "Gómez",
  "phone": "+584121234567",
  "photoUrl": "https://...",
  "schoolId": "uuid",
  "department": "Cátedra de Algoritmos",
  "careerId": "uuid"
}
```
- **Reglas de validación:**
  - Si el rol es `STUDENT`, `careerId` es obligatorio. `schoolId` se sincroniza con la escuela de la carrera.
  - Si el rol es `PROFESSOR` o solicitante docente, `schoolId` es obligatorio; `department` es opcional (máx 120 caracteres); `careerId` es opcional, pero si se envía debe pertenecer a `schoolId`.
  - Si un docente `APPROVED` modifica sus datos académicos relevantes (`schoolId` o `department`), la verificación se invalida exigiendo nueva revisión administrativa (`NEEDS_CORRECTION` / `DRAFT`) y el rol se suspende a `STUDENT` mientras se revisa.
- **Errores:**
  - `400 INVALID_PROFILE` / `CAREER_NOT_FOUND` / `SCHOOL_NOT_FOUND` / `CAREER_SCHOOL_MISMATCH`
  - `422 PROFILE_INCOMPLETE`: Faltan campos obligatorios para el rol.

---

## 2. Postulación Docente (`/api/teacher-verifications/me`)

### `GET /api/teacher-verifications/me`
Obtiene la postulación del usuario actual, el historial de dictámenes y URL firmada de su credencial.

- **Autenticación:** Requerida.
- **Respuesta 200 OK:**
```json
{
  "ok": true,
  "verification": {
    "id": "uuid",
    "status": "DRAFT | PENDING | NEEDS_CORRECTION | REJECTED | APPROVED",
    "version": 2,
    "schoolId": "uuid",
    "schoolName": "Facultad de Ingeniería",
    "department": "Cátedra de Algoritmos",
    "careerId": "uuid | null",
    "careerName": "Ingeniería en Computación | null",
    "documentPath": "authUserId/credential.webp",
    "signedUrl": "https://...supabase.co/storage/v1/object/sign/teacher-credentials/...?token=...",
    "rejectionReason": "string | null",
    "createdAt": "2026-10-25T10:00:00.000Z",
    "updatedAt": "2026-10-25T14:30:00.000Z",
    "decisions": [
      {
        "id": "uuid",
        "action": "REQUEST_CORRECTION",
        "reason": "La foto del carnet está borrosa. Por favor subir una imagen más nítida.",
        "version": 1,
        "createdAt": "2026-10-25T11:00:00.000Z"
      }
    ]
  }
}
```
- **Si no tiene postulación previa:** Devuelve `200 OK` con `verification: null`.

---

### `POST /api/teacher-verifications/me`
Crea o actualiza y envía la postulación a revisión (`PENDING`).

- **Autenticación:** Requerida.
- **Cuerpo (JSON):**
```json
{
  "schoolId": "uuid",
  "department": "Cátedra de Algoritmos",
  "careerId": "uuid | null",
  "documentPath": "authUserId/credential-1730000000.png",
  "expectedVersion": 1
}
```
- **Reglas y Validaciones:**
  - Solo se puede enviar si el estado actual es `DRAFT`, `NEEDS_CORRECTION` o `REJECTED`.
  - Si el estado actual es `PENDING`, devuelve error `409 ALREADY_PENDING`.
  - Si el estado actual es `APPROVED`, devuelve error `409 ALREADY_APPROVED`.
  - Concurrencia optimista (CAS): si se envía `expectedVersion` y no coincide con la versión en base de datos, retorna `409 CONCURRENCY_CONFLICT`.
  - Validación de ruta: `documentPath` no puede contener `..` y debe pertenecer a la carpeta del usuario autenticado (`authUserId/...`).
  - Verificación de existencia real: se comprueba contra el bucket privado `teacher-credentials` en Supabase Storage. Si el objeto no existe, devuelve `400 CREDENTIAL_DOCUMENT_NOT_FOUND`.
  - Validación de tipo y contenido: inspección binaria de magic bytes (JPEG, PNG o WebP) y límite de 5 MB. Si no es un formato válido, devuelve `400 INVALID_IMAGE_CONTENT`. Si supera 5 MB, devuelve `400 FILE_TOO_LARGE`.
  - Transición atómica y congelación:
    - Transiciona `status` a `PENDING`.
    - Incrementa `version` y actualiza `submittedVersion`.
    - Genera una instantánea inmutable en la tabla `TeacherCredentialSubmission` con `documentMime`, `documentBytes` y `documentSha256`.
- **Errores:**
  - `400 INVALID_PAYLOAD` / `SCHOOL_NOT_FOUND` / `CAREER_NOT_FOUND` / `CAREER_SCHOOL_MISMATCH` / `INVALID_DOCUMENT_PATH` / `CREDENTIAL_DOCUMENT_NOT_FOUND` / `INVALID_IMAGE_CONTENT` / `FILE_TOO_LARGE`
  - `409 ALREADY_PENDING` / `ALREADY_APPROVED` / `CONCURRENCY_CONFLICT`

---

## 3. Revisión Administrativa (`/api/admin/teacher-verifications`)

Todos los endpoints administrativos requieren autenticación y permiso `teachers.review`.

### `GET /api/admin/teacher-verifications`
Listado paginado y filtrable de solicitudes de docentes.

- **Query params:**
  - `status`: `ALL | PENDING | NEEDS_CORRECTION | REJECTED | APPROVED | DRAFT` (default: `PENDING`)
  - `schoolId`: UUID (opcional)
  - `search`: Texto de búsqueda por nombre o correo (opcional)
  - `page`: Número de página (default: `1`)
  - `pageSize`: Elementos por página (default: `10`, máx: `50`)
- **Respuesta 200 OK:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "applicant": {
        "id": "uuid",
        "name": "Prof. Roberto Gómez",
        "email": "rgomez@ujap.edu.ve",
        "phone": "+584121234567",
        "role": "STUDENT"
      },
      "school": { "id": "uuid", "name": "Facultad de Ingeniería" },
      "career": { "id": "uuid", "name": "Ingeniería en Computación" } | null,
      "department": "Cátedra de Algoritmos",
      "status": "PENDING",
      "version": 1,
      "documentPath": "authUserId/credential.webp",
      "createdAt": "2026-10-25T10:00:00.000Z",
      "updatedAt": "2026-10-25T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### `GET /api/admin/teacher-verifications/[id]`
Detalle completo de una solicitud, incluyendo URL firmada (300 s) y log de dictámenes.

- **Respuesta 200 OK:**
```json
{
  "ok": true,
  "verification": {
    "id": "uuid",
    "userId": "uuid",
    "user": {
      "id": "uuid",
      "name": "Prof. Roberto Gómez",
      "email": "rgomez@ujap.edu.ve",
      "phone": "+584121234567",
      "currentRole": "STUDENT"
    },
    "school": { "id": "uuid", "name": "Facultad de Ingeniería" },
    "career": { "id": "uuid", "name": "Ingeniería en Computación" } | null,
    "department": "Cátedra de Algoritmos",
    "documentPath": "authUserId/credential.webp",
    "signedUrl": "https://...supabase.co/storage/v1/object/sign/teacher-credentials/...?token=...",
    "status": "PENDING",
    "version": 1,
    "rejectionReason": null,
    "createdAt": "2026-10-25T10:00:00.000Z",
    "updatedAt": "2026-10-25T10:00:00.000Z",
    "decisions": [
      {
        "id": "uuid",
        "action": "APPROVE",
        "reason": "Credencial válida verificada.",
        "adminName": "Administrador General",
        "version": 1,
        "createdAt": "2026-10-25T11:00:00.000Z"
      }
    ]
  }
}
```
- **Errores:** `404 NOT_FOUND`, `403 FORBIDDEN` (sin permiso `teachers.review`).

---

### `POST /api/admin/teacher-verifications/[id]/decision`
Emite un dictamen administrativo (`APPROVE`, `REJECT`, `REQUEST_CORRECTION`) de forma atómica.

- **Cuerpo (JSON):**
```json
{
  "action": "APPROVE | REJECT | REQUEST_CORRECTION",
  "reason": "Documento verificado conforme a la facultad.",
  "expectedVersion": 1
}
```
- **Comportamiento y Reglas:**
  - Si `expectedVersion !== verification.version`, retorna `409 CONCURRENCY_CONFLICT` impidiendo colisiones entre administradores.
  - `action === 'REJECT'` o `action === 'REQUEST_CORRECTION'` exige `reason` no vacío (mínimo 5 caracteres).
  - En `APPROVE`:
    - `TeacherVerification.status` pasa a `APPROVED`.
    - `version` se incrementa en 1.
    - Se registra `TeacherVerificationDecision`.
    - Se actualiza `User.roleId` al rol `PROFESSOR` dentro de la misma transacción.
    - Se copian/sincronizan `schoolId`, `department` y `careerId` al usuario.
  - En `REJECT` / `REQUEST_CORRECTION`:
    - `TeacherVerification.status` pasa a `REJECTED` o `NEEDS_CORRECTION`.
    - `TeacherVerification.rejectionReason` guarda el motivo.
    - `version` se incrementa en 1.
    - Si el usuario tenía asignado `PROFESSOR`, su rol se regresa a `STUDENT` de forma atómica.
- **Errores:**
  - `400 INVALID_PAYLOAD` / `REASON_REQUIRED`
  - `403 FORBIDDEN` (sin permiso `teachers.review`)
  - `404 NOT_FOUND`
  - `409 CONCURRENCY_CONFLICT`

---

## 4. Almacenamiento Privado de Credenciales (`teacher-credentials`)

- **Bucket:** `teacher-credentials` (privado).
- **Tipos permitidos:** `image/jpeg`, `image/png`, `image/webp`.
- **Límite:** 5 MB (5,242,880 bytes).
- **Ruta de objeto:** `{authUserId}/credential` o `{authUserId}/credential-{timestamp}.{ext}`.
- **Acceso:** Exclusivo del dueño del archivo (`auth.uid() = {authUserId}`) y de revisores con permiso `teachers.review`. Sin acceso público directo.
- **Vigencia de URLs firmadas:** 300 segundos (5 minutos).
