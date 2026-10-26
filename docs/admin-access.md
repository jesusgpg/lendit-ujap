# Separación de administración y comunidad

Las cuentas con rol `ADMIN` o permiso `roles.manage` se consideran administrativas, tanto en la interfaz (`auth.isAdmin`) como en servidor (`isAdministrativeProfile`). El permiso administrativo no habilita la participación en préstamos.

## Navegación

- Cabecera y menú móvil: únicamente Explorar y Administración como destinos de producto.
- Menú de cuenta: accesos a Administración y Explorar; perfil, preferencias, idioma, accesibilidad y cierre de sesión.
- El catálogo se presenta en modo lectura: no muestra publicar, solicitar ni preguntar al propietario.
- Las rutas privadas de comunidad (`/inicio`, `/publicar`, `/mis-publicaciones`, `/solicitudes`, `/mensajes`) redirigen al panel administrativo.

## Contrato API

Con autenticación administrativa válida, las siguientes operaciones responden `403 {ok:false,error:"ADMIN_MARKETPLACE_FORBIDDEN"}`, incluso si el rol también tiene permisos de publicación o alquiler:

| Endpoint | Operaciones restringidas |
| --- | --- |
| `/api/items` | POST, PATCH y DELETE, incluyendo `resource:request` |
| `/api/items?mine=1` | GET de publicaciones personales |
| `/api/items?view=requests` | GET de solicitudes personales |
| `/api/messages` | GET y POST de bandeja, historial, consultas y mensajes personales |
| `/api/payments` | GET y POST del flujo de pago personal simulado |

El GET general del catálogo permanece disponible. Los endpoints de gestión administrativa y del perfil propio conservan sus permisos existentes. Esta regla no elimina publicaciones o solicitudes antiguas ni modifica roles en la base de datos.

Los estudiantes y profesores mantienen los flujos existentes. La comprobación de tipos/compilación no sustituye una prueba funcional de autorización con sesiones de ambos perfiles.


## Matriz de permisos administrativos

| Sección / ruta | Permiso en menú y ruta | API |
| --- | --- | --- |
| Roles y permisos (`/admin/roles`) | `roles.manage` | `/api/roles`, `/api/roles/:id`, `/api/permissions`: `roles.manage` |
| Usuarios (`/admin/users`) | `users.manage` | `/api/users`, `/api/users/:id`: `users.manage` |
| Tipos de artículo (`/admin/categories`) | `categories.manage` | `/api/categories`: `categories.manage`; búsqueda Unsplash además exige `roles.manage` |
| Escuelas (`/admin/schools`) y carreras (`/admin/careers`) | `careers.manage` | `/api/schools`, `/api/careers`: `careers.manage` |

Sin sesión: 401 y redirección al login administrativo. Con sesión pero sin el permiso de la sección: 403 en API y pantalla de acceso denegado (`/admin/acceso-denegado`). `/admin` redirige a la primera sección autorizada.

## Protección del último administrador

Administrador efectivo = usuario activo cuyo rol incluye `roles.manage`. El servidor (`api/_lib/adminGuard.ts`) responde `409 LAST_ADMIN` si un cambio de rol, desactivación o edición de permisos de rol dejaría cero administradores efectivos. La comprobación y el cambio ocurren dentro de una transacción con `pg_advisory_xact_lock`, de modo que dos peticiones simultáneas no pueden dejar el sistema sin administradores. No se probó contra una base de datos real. El borrado definitivo de usuarios no existe.

`PATCH /api/roles/:id` responde `400 UNKNOWN_PERMISSION` ante claves inexistentes, en lugar de ignorarlas. No se implementó el renombrado de roles: los roles se identifican por nombre en el código (`ADMIN`, `STUDENT`, `PROFESSOR`).
