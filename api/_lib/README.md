# Módulo de Utilidades y Lógica de Dominio del Backend (`api/_lib`)

Esta carpeta contiene la infraestructura transversal del backend serverless: cliente de base de datos Prisma, integración y validación de autenticación con Supabase, manejo del ciclo de vida de solicitudes de préstamo (`requests.ts`) y reglas de negocio puras (`workflowRules.ts`).

---

## Archivos y Funciones

### 1. `auth.ts`
Módulo encargado de la verificación de tokens JWT de Supabase, resolución del perfil del usuario en la base de datos PostgreSQL, verificación de roles/permisos y validación de correos institucionales.

#### Tipos Exportados
- `ApiRequest`: Estructura unificada para peticiones HTTP (`method`, `headers`, `body`, `query`).
- `ApiResponse`: Interfaz de respuesta HTTP (`status(code)`, `json(body)`).
- `AuthenticatedProfile`: Perfil resuelto con `id`, `roleId`, `roleName` y lista de cadenas `permissions`.

#### Funciones

| Función | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `getServerClient()` *(privada)* | Ninguno | `SupabaseClient` | Inicializa y devuelve una instancia singleton del cliente Supabase para el entorno servidor (usando `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`), con persistencia y refresco de sesión deshabilitados. |
| `getAuthorizationHeader(req)` *(privada)* | `req: ApiRequest` | `string \| null` | Extrae el header `authorization` de la petición, manejando casos en que llegue como arreglo o cadena simple. |
| `getAuthenticatedUser(req)` | `req: ApiRequest` | `Promise<{ user: AuthUser; error: null } \| { user: null; error: 'UNAUTHORIZED' \| 'AUTH_NOT_CONFIGURED' }>` | Extrae el token `Bearer` de la petición y lo valida contra la API de Supabase Auth (`getUser(jwt)`). Devuelve el usuario autenticado de Supabase o el error correspondiente. |
| `isInstitutionalEmail(email)` | `email: string` | `boolean` | Valida mediante expresión regular (`/^[^\s@]+@ujap\.edu\.ve$/i`) que el correo pertenezca al dominio institucional `@ujap.edu.ve`. |
| `isAdministrativeRole(roleName, permissions)` | `roleName: string`, `permissions: string[]` | `boolean` | Determina si un usuario posee privilegios administrativos ya sea por el nombre del rol (`ADMIN`) o por contar con el permiso `roles.manage`. |
| `getAuthenticatedProfile(req)` | `req: ApiRequest` | `Promise<{ profile: AuthenticatedProfile; error: null } \| { profile: null; error: ... }>` | Valida la autenticación de Supabase, consulta el usuario correspondiente en la base de datos vía Prisma, comprueba que la cuenta esté activa (`isActive`), verifica si cumple con el correo institucional (o rol administrativo) y devuelve su id, rol y permisos aplanados. |
| `hasPermission(profile, key)` | `profile: AuthenticatedProfile`, `key: string` | `boolean` | Evalúa si el perfil autenticado cuenta con la clave de permiso solicitada en su lista de permisos. |
| `statusForProfileError(error)` | `error: string` | `number` | Mapea códigos de error de perfil a códigos de estado HTTP (`AUTH_NOT_CONFIGURED` $\to$ 500, `PROFILE_REQUIRED` $\to$ 409, `ACCOUNT_DISABLED` / `INSTITUTIONAL_EMAIL_REQUIRED` $\to$ 403, otros $\to$ 401). |

---

### 2. `prisma.ts`
Gestiona la conexión y ciclo de vida de la instancia de Prisma Client con el adaptador para PostgreSQL (`@prisma/adapter-pg`).

#### Funciones y Constantes

| Nombre | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `createPrismaClient()` *(privada)* | Ninguno | `PrismaClient` | Lee la variable de entorno `DATABASE_URL` y construye una nueva instancia de `PrismaClient` configurada con el adaptador `PrismaPg`. Lanza error si la URL no está definida. |
| `prisma` *(exportada)* | — | `PrismaClient` | Instancia global de Prisma reutilizada entre invocaciones serverless para evitar agotar el pool de conexiones en desarrollo y producción. |

---

### 3. `requests.ts`
Implementa el flujo completo de solicitudes de préstamo y alquiler: creación, listado, aprobación con bloqueo transaccional, rechazo, cancelación y devolución del objeto prestado.

#### Funciones

| Función | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `serializeRequest(request, profileId)` *(privada)* | `request: RequestRecord`, `profileId: string` | Objeto serializado | Transforma el registro crudo de Prisma en el formato esperado por el frontend, formateando fechas a ISO, calculando `isOwner` y convirtiendo montos a números. |
| `parseDateRange(startsAt, endsAt)` *(privada)* | `startsAt: string`, `endsAt: string` | `{ starts: Date, ends: Date }` | Parsea las fechas de inicio y fin, validando mediante `requestDateError` que no estén en el pasado, que el fin sea posterior al inicio y que no excedan el límite máximo permitido. |
| `findRequest(requestId)` *(privada)* | `requestId: string` | `Promise<LoanRequest \| null>` | Consulta una solicitud por ID en Prisma incluyendo relaciones de artículo, solicitante, pago y préstamo. |
| `listRequests(profile, res)` | `profile: AuthenticatedProfile`, `res: ApiResponse` | `Promise<void>` | Retorna las solicitudes en las que el usuario es el solicitante o el propietario del objeto involucrado, ordenadas cronológicamente descendente. |
| `handleRequestMutation(req, res, profile)` | `req: ApiRequest`, `res: ApiResponse`, `profile: AuthenticatedProfile` | `Promise<void>` | Enrutador interno para mutaciones de solicitudes; valida el permiso `items.rent` y deriva peticiones `POST` hacia `createRequest` o `PATCH` hacia `updateRequest`. |
| `createRequest(req, res, profile)` *(privada)* | `req: ApiRequest`, `res: ApiResponse`, `profile: AuthenticatedProfile` | `Promise<void>` | Valida la disponibilidad del objeto, audiencia permitida, previene auto-solicitudes, verifica solapamiento de fechas y crea la solicitud (y registro de pago simulado si es `RENTAL`) dentro de una transacción. |
| `updateRequest(req, res, profile)` *(privada)* | `req: ApiRequest`, `res: ApiResponse`, `profile: AuthenticatedProfile` | `Promise<void>` | Procesa acciones de flujo (`approve`, `reject`, `cancel`, `return`), verificando propiedad o permisos del usuario que invoca la acción. |
| `approveRequest(requestId, res, profile)` *(privada)* | `requestId: string`, `res: ApiResponse`, `profile: AuthenticatedProfile` | `Promise<void>` | Transacción atómica que valida que no existan conflictos de horario, actualiza el estado del objeto a `LENT`, aprueba la solicitud, genera el registro de `Loan` activo, vincula el pago y rechaza/reembolsa automáticamente solicitudes competidoras en el mismo rango de fechas. |
| `rejectOrCancelRequest(requestId, action, res, profile)` *(privada)* | `requestId: string`, `action: 'reject' \| 'cancel'`, `res: ApiResponse`, `profile: AuthenticatedProfile` | `Promise<void>` | Cambia el estado de una solicitud pendiente a `REJECTED` o `CANCELLED` y marca el pago simulado asociado como `REFUNDED`. |
| `returnLoan(loanId, res, profile)` *(privada)* | `loanId: string`, `res: ApiResponse`, `profile: AuthenticatedProfile` | `Promise<void>` | Registra la devolución de un préstamo activo, cambia el estado del préstamo a `RETURNED` con marca de tiempo actual y restaura el estado del artículo a `AVAILABLE`. |

---

### 4. `workflowRules.ts`
Funciones utilitarias puras (sin dependencias externas ni llamadas a base de datos) que concentran las reglas de negocio de permisos y validaciones de tiempo.

#### Funciones

| Función | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `canManageOwnedResource(ownerId, actorId, permissions)` | `ownerId: string`, `actorId: string`, `permissions: string[]` | `boolean` | Determina si un usuario puede modificar un recurso, retornando verdadero si es el propietario legítimo o si cuenta con el permiso `users.manage`. |
| `canSeeRestrictedItem(visibleRoleIds, actorRoleId)` | `visibleRoleIds: string[]`, `actorRoleId: string` | `boolean` | Verifica si un artículo restringido a roles específicos puede ser visualizado por el rol del usuario actual. Si la lista está vacía, es de acceso público. |
| `rangesOverlap(start, end, otherStart, otherEnd)` | `start: Date`, `end: Date`, `otherStart: Date`, `otherEnd: Date` | `boolean` | Comprueba matemáticamente si dos rangos de fechas se solapan (`start < otherEnd && end > otherStart`). |
| `requestDateError(startsAt, endsAt, now?)` | `startsAt: Date`, `endsAt: Date`, `now: Date = new Date()` | `'INVALID_REQUEST_DATES' \| 'REQUEST_RANGE_TOO_LONG' \| null` | Valida que las fechas sean válidas, que el inicio no esté en el pasado (con tolerancia de 60 segundos), que el fin sea posterior al inicio y que el rango no sobrepase 90 días. |
