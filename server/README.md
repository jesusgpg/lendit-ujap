# Servidor compartido (`server/`)

La aplicación Express 5 de [`app.ts`](app.ts) registra las rutas `/api/*` y llama a los handlers de [`backend/`](../backend/). Se reutiliza en desarrollo, pruebas y producción.

## Desarrollo local

```bash
pnpm dev:full
# O solo el servidor de API:
pnpm dev:api
```

[`dev-api.ts`](dev-api.ts) carga `.env` e inicia el servidor en el puerto **8787**, modificable con `DEV_API_PORT`. Vite redirige las peticiones `/api` al mismo puerto; el frontend normalmente escucha en `5173`. No se necesita una cuenta de Vercel para iniciar el servidor, pero las funciones que acceden a datos y autenticación requieren las conexiones de PostgreSQL y Supabase descritas en el [README principal](../README.md).

## Producción y rutas

Vercel ejecuta una única función, [`api/index.ts`](../api/index.ts). La reescritura de [`vercel.json`](../vercel.json) envía `/api/:path*` a `/api?__apiPath=/:path*`; la entrada reconstruye la URL conservando los demás parámetros y delega en `app.ts`. No se despliega un archivo de función por cada endpoint.

El flujo es:

```text
Local:      navegador → proxy Vite → server/dev-api.ts → server/app.ts → backend/
Producción: navegador → rewrite Vercel → api/index.ts → server/app.ts → backend/
Pruebas:    Supertest → server/app.ts → backend/
```

`app.ts` es la fuente de verdad del inventario de rutas. Incluye catálogo y solicitudes, perfil, categorías, carreras, escuelas, roles, permisos, usuarios, mensajes, pagos, notificaciones y verificación docente. Consulta la [guía de API](../api/README.md) y la [referencia HTTP](../docs/api-reference.md).

## Adaptación de handlers

- `wrap` entrega al handler un objeto con método, cabeceras, cuerpo y query, y convierte las excepciones no controladas en `500 INTERNAL_ERROR`.
- `withParamsAsQuery` combina parámetros dinámicos (`:id`, `:key`) con la query en un objeto nuevo. Evita mutar `req.query`, que es de solo lectura en Express 5.
- Las rutas no registradas responden `404 API_NOT_FOUND` en JSON.
- Los imports internos usan extensión `.js`, necesaria para el JavaScript compilado, aunque los archivos fuente sean TypeScript.

## Verificación

`server/api-routing.spec.ts` comprueba el enrutamiento. `pnpm test:api` ejecuta los handlers con PostgreSQL temporal y un proveedor de identidad local; sus requisitos y límites están en [tests/api/README.md](../tests/api/README.md).

Después de generar un build local de Vercel, `node scripts/qa-vercel-runtime.mjs` comprueba el arranque del paquete emitido y respuestas sin autenticación. Esta comprobación no certifica conexiones a servicios externos.
