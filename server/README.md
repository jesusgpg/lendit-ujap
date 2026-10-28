# Servidor de Desarrollo Local (`server/`)

Esta carpeta contiene el servidor Express utilizado durante el desarrollo local (`npm run dev:api` o `pnpm dev:api`). Permite ejecutar y probar exactamente los mismos handlers de la API serverless (`api/*`) sin requerir `vercel dev` ni una cuenta de Vercel.

---

## Archivos y Funciones

### 1. `dev-api.ts`
Punto de entrada del servidor Express local.

#### Funciones

| Función | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `wrap(handler)` | `handler: (req: Request, res: Response) => unknown` | `(req: Request, res: Response) => Promise<void>` | Envoltorio de seguridad (*wrapper*) que captura cualquier excepción no controlada dentro del handler serverless, registra el error en consola y responde con código HTTP 500 y payload `{ ok: false, error: 'INTERNAL_ERROR' }`. |
| `withParamsAsQuery(handler)` | `handler: (req: Request, res: Response) => unknown` | Función envuelta | Emula el comportamiento nativo de Vercel Serverless Functions. En Vercel, los segmentos dinámicos de ruta como `[id]` o `[key]` se inyectan en `req.query`. En Express se reciben en `req.params`. Esta función crea un objeto de solicitud que combina `req.query` y `req.params` de forma inmutable (compatible con Express 5). |

#### Mapeo de Rutas del Servidor Local

| Ruta Express | Handler Serverless Destino | Parámetros Enrutados |
|---|---|---|
| `/api/health` | `api/health.ts` | — |
| `/api/items` | `api/items.ts` | — |
| `/api/me` | `api/me.ts` | — |
| `/api/categories` | `api/categories.ts` | — |
| `/api/categories/:key` | `api/categories.ts` | `key` inyectado en `req.query.key` |
| `/api/careers` | `api/careers.ts` | — |
| `/api/careers/:id` | `api/careers.ts` | `id` inyectado en `req.query.id` |
| `/api/schools` | `api/schools.ts` | — |
| `/api/roles` | `api/roles.ts` | — |
| `/api/roles/:id` | `api/roles/[id].ts` | `id` inyectado en `req.query.id` |
| `/api/permissions` | `api/permissions.ts` | — |
| `/api/users` | `api/users.ts` | — |
| `/api/users/:id` | `api/users/[id].ts` | `id` inyectado en `req.query.id` |
| `/api/users/:id/reset-password` | `api/users/[id]/reset-password.ts` | `id` inyectado en `req.query.id` |
