# Endpoints Serverless de la API (`api/`)

Esta carpeta alberga los controladores serverless que exponen la API REST de LendIt UJAP. Se ejecutan como Vercel Serverless Functions en producción y bajo un servidor Express en desarrollo local (`npm run dev:api`).

---

## 1. Matriz de Endpoints y Permisos

| Endpoint | Métodos | Permiso Requerido | Descripción Rápida |
|---|---|---|---|
| `/api/health` | `GET` | Ninguno (público) | Comprobación de salud de conexión a la base de datos PostgreSQL. |
| `/api/items` | `GET` | Ninguno / Autenticado | Catálogo de artículos disponibles o solicitudes del usuario (`?view=requests`). |
| `/api/items` | `POST` | `items.publish` | Publicación de un nuevo objeto para préstamo o alquiler. |
| `/api/items` *(resource: request)* | `POST` | `items.rent` | Emisión de una solicitud de préstamo sobre un objeto. |
| `/api/items` | `PATCH` | Dueño / `users.manage` | Actualización de datos de un objeto (título, descripción, foto, pausa). |
| `/api/items` *(resource: request)* | `PATCH` | `items.rent` | Transiciones de estado de solicitudes (`approve`, `reject`, `cancel`, `return`). |
| `/api/items` | `DELETE` | Dueño / `users.manage` | Eliminación de un artículo sin historial activo de préstamos. |
| `/api/me` | `GET` | Autenticado | Obtención del perfil, rol y permisos del usuario autenticado. |
| `/api/me` | `PATCH` | Autenticado / `profile.update` | Actualización o inicialización del perfil de usuario y foto. |
| `/api/categories` | `GET` | Ninguno (público) | Lista de categorías disponibles. |
| `/api/categories` | `POST` | `categories.manage` | Creación de una nueva categoría temática. |
| `/api/categories/:key` | `PATCH`, `DELETE` | `categories.manage` | Modificación o eliminación de una categoría existente. |
| `/api/careers` | `GET` | Ninguno (público) | Lista de carreras académicas y escuelas. |
| `/api/careers` | `POST` | `careers.manage` | Registro de una nueva carrera universitaria. |
| `/api/careers/:id` | `PATCH`, `DELETE` | `careers.manage` | Modificación o retiro de una carrera sin estudiantes asociados. |
| `/api/schools` | `GET`, `POST` | `careers.manage` (POST) | Lista y registro de facultades/escuelas universitarias. |
| `/api/roles` | `GET`, `POST` | Autenticado (GET) / `roles.manage` (POST) | Consulta de roles y creación de nuevos roles con permisos asignados. |
| `/api/permissions` | `GET` | `roles.manage` | Catálogo maestro de permisos del sistema. |
| `/api/users` | `GET` | `users.manage` | Directorio de usuarios para el panel de administración. |

---

## 2. Especificación Técnica por Controlador

### `items.ts` (`/api/items`)
Controlador central que orquesta tanto la gestión de artículos como el punto de entrada para las mutaciones de solicitudes de préstamo.

#### Parámetros de Consulta (`req.query`)
- `mine=1` o `mine=true`: Filtra exclusivamente los objetos cuyo dueño es el usuario autenticado (`ownerId === profile.id`), incluyendo artículos pausados.
- `view=requests`: Desvía la respuesta hacia `listRequests()` para devolver las solicitudes entrantes y salientes del usuario.

#### Ejemplos de Carga Útil (Payloads)

##### Creación de Artículo (`POST /api/items`)
```json
{
  "title": "Bata de Laboratorio Talla M",
  "categoryKey": "herramientas",
  "duration": "2 días",
  "description": "Limpia y en perfecto estado, obligatoria para Química I.",
  "photoUrl": "https://.../storage/v1/object/public/item-photos/usr123/foto.jpg",
  "mode": "RENTAL",
  "price": 2.50,
  "currency": "USD",
  "restrictedToRoles": ["STUDENT"]
}
```

##### Creación de Solicitud (`POST /api/items`)
```json
{
  "resource": "request",
  "itemId": "8a7f9b2c-...",
  "startsAt": "2026-10-30T08:00:00.000Z",
  "endsAt": "2026-10-30T16:00:00.000Z",
  "message": "¿Podemos vernos frente a la biblioteca?"
}
```

##### Acción sobre Solicitud (`PATCH /api/items`)
```json
{
  "resource": "request",
  "action": "approve",
  "requestId": "5e1a2b3c-..."
}
```

---

### `me.ts` (`/api/me`)
Sincroniza y expone el perfil de usuario.

- **Sincronización Automática**: Si un usuario se autentica por primera vez y el trigger de base de datos no creó su fila (por ejemplo en migraciones tempranas), responderá con `409 PROFILE_REQUIRED`. El cliente enviará un `PATCH` vacío y `me.ts` creará automáticamente el registro en la tabla `User` asignando el rol `STUDENT` a partir de los metadatos seguros de Supabase Auth.
- **Respuesta de Perfil (`GET`)**:
```json
{
  "ok": true,
  "user": {
    "id": "usr_9988",
    "name": "Ana Rodríguez",
    "firstName": "Ana",
    "lastName": "Rodríguez",
    "email": "ana.rodriguez@ujap.edu.ve",
    "career": "Ingeniería de Computación",
    "careerId": "car_1234",
    "phone": "04141234567",
    "photo": "https://.../avatar.jpg",
    "role": "STUDENT",
    "permissions": ["items.publish", "items.rent", "profile.update"],
    "emailVerifiedAt": "2026-09-20T10:00:00.000Z"
  }
}
```

---

### `categories.ts` (`/api/categories` y `/api/categories/:key`)
- Valida que las claves se transformen a minúsculas y reemplacen espacios por guiones (`v.toLowerCase().replace(/\s+/g, '-')`).
- `DELETE` comprueba que la categoría no tenga objetos vinculados (`itemsUsingCategory === 0`), devolviendo `409 CATEGORY_IN_USE` en caso contrario.

---

### `careers.ts` (`/api/careers` y `/api/careers/:id`)
- Permite vincular una carrera a una facultad (`schoolId`).
- `DELETE` valida que no existan usuarios inscritos en la carrera (`prisma.user.count({ where: { careerId: id } })`), previniendo errores de integridad referencial.

---

### `roles.ts` (`/api/roles`)
- Normaliza nombres de roles en mayúsculas con guiones bajos (ej. `PREFECTO_AULA`).
- Permite asociar una lista de claves de permisos (`permissionKeys: string[]`) que se traducen en inserciones en `RolePermission`.

---

### `health.ts` (`/api/health`)
- Ejecuta `prisma.$queryRaw\`SELECT 1\``.
- Devuelve HTTP 200 `{ ok: true, database: "up" }` o HTTP 503 `{ ok: false, database: "down" }`.
