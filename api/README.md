# Entrada HTTP de la API (`api/`)

Esta carpeta contiene **una única función de Vercel**, [`index.ts`](index.ts). Los controladores están en [`backend/`](../backend/) y las rutas se registran en [`server/app.ts`](../server/app.ts). En desarrollo, `pnpm dev:api` inicia ese mismo router en el puerto 8787. No agregues otros handlers ni pruebas a `api/`.

La reescritura `/api/:path*` de `vercel.json` delega en esta entrada con `__apiPath`; `index.ts` reconstruye la ruta y conserva los otros parámetros de consulta. Las rutas no registradas responden `404 API_NOT_FOUND` en JSON.

## Endpoints y acceso

Las rutas que requieren sesión reciben `Authorization: Bearer <token de Supabase>`. Los handlers comprueban también perfil activo, permisos, propiedad, audiencia y estado del recurso cuando corresponde. Esta tabla resume el acceso; no sustituye esas validaciones.

| Ruta pública | Métodos | Uso y acceso |
| --- | --- | --- |
| `/api/health` | GET | Público. Consulta PostgreSQL; 200 con `database: "up"` o 503 con `database: "down"`. |
| `/api/items` | GET, POST, PATCH, DELETE | Catálogo, publicaciones y solicitudes; las mutaciones requieren sesión y las reglas de marketplace. `items.publish` para publicar, `items.rent` para solicitar. |
| `/api/me` | GET, PATCH | Perfil propio, sincronización y actualización de datos según permisos. |
| `/api/categories` | GET, POST | Consulta pública; gestión con `categories.manage`. |
| `/api/categories/:key` | PATCH, DELETE | Gestión con `categories.manage`; no se elimina una categoría en uso. |
| `/api/careers` | GET, POST | Consulta pública; gestión con `careers.manage`. |
| `/api/careers/:id` | PATCH, DELETE | Gestión con `careers.manage`; se comprueban referencias antes de eliminar. |
| `/api/schools` | GET, POST | Consulta pública; gestión con `careers.manage`. |
| `/api/schools/:id` | PATCH, DELETE | Gestión con `careers.manage`. |
| `/api/roles` | GET, POST | Consulta autenticada; creación con `roles.manage`. |
| `/api/roles/:id` | PATCH, DELETE | Gestión de roles y permisos con `roles.manage`. |
| `/api/permissions` | GET | Catálogo de permisos con `roles.manage`. |
| `/api/users` | GET | Directorio con `users.manage`. |
| `/api/users/:id` | PATCH | Rol/estado con `users.manage`; protección del último administrador y requisitos de acreditación docente. |
| `/api/users/:id/reset-password` | POST | Solicitar correo de recuperación con `users.manage`; no confirma su entrega. |
| `/api/messages` | GET, POST | Bandeja, consultas de artículos y mensajes entre participantes. Perfiles administrativos excluidos del chat de marketplace. |
| `/api/notifications` | GET, PATCH | Notificaciones propias y marcado como leídas. |
| `/api/payments` | GET, POST | Cuenta/wallet, pagos simulados y configuración central; reglas según vista y acción. |
| `/api/teacher-verifications/me` | GET, POST | Consulta y envío de acreditación propia. |
| `/api/teacher-verifications/me/credential` | GET | URL firmada temporal de credencial propia. |
| `/api/admin/teacher-verifications` | GET | Bandeja de revisión con `teachers.review`. |
| `/api/admin/teacher-verifications/:id` | GET | Expediente con `teachers.review`. |
| `/api/admin/teacher-verifications/:id/decision` | POST | Dictamen con `teachers.review` y control de versión. |

## Convenciones de solicitudes

`GET /api/items?mine=1` (también `mine=true`) consulta publicaciones propias. `GET /api/items?view=requests` devuelve las solicitudes del usuario. Las solicitudes se crean en el mismo endpoint:

```json
{
  "resource": "request",
  "itemId": "UUID_DEL_ARTICULO",
  "startsAt": "2026-11-02T08:00:00.000Z",
  "endsAt": "2026-11-02T16:00:00.000Z",
  "message": "¿Podemos encontrarnos en la biblioteca?"
}
```

Sustituye los identificadores y usa fechas futuras válidas para el artículo. Para actuar sobre una solicitud se usa PATCH con `resource: "request"`, `requestId` y `action`: `approve`, `reject`, `cancel` o `return`. La acción permitida depende del participante y del estado; no basta con tener un permiso genérico.

## Mensajes y notificaciones

- `GET /api/messages?view=inbox&page=0`: bandeja paginada.
- POST con `action: "start"` e `itemId`: iniciar una consulta sobre un artículo.
- GET o POST con `conversationId` o `requestId` (excluyentes): consultar o enviar mensajes; para enviar se añade `content`.
- `GET /api/notifications`: notificaciones propias; PATCH admite las acciones `read` y `read-all` según el esquema de `backend/notifications.ts`.

Las conversaciones se unifican mediante `ItemConversation`; las solicitudes mantienen su contexto. Consulta [chat](../docs/chat.md) y los handlers para las restricciones y los cursores de paginación.

## Pagos demostrativos

`backend/payments.ts` admite estas operaciones:

- GET con `view=account`: wallets, movimientos, tasas y cuenta central disponibles para el usuario.
- GET con `requestId`: pago de una solicitud accesible.
- POST con `action: "mobile-rental"`, `"wallet-top-up"` o `"wallet-rental"`: pago o recarga simulados. Consulta los esquemas del handler para los campos obligatorios.
- GET con `view=admin-settings` y POST con `action: "save-central-account"`: configuración de cuenta central con `payments.manage`.

El éxito se registra como `SIMULATED_PAID`. El comprobante, referencia y tasa BCV no constituyen una validación bancaria ni implican un cobro real.

## Referencias y verificación

- [Servidor compartido](../server/README.md) y [preparación del proyecto](../README.md).
- [Referencia HTTP](../docs/api-reference.md), [OpenAPI](../contracts/openapi.json), [pagos](../docs/payments.md) y [acreditación docente](../docs/teacher-verification-contract.md).
- [Pruebas de integración](../tests/api/README.md), ejecutables con `pnpm test:api`.

La referencia y el generador OpenAPI pueden quedar rezagados frente a handlers nuevos: verifica su cobertura antes de usarlos como contrato completo. El inventario ejecutable es `server/app.ts`; los métodos y esquemas los define cada handler de `backend/`. La autenticación y el almacenamiento utilizan Supabase; no existen endpoints locales `/api/login` o `/api/register`.
