# Endpoints Serverless de la API (`api/`)

Esta carpeta contiene los controladores y funciones serverless ejecutadas en Vercel (o en local mediante el servidor Express de desarrollo `server/dev-api.ts`). Cada archivo exporta por defecto una función `handler(req, res)` que procesa las solicitudes HTTP para un recurso específico del sistema.

---

## Controladores y Endpoints

### 1. `health.ts` (`/api/health`)
Endpoint de diagnóstico para comprobar el estado de conexión con la base de datos PostgreSQL.

- **Método**: `GET`
- **Funciones**:
  - `handler(req: ApiRequest, res: ApiResponse)`: Ejecuta una consulta ligera `SELECT 1` mediante Prisma. Retorna HTTP 200 con `{ ok: true, database: 'up' }` si la conexión es exitosa, o HTTP 503 con `{ ok: false, database: 'down' }` en caso de fallo.

---

### 2. `items.ts` (`/api/items`)
Controlador central para la gestión del catálogo de artículos y el ciclo de vida de solicitudes de préstamo asociadas.

- **Métodos**: `GET`, `POST`, `PATCH`, `DELETE`
- **Funciones**:
  - `serializeItem(item)`: Transforma la entidad de Prisma a la interfaz `Article` del frontend, mapeando estados (`AVAILABLE` $\to$ `available`), formateando fechas e incluyendo audiencia permitida.
  - `generateItemCode()`: Genera un código único alfanumérico con formato `#UJAP-XXXXXXXX`.
  - `queryValue(value)`: Normaliza parámetros de búsqueda de la URL tanto si vienen como arreglo o como cadena individual.
  - `bodyResource(body)`: Identifica si el cuerpo de la petición va dirigido a un recurso secundario (e.g. `'request'`).
  - `isItemPhotoUrl(photoUrl)`: Verifica que la URL de una foto pertenezca al bucket seguro `item-photos` de la instancia de Supabase configurada.
  - `validateRental(mode, price, currency)`: Garantiza que los artículos configurados como `RENTAL` tengan un precio positivo y una divisa válida (`USD`, `EUR`, `VES`).
  - `resolveRoleIds(roleNames)`: Convierte nombres de roles en sus respectivos IDs de base de datos para la configuración de visibilidad por roles.
  - `handler(req, res)`:
    - `GET`: Si `view=requests`, lista solicitudes vía `listRequests()`. Si `mine=1`, lista solo los objetos del usuario autenticado. En el catálogo público, filtra objetos disponibles según el rol del usuario (o sin restricciones para administradores con `users.manage`).
    - `POST / PATCH con resource='request'`: Delega la mutación a `handleRequestMutation()` para crear o actualizar el estado de solicitudes de préstamo.
    - `POST`: Crea un nuevo objeto publicado por el usuario, asociando categoría, duración, modalidad de préstamo/alquiler y audiencia restringida opcional.
    - `PATCH`: Actualiza campos de un objeto existente (título, descripción, foto, estado disponible/pausado, etc.) previa validación de propiedad o permisos administrativos.
    - `DELETE`: Elimina un artículo si el usuario es dueño y no posee historial de préstamos o solicitudes activas.
  - `updateItem(req, res, profile)`: Lógica transaccional para actualizar las propiedades de un artículo y su visibilidad de roles, previniendo modificaciones de términos si existen solicitudes pendientes.

---

### 3. `me.ts` (`/api/me`)
Gestiona el perfil del usuario autenticado y la sincronización entre Supabase Auth y la tabla `User` de la base de datos.

- **Métodos**: `GET`, `PATCH`
- **Funciones**:
  - `metadataValue(metadata, key)`: Obtiene valores de tipo cadena desde los metadatos de Supabase.
  - `isUuid(value)`: Valida el formato canónico de un UUID v4.
  - `serializeProfile(profile)`: Formatea el registro de usuario combinando nombre, correo, carrera, teléfono, foto, rol y lista de permisos.
  - `handler(req, res)`:
    - `GET`: Consulta y retorna el perfil completo del usuario autenticado. Si el perfil aún no existe en PostgreSQL, responde 409 (`PROFILE_REQUIRED`) para activar la creación/sincronización.
    - `PATCH`: Actualiza datos del perfil (nombre, apellido, teléfono, carrera, foto). Si el usuario no tenía registro previo en base de datos, lo inicializa automáticamente como rol `STUDENT`.

---

### 4. `categories.ts` (`/api/categories` y `/api/categories/:key`)
Administración de categorías del catálogo de artículos.

- **Métodos**: `GET`, `POST`, `PATCH`, `DELETE`
- **Funciones**:
  - `handler(req, res)`:
    - `GET`: Retorna todas las categorías ordenadas alfabéticamente por etiqueta (público).
    - `POST`: Crea una nueva categoría con clave, etiqueta, icono y descripción (requiere permiso `categories.manage`).
    - `PATCH`: Actualiza los datos de una categoría identificada por su `key` (requiere `categories.manage`).
    - `DELETE`: Elimina una categoría si no tiene artículos asociados actualmente (requiere `categories.manage`).

---

### 5. `careers.ts` (`/api/careers` y `/api/careers/:id`)
Administración de carreras universitarias y su adscripción a facultades/escuelas.

- **Métodos**: `GET`, `POST`, `PATCH`, `DELETE`
- **Funciones**:
  - `serializeCareer(career)`: Serializa el ID, nombre de la carrera y datos de la escuela asociada.
  - `handler(req, res)`:
    - `GET`: Retorna la lista de carreras activas con su escuela asociada (público).
    - `POST`: Registra una nueva carrera (requiere permiso `careers.manage`).
    - `PATCH`: Modifica el nombre o la escuela de una carrera (requiere `careers.manage`).
    - `DELETE`: Elimina una carrera únicamente si no tiene estudiantes registrados en ella (requiere `careers.manage`).

---

### 6. `schools.ts` (`/api/schools`)
Administración de facultades y escuelas universitarias.

- **Métodos**: `GET`, `POST`
- **Funciones**:
  - `handler(req, res)`:
    - `GET`: Lista las escuelas ordenadas alfabéticamente.
    - `POST`: Crea una nueva escuela universitaria (requiere permiso `careers.manage`).

---

### 7. `roles.ts` (`/api/roles`)
Gestión general de roles y asignación de permisos.

- **Métodos**: `GET`, `POST`
- **Funciones**:
  - `serializeRole(role)`: Formatea el rol extrayendo la lista de claves de permisos asociados.
  - `handler(req, res)`:
    - `GET`: Lista todos los roles existentes con sus permisos (accesible a usuarios autenticados).
    - `POST`: Crea un nuevo rol en el sistema y le asocia los permisos indicados (requiere permiso `roles.manage`).

---

### 8. `permissions.ts` (`/api/permissions`)
Catálogo de permisos de seguridad del sistema.

- **Métodos**: `GET`
- **Funciones**:
  - `handler(req, res)`: Retorna la lista completa de permisos disponibles con su clave y descripción (requiere permiso `roles.manage`).

---

### 9. `users.ts` (`/api/users`)
Listado de usuarios registrados en el sistema para el panel administrativo.

- **Métodos**: `GET`
- **Funciones**:
  - `handler(req, res)`: Retorna los últimos 100 usuarios registrados con su nombre completo, correo, carrera, rol y estado activo/inactivo (requiere permiso `users.manage`).
