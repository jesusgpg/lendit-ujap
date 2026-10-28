# Enrutamiento de la Aplicación (`src/router/`)

Esta carpeta configura el enrutador cliente de Vue Router (`createRouter`, `createWebHistory`) para la navegación en LendIt UJAP, definiendo rutas públicas, rutas autenticadas y rutas administrativas protegidas por permisos.

---

## Archivos y Configuración

### 1. `index.ts`
Define la tabla de rutas de la aplicación y sus respectivos metadatos de seguridad (`meta`).

#### Estructura de Rutas

| Ruta (`path`) | Nombre (`name`) | Componente Vista | Metadatos (`meta`) | Propósito |
|---|---|---|---|---|
| `/` | `landing` | `LandingView.vue` | — | Página de aterrizaje con presentación de la red, categorías destacadas y cómo funciona. |
| `/catalogo` | `catalog` | `CatalogView.vue` | — | Explorador interactivo del catálogo de objetos disponibles para préstamo o alquiler. |
| `/publicar` | `publish` | `PublishView.vue` | `{ requiresAuth: true }` | Formulario de publicación de un nuevo objeto para la comunidad universitaria. |
| `/mis-publicaciones` | `my-publications` | `MyPublicationsView.vue` | `{ requiresAuth: true }` | Panel personal donde el usuario visualiza, edita, pausa o elimina sus objetos publicados. |
| `/solicitudes` | `requests` | `RequestsView.vue` | `{ requiresAuth: true }` | Gestión de solicitudes de préstamo enviadas y recibidas, con acciones de aprobación, rechazo y devolución. |
| `/login` | `login` | `LoginView.vue` | — | Inicio de sesión con correo institucional `@ujap.edu.ve`. |
| `/register` | `register` | `RegisterView.vue` | — | Registro de nuevos estudiantes y profesores con foto de perfil y selección de carrera. |
| `/admin/login` | `admin-login` | `AdminLoginView.vue` | — | Acceso restringido para cuentas con privilegios administrativos. |
| `/admin` | `admin` | `AdminView.vue` | `{ requiredPermission: 'roles.manage' }` | Panel de control central del campus con navegación por pestañas secundarias. |
| `/admin/roles` | `admin-roles` | `RoleManagerPanel.vue` | *(Heredado)* | Gestión de roles y matriz de permisos del sistema. |
| `/admin/users` | `admin-users` | `UsersManagerPanel.vue` | *(Heredado)* | Administración y activación de cuentas de usuario. |
| `/admin/categories` | `admin-categories` | `CategoriesManagerPanel.vue` | *(Heredado)* | Mantenimiento del catálogo de categorías e iconos. |
| `/admin/careers` | `admin-careers` | `CareersManagerPanel.vue` | *(Heredado)* | Configuración de facultades y carreras universitarias. |

#### Manejo de Permisos y Guardias
Las guardias de navegación se implementan en `main.ts` interceptando las transiciones con `router.beforeEach`:
1. Si la ruta especifica `requiresAuth: true` y el usuario no ha iniciado sesión, es redirigido a `/login?redirect=<destino>`.
2. Si la ruta especifica `requiredPermission: '...'` y el usuario no cuenta con dicho permiso en su perfil resuelto, es redirigido a `/admin/login?redirect=<destino>`.
