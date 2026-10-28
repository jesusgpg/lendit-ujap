# Gestión de Roles Específicos (`api/roles/`)

Esta carpeta gestiona los endpoints dinámicos para operaciones sobre un rol individual identificado por su ID en la URL (`/api/roles/:id`).

---

## Archivos y Funciones

### 1. `[id].ts` (`/api/roles/:id`)
Controlador serverless que procesa la actualización de permisos y la eliminación de roles específicos.

#### Métodos Soportados
- `PATCH`: Modificación de la descripción y reasignación completa de permisos de un rol.
- `DELETE`: Eliminación de un rol del sistema.

#### Funciones y Lógica

| Elemento | Tipo | Descripción |
|---|---|---|
| `updateRoleSchema` | Esquema Zod | Valida el cuerpo de la petición: `description` (opcional, máximo 300 caracteres) y `permissionKeys` (arreglo de claves de permisos en cadena). |
| `PROTECTED_ROLE_NAMES` | Constante (`string[]`) | Define los roles protegidos del sistema (`ADMIN`, `STUDENT`, `PROFESSOR`) que no pueden ser eliminados bajo ninguna circunstancia. |
| `handler(req, res)` | Función exportada por defecto | Punto de entrada del endpoint dinámico: |

#### Lógica Detallada del `handler`
1. **Autenticación y Autorización**:
   - Resuelve el perfil autenticado mediante `getAuthenticatedProfile(req)`.
   - Verifica que el usuario cuente con el permiso `roles.manage`. Si no lo tiene, responde `403 FORBIDDEN`.
2. **Operación `DELETE`**:
   - Valida que el rol exista en la base de datos.
   - Bloquea la eliminación si el rol está en `PROTECTED_ROLE_NAMES` (retorna `409 ROLE_PROTECTED`).
   - Verifica si hay usuarios con este rol asignado en la base de datos (`prisma.user.count`). Si existen usuarios vinculados, bloquea la eliminación retornando `409 ROLE_IN_USE`.
   - Si no está en uso y no está protegido, ejecuta `prisma.role.delete`.
3. **Operación `PATCH`**:
   - Valida el payload con `updateRoleSchema`.
   - Consulta el rol por su ID.
   - Resuelve los IDs de los permisos solicitados mediante `permissionKeys`.
   - Ejecuta una transacción atómica (`prisma.$transaction`) que:
     - Actualiza la descripción si fue provista.
     - Elimina las asociaciones anteriores en `RolePermission` para este rol.
     - Inserta los nuevos registros en `RolePermission`.
     - Retorna el rol actualizado con su lista consolidada de permisos.
