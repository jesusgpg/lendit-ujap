# Gestión de Cuentas de Usuario (`api/users/`)

Esta carpeta alberga los controladores para la administración granular de usuarios en el campus, permitiendo reasignar roles de seguridad, activar o suspender el acceso de cuentas y gestionar credenciales.

---

## 1. Métodos Soportados y Permisos

| Endpoint | Método HTTP | Permiso Requerido | Descripción |
|---|---|---|---|
| `/api/users/:id` | `PATCH` | `users.manage` | Modificación del rol asignado y/o estado de activación (`isActive`). |
| `/api/users/:id/reset-password` | `POST` | `users.manage` | Envío de correo de restablecimiento de contraseña vía Supabase Auth. |

---

## 2. Controlador `[id].ts` (`PATCH /api/users/:id`)

### Esquema Zod de Validación (`updateUserSchema`)
```typescript
const updateUserSchema = z.object({
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
})
```

- Valida que al menos uno de los dos campos sea enviado en la petición.
- Si se envía `roleId`, consulta en la tabla `Role` de PostgreSQL que el identificador corresponda a un rol existente antes de proceder; en caso contrario responde `400 INVALID_ROLE`.

### Ejemplo de Carga Útil (`PATCH /api/users/:id`)
```json
{
  "roleId": "a9d8c7b6-1234-...",
  "isActive": false
}
```

### Ejemplo de Respuesta Exitosa (`HTTP 200`)
```json
{
  "ok": true,
  "user": {
    "id": "e4f5a6b7-...",
    "role": {
      "id": "a9d8c7b6-1234-...",
      "name": "STUDENT"
    },
    "isActive": false
  }
}
```

---

## 3. Matriz de Códigos de Error

| Código HTTP | Error (`errorCode`) | Causa |
|---|---|---|
| `400` | `MISSING_USER_ID` | Identificador `:id` ausente en los parámetros de ruta. |
| `400` | `INVALID_USER_UPDATE` | Carga útil vacía o con formatos incorrectos. |
| `400` | `INVALID_ROLE` | El `roleId` provisto no existe en la base de datos. |
| `403` | `FORBIDDEN` | El usuario no posee el permiso administrativo `users.manage`. |
| `500` | `USER_UPDATE_FAILED` | Error interno al ejecutar la actualización en Prisma. |
