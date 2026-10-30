# LendIt UJAP 🤝

LendIt UJAP es una plataforma de préstamos y alquileres temporales de objetos para la comunidad de la **Universidad José Antonio Páez (UJAP)**. Permite publicar artículos, coordinar solicitudes y devoluciones y conversar con otros miembros del campus.

Proyecto desarrollado para **Electiva Profesional III – Tópicos Especiales en Programación Web**. Los pagos son demostrativos: el sistema registra operaciones simuladas y no verifica transferencias ni realiza cargos bancarios reales.

## Stack tecnológico

- **Frontend:** Vue 3 (Composition API y `<script setup>`), TypeScript, Vue Router y Pinia.
- **Interfaz:** CSS propio, temas claro/oscuro y opciones de accesibilidad; Fraunces, Archivo e IBM Plex Mono. Validación con VeeValidate y Zod; notificaciones con Notivue.
- **Backend:** Express 5 con un router compartido entre desarrollo local y una única función de Vercel.
- **Datos y autenticación:** PostgreSQL, Prisma 7, Supabase Auth, Storage y Realtime.
- **Herramientas:** Vite, pnpm, Vitest y Supertest.

## Funcionalidades implementadas

- **Catálogo:** búsqueda y filtros, categorías, artículos con varias fotos y modalidades de préstamo gratuito (`LOAN`) o alquiler (`RENTAL`) en USD, EUR o VES.
- **Publicaciones:** creación, edición, pausa, reactivación y eliminación según permisos y estado; audiencia restringible por rol y fotos en Supabase Storage.
- **Solicitudes y préstamos:** fechas de inicio y devolución, mensaje al propietario, aprobación, rechazo, cancelación y registro de devolución. Las solicitudes se gestionan desde `/api/items` con `view=requests` o `resource: "request"`.
- **Cuenta:** registro institucional `@ujap.edu.ve`, confirmación de correo, inicio de sesión, recuperación/cambio de contraseña y edición del perfil. Carnet estudiantil y credenciales docentes en almacenamiento privado.
- **Verificación docente:** postulación, carga de credenciales, revisión administrativa y dictámenes. Los postulantes pendientes de aprobación tienen restringidas las operaciones del marketplace.
- **Mensajes y notificaciones:** consultas sobre artículos y conversaciones vinculadas a solicitudes, bandeja en `/mensajes`, indicadores de lectura y actualizaciones mediante Supabase Realtime.
- **Pagos simulados:** Pago Móvil con referencia y comprobante, wallet por moneda, recargas y pagos de alquiler. Conversión a bolívares con tasa BCV y configuración administrativa de una cuenta receptora central. El estado de éxito es `SIMULATED_PAID`.
- **Administración:** roles/permisos, usuarios, categorías, carreras, escuelas, verificaciones docentes y cuenta receptora de pagos.

Los artículos quedan disponibles al publicarse; no existe una cola de moderación de publicaciones. El acceso administrativo separado permite cuentas no institucionales con permisos administrativos. La selección de una cuenta docente al registrarse no sustituye la verificación de credenciales.

## Estructura del proyecto

```text
api/index.ts        # Entrada única de Vercel; no agregar otros handlers aquí
backend/            # Handlers HTTP, autorización, pagos y reglas de negocio
server/app.ts       # Router Express compartido por Vercel, desarrollo y pruebas
server/dev-api.ts   # Inicio del servidor local
src/
├── components/     # Formularios, galerías, chat y paneles reutilizables
├── composables/    # Alertas y suscripciones a mensajes/notificaciones
├── data/           # Contenido estático de la landing; no inventario simulado
├── lib/            # Clientes HTTP/Supabase, imágenes y utilidades
├── router/         # Rutas de Vue Router
├── stores/         # Estado y acceso a los datos remotos con Pinia
├── types/          # Tipos de la aplicación
├── views/          # Pantallas públicas, cuenta, marketplace y administración
├── style.css       # Tokens y estilos de marca
└── main.ts         # Inicio de Vue y controles de navegación
shared/             # Reglas compartidas, incluida la política de correo
prisma/             # Esquema y migraciones de PostgreSQL/Supabase
scripts/            # Generación de contratos, pruebas y utilidades
contracts/          # Especificación OpenAPI
tests/api/         # Pruebas de integración HTTP y BD temporal
docs/              # Guías, contratos y reportes de implementación
design-system/     # Sistema visual del proyecto
```

## Preparación y desarrollo local

Usa **Node.js 22.12 o posterior de la rama 22**, o una versión compatible con las dependencias instaladas, y **pnpm 10.19.0** (declarado en `package.json`). Necesitas un proyecto de Supabase para Auth, Storage y Realtime, además de PostgreSQL accesible para la API.

1. Copia `.env.example` a `.env` y completa las variables indicadas abajo. En PowerShell: `Copy-Item .env.example .env`.
2. Instala las dependencias:

   ```bash
   pnpm install
   ```

   El paso `postinstall` genera el cliente de Prisma. Si modificas el esquema, vuelve a generarlo con `pnpm db:generate`.

3. Aplica las migraciones existentes a la base de datos configurada:

   ```bash
   pnpm db:migrate:deploy
   ```

   Este comando modifica esa base de datos. Las migraciones incluyen tablas, permisos y configuración de Storage de Supabase. Un PostgreSQL independiente no sustituye los servicios de Supabase requeridos para autenticar usuarios y subir archivos.

4. Configura en Supabase Auth la URL del sitio y las redirecciones de confirmación y recuperación para tu origen local (`http://localhost:5173`). Las pantallas de callback son `/auth/confirmacion` y `/auth/reset-password`.
5. Inicia frontend y API:

   ```bash
   pnpm dev:full
   ```

Vite usa normalmente `http://localhost:5173`; la API escucha en `http://localhost:8787`. Vite redirige `/api` a ese servidor. Puedes cambiar el puerto del backend con `DEV_API_PORT`. `pnpm dev` inicia únicamente el frontend; `pnpm dev:api`, únicamente la API. No se necesita ejecutar `vercel dev` para desarrollo local.

### Variables de entorno

Consulta los ejemplos de formato en [`.env.example`](.env.example).

| Variables | Uso |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Cliente público de Supabase en el navegador. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Cliente Supabase del backend. |
| `DATABASE_URL` | Conexión PostgreSQL de la API; el ejemplo usa el pooler de Supabase. |
| `DIRECT_URL` | Conexión para comandos de Prisma que acceden a la BD, incluidas migraciones. No es necesaria para generar el cliente. |
| `APP_URL` | Origen de la aplicación para enlaces de autenticación. |
| `VITE_API_BASE_URL` | Opcional si la API está en otro origen; dejar vacío con el proxy local o con Vercel en el mismo dominio. |
| `SUPABASE_SECRET_KEY` | Placeholder opcional en `.env.example`; los handlers actuales no la utilizan. No es necesaria para el correo de recuperación. |
| `UNSPLASH_ACCESS_KEY` | Opcional, para búsqueda de fotos de categorías desde el backend. |
| `LENDIT_MOBILE_HOLDER`, `LENDIT_MOBILE_BANK`, `LENDIT_MOBILE_PHONE`, `LENDIT_MOBILE_NATIONAL_ID` | Datos de respaldo de la cuenta central de Pago Móvil; también puede configurarse desde `/admin/pagos`. |
| `DEV_API_PORT` | Opcional, puerto de API local; por defecto `8787`. |

Las variables `VITE_*` se incluyen en el navegador: no deben contener secretos. No versiones archivos `.env` con credenciales. El registro comunitario exige correo institucional; los antiguos flags de correos de prueba no habilitan excepciones a esa política.

## Rutas principales

| Área | Rutas |
| --- | --- |
| Públicas | `/`, `/catalogo`, `/como-funciona` (alias `/comofunciona`), `/categorias`, `/confianza` |
| Autenticación | `/login`, `/register`, `/recuperar-contrasena`, `/auth/confirmacion`, `/auth/reset-password`, `/admin/login` |
| Marketplace autenticado | `/inicio`, `/publicar`, `/mis-publicaciones`, `/solicitudes`, `/mensajes` |
| Cuenta | `/cuenta/perfil`, `/cuenta/carnet`, `/cuenta/acreditacion`, `/cuenta/preferencias`, `/cuenta/seguridad`, `/cuenta/pagos` |
| Administración | `/admin/roles`, `/admin/users`, `/admin/categories`, `/admin/careers`, `/admin/schools`, `/admin/verificaciones-docentes`, `/admin/pagos` |

Las rutas protegidas comprueban sesión y permisos. Al intentar publicar o solicitar sin sesión, se conserva la ruta pendiente durante el acceso.

## Roles y permisos

Los roles son datos de las tablas `Role`, `Permission` y `RolePermission`. El panel `/admin/roles` permite gestionar roles y permisos con `roles.manage`. Otras secciones usan `users.manage`, `categories.manage`, `careers.manage`, `teachers.review` y `payments.manage` según corresponda.

Los perfiles de estudiante y profesor participan en el marketplace según sus permisos y estado de verificación. Los perfiles administrativos tienen un flujo separado; no deben usarse como cuentas de préstamo para las pruebas funcionales.

Para asignar un rol existente a un usuario que ya tiene perfil en la BD:

```bash
pnpm db:promote admin@gmail.com ADMIN
```

El comando no crea la identidad en Supabase ni registra un perfil nuevo. Crea primero la identidad y su perfil correspondiente; después accede por `/admin/login`. Consulta [acceso administrativo](docs/admin-access.md).

## Comandos y verificación

| Comando | Propósito |
| --- | --- |
| `pnpm dev:full` | Frontend y API local en paralelo. |
| `pnpm dev` / `pnpm dev:api` | Iniciar cada servidor por separado. |
| `pnpm build` | Comprobar tipos de frontend/backend y compilar con Vite. |
| `pnpm preview` | Previsualizar el frontend compilado; no inicia la API. |
| `pnpm test` | Vitest en modo interactivo. |
| `pnpm test --run` | Ejecutar las pruebas normales una vez. |
| `pnpm test:api` | Integración HTTP con Supertest y PostgreSQL temporal. |
| `pnpm test:last-admin` | Verificaciones adicionales de protección del último administrador. |
| `pnpm docs:api` | Regenerar OpenAPI; el generador debe mantenerse alineado con el router. |
| `pnpm db:generate` / `pnpm db:validate` | Generar el cliente o validar el esquema Prisma. |
| `pnpm db:migrate` | Crear/aplicar migraciones durante desarrollo. |
| `pnpm db:migrate:deploy` | Aplicar migraciones existentes al entorno configurado. |
| `pnpm db:studio` | Explorar los datos con Prisma Studio. |

`test:api` requiere los binarios de PostgreSQL (`initdb` y `pg_ctl`). En Windows busca PostgreSQL 18; puedes indicar otra instalación con `QA_POSTGRES_BIN`. Genera evidencias en `output/qa-api/`. No requiere iniciar los servidores ni conectarse a Supabase: simula el proveedor de identidad, pero usa handlers, Prisma y PostgreSQL reales. No verifica correo, contraseñas, RLS ni el despliegue. Consulta [pruebas de API](tests/api/README.md).

## Despliegue en Vercel

`vercel.json` ejecuta `pnpm build`, sirve `dist` y envía `/api/:path*` a **una única función**, [`api/index.ts`](api/index.ts). Esta recupera la ruta pública y delega en `server/app.ts`; los handlers viven en `backend/`. Las rutas API desconocidas devuelven JSON 404. No agregues handlers o pruebas dentro de `api/`, pues podrían convertirse en funciones adicionales.

1. Importa el repositorio usando la raíz del proyecto y una versión de Node compatible con las dependencias.
2. Configura para cada entorno las variables de Supabase, `DATABASE_URL`, `DIRECT_URL` y `APP_URL`. Añade las variables opcionales de las funciones que utilices.
3. Deja `VITE_API_BASE_URL` vacío si frontend y API comparten dominio.
4. Aplica las migraciones pendientes con `pnpm db:migrate:deploy` usando la conexión del entorno correspondiente, antes de probar la nueva API.
5. Configura en Supabase Auth el dominio y las URLs de redirección de confirmación y recuperación. `APP_URL` debe apuntar al mismo origen.
6. Comprueba `/`, `/login`, `/register`, `/admin/login` y `/api/health`. El health check informa de la conexión a PostgreSQL, no del funcionamiento completo de Auth o Storage.

Para comprobar un paquete serverless local, ejecuta `pnpm exec vercel build --prod` y después `node scripts/qa-vercel-runtime.mjs`, con la configuración de Vercel preparada. El segundo comando prueba el JavaScript emitido y respuestas 401/404 sin conectar a servicios externos. Los imports internos del servidor usan extensión `.js` para funcionar después de compilar. No publiques un build con placeholders `[SENSITIVE]` en lugar de las variables reales.

Existe además un workflow de **GitHub Pages** en `.github/workflows/deploy.yml`, que usa `GH_PAGES=true` para servir el frontend bajo `/lendit-ujap/`. Pages solo aloja archivos estáticos: no ejecuta esta API. Un despliegue completo necesita también el backend y los servicios configurados.

## Documentación relacionada

- [Entrada de API](api/README.md), [servidor compartido](server/README.md) y [referencia HTTP](docs/api-reference.md).
- [Contrato OpenAPI](contracts/openapi.json).
- [Cuenta y preferencias](docs/account-settings.md) y [verificación docente](docs/teacher-verification-contract.md).
- [Chat](docs/chat.md), [pagos simulados](docs/payments.md) e [imágenes de categorías](docs/category-images.md).
- [Sistema de diseño](design-system/lendit-ujap/MASTER.md) y [créditos de imágenes](docs/image-credits.md).

Los contratos y reportes describen su alcance y fecha; para resolver discrepancias, contrasta con `server/app.ts`, los handlers de `backend/`, `prisma/schema.prisma` y los scripts de `package.json`.

## Pendiente

- Integración y verificación de pagos bancarios reales, si el alcance del proyecto lo requiere.
- Flujo completo de reputación/calificaciones, QR de un solo uso y moderación de artículos. Tener modelos o permisos definidos no equivale a disponer de esos flujos en la interfaz y la API.
- Configuración formal de ESLint/Prettier.
