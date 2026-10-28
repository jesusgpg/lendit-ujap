# Acciones sobre Usuarios Específicos (`api/users/[id]/`)

Esta subcarpeta contiene endpoints para acciones de administración operativa sobre un usuario puntual identificado por su ID en la URL.

---

## Archivos y Funciones

### 1. `reset-password.ts` (`/api/users/:id/reset-password`)
Endpoint administrativo que dispara el envío de un correo de restablecimiento de contraseña hacia el usuario objetivo.

#### Métodos Soportados
- `POST`: Solicita a Supabase Auth el envío del correo de recuperación.

#### Funciones y Lógica

| Elemento | Tipo | Descripción |
|---|---|---|
| `PasswordRecoveryAuthApi` | Tipo TypeScript | Tipado auxiliar para el método `resetPasswordForEmail` de la API de administración de Supabase. |
| `handler(req, res)` | Función exportada por defecto | Punto de entrada del endpoint de recuperación: |

#### Lógica Detallada del `handler`
1. **Control de Método**:
   - Solo admite solicitudes `POST` (responde `405 METHOD_NOT_ALLOWED` para otros métodos).
2. **Autorización**:
   - Valida el token del solicitante y requiere el permiso administrativo `users.manage`.
3. **Búsqueda del Usuario**:
   - Consulta en PostgreSQL el usuario correspondiente al ID recibido en `req.query.id`, obteniendo su dirección de correo institucional.
   - Si no existe, retorna `404 USER_NOT_FOUND`.
4. **Disparo en Supabase Auth**:
   - Inicializa el cliente de Supabase e invoca `supabase.auth.resetPasswordForEmail(targetUser.email, { redirectTo: process.env.APP_URL })`.
   - Si Supabase responde con error, retorna `502` con el detalle del error.
   - Si la solicitud es exitosa, retorna `200` con `{ ok: true }`.
