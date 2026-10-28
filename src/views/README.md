# Vistas Principales de la Aplicación (`src/views/`)

Esta carpeta contiene las vistas o páginas de nivel superior asociadas a las rutas de Vue Router. Cada vista orquesta componentes específicos, gestiona estados locales de página, interactúa con los almacenes de Pinia y maneja flujos de navegación.

---

## Vistas Disponibles

| Vista | Ruta | Control de Acceso | Descripción |
|---|---|---|---|
| `LandingView.vue` | `/` | Pública | Página de inicio con hero, categorías interactivas, catálogo destacado, sección "Cómo funciona" y pilares de confianza. |
| `CatalogView.vue` | `/catalogo` | Pública | Catálogo completo con buscador en tiempo real, filtro por categorías y modal para solicitar préstamos. |
| `PublishView.vue` | `/publicar` | Requiere autenticación | Flujo de publicación de nuevos objetos para ponerlos a disposición de la comunidad. |
| `MyPublicationsView.vue` | `/mis-publicaciones` | Requiere autenticación | Panel de gestión de objetos publicados por el usuario (editar, pausar, activar y eliminar). |
| `RequestsView.vue` | `/solicitudes` | Requiere autenticación | Tablero de solicitudes de préstamo entrantes (como dueño) y salientes (como prestatario). |
| `LoginView.vue` | `/login` | Pública | Pantalla de inicio de sesión para miembros de la comunidad con correo `@ujap.edu.ve`. |
| `RegisterView.vue` | `/register` | Pública | Pantalla de registro de estudiantes y profesores con selección de carrera y subida de foto. |
| `AdminLoginView.vue` | `/admin/login` | Pública | Portal de autenticación para administradores de la plataforma. |
| `AdminView.vue` | `/admin` | Requiere permiso `roles.manage` | Centro de control del campus con pestañas para roles, usuarios, categorías y carreras. |

---

## Detalle de Funciones por Vista

### 1. `LandingView.vue`
- `openLogin(thenOpenPublish?)`: Redirige al login, pasando la query `redirect=/publicar` si el usuario intentaba publicar.
- `openPublish()`: Comprueba autenticación: si no hay sesión abre el login con redirección programada; si la hay, navega a `/publicar`.
- `handleLogout()`: Dispara notificación informativa cuando se cierra la sesión.
- `handleSelectCategory(categoryKey)`: Muestra notificación guiada sobre la categoría seleccionada o anima al usuario a compartir.
- `handleStepCompleted(stepNum)`: Marca en `localStorage` (mediante `useLocalStorage`) qué pasos del flujo explicativo ya fueron leídos.
- `handleRequestArticle(articleId)`: Orquesta la solicitud de un objeto: si el usuario no ha iniciado sesión lo redirige al login; si está autenticado lo envía al catálogo con el objeto enfocado.

---

### 2. `CatalogView.vue`
- `filteredArticles` *(computada)*: Filtra en memoria reactiva los artículos del store según la categoría seleccionada y la coincidencia de texto en título, categoría, duración o descripción.
- `loadCatalog()`: Ejecuta concurrentemente `articlesStore.load()` y `catalogStore.initialize()`.
- `handleRequest(articleId)`: Verifica autenticación. Si el usuario no ha iniciado sesión, lo redirige a `/login?redirect=/catalogo`; si es el dueño del objeto lo notifica; de lo contrario abre el modal con `RequestLoanForm`.
- `handleRequestSubmitted()`: Cierra el modal de solicitud, emite alerta de éxito y recarga el catálogo.

---

### 3. `PublishView.vue`
- `handlePublished()`: Muestra notificación de éxito con Notivue y redirige a `/mis-publicaciones` tras crear exitosamente un objeto.

---

### 4. `MyPublicationsView.vue`
- `availableCount` / `pausedCount` *(computadas)*: Contadores reactivos de publicaciones activas o en pausa.
- `statusLabel(status)`: Traduce estados técnicos (`available` $\to$ 'Disponible', `paused` $\to$ 'Pausado', `lent` $\to$ 'En préstamo').
- `formatDate(value)`: Formatea la fecha de publicación con `Intl.DateTimeFormat`.
- `formatOffer(article)`: Retorna si el artículo es gratuito o su monto formateado.
- `openEdit(article)` / `closeEdit()`: Controla la apertura y cierre del modal de edición que contiene `PublishArticleForm`.
- `handleUpdated()`: Notifica con Notivue y cierra el modal de edición.
- `toggleStatus(article)`: Invoca `articlesStore.setStatus()` para alternar entre `'available'` y `'paused'`.
- `askDelete(article)` / `cancelDelete()`: Abre o cancela el diálogo modal de confirmación de eliminación.
- `confirmDelete()`: Ejecuta `articlesStore.remove()`, remueve la foto física de Storage vía `removeItemPhoto()` y actualiza la lista.

---

### 5. `RequestsView.vue`
- `incomingRequests` / `outgoingRequests` *(computadas)*: Separa las solicitudes donde el usuario es el dueño del objeto de aquellas donde es el prestatario.
- `pendingCount` / `activeLoanCount` *(computadas)*: Métricas para los contadores superiores.
- `statusLabel(status)` / `formatDateRange(request)` / `formatOffer(request)`: Utilidades de formateo visual para fechas, estados y montos.
- `performAction(request, action)`: Despacha acciones de ciclo de vida (`approve`, `reject`, `cancel`, `return`) a través de `requestsStore.act()` y refresca el catálogo general.

---

### 6. `LoginView.vue`
- `getRedirectQuery()`: Conserva el parámetro `redirect` de la URL para no perder el destino tras iniciar sesión.
- `handleLoginSuccess()`: Procesa la redirección posterior al inicio de sesión (hacia la ruta original o a `/`).
- `openRegister()`: Redirige a la pantalla de registro conservando parámetros de redirección.

---

### 7. `RegisterView.vue`
- `goToLogin()`: Navega al login conservando la URL de retorno.
- `handleRegisterSuccess()`: Notifica que la cuenta fue creada y redirige al destino original o a la landing.

---

### 8. `AdminLoginView.vue`
- `getAdminDestination()`: Determina la ruta interna de administración a la que debe volver el usuario (`/admin`).
- `handleLoginSuccess()`: Redirige al panel administrativo tras validar credenciales con permisos de administrador.

---

### 9. `AdminView.vue`
- `activeSection` *(computada)*: Determina la pestaña actual activa en la barra lateral (`roles`, `users`, `categories`, `careers`).
- `openSection(routeName)`: Navega entre las subrutas administrativas usando Vue Router.
