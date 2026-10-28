# Gestión de Usuarios Específicos (`api/users/`)

Esta carpeta contiene los endpoints dinámicos para operaciones directas sobre cuentas de usuario identificadas por su identificador único (`/api/users/:id`).

---

## Archivos y Subrutas

### 1. `[id].ts` (`/api/users/:id`)
Controlador serverless para modificar el estado o rol de una cuenta de usuario específica.

#### Métodos Soportados
- `PATCH`: Actualización del rol asignado y/o activación/desactivación de la cuenta (`isActive`).

#### Funciones y Lógica

| Elemento | Tipo | Descripción |
|---|---|---|
| `updateUserSchema` | Esquema Zod | Valida que se provea al menos un campo válido: `roleId` (UUID) o `isActive` (booleano). |
| `handler(req, res)` | Función exportada por defecto | Gestiona la actualización de la cuenta del usuario: |

#### Lógica Detallada del `handler`
1. **Validación de Acceso**:
   - Resuelve el perfil con `getAuthenticatedProfile(req)`.
   - Exige el permiso de administración `users.manage`. En caso contrario responde con `403 FORBIDDEN`.
2. **Validación de Identificador**:
   - Extrae el ID del usuario objetivo desde `req.query.id`.
3. **Validación de Rol**:
   - Si se incluye un nuevo `roleId`, valida contra Prisma que el rol realmente exista en la base de datos (de lo contrario retorna `400 INVALID_ROLE`).
4. **Actualización**:
   - Ejecuta `prisma.user.update` para modificar el `roleId` y/o el estado `isActive`.
   - Retorna HTTP 200 con `{ ok: true, user: { id, role, isActive } }`.

---

## Subdirectorios
- **`[id]/`**: Contiene acciones operativas sobre el usuario (e.g., restablecimiento de contraseñas mediante Supabase Auth).
