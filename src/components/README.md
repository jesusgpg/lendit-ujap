# Catálogo de Componentes de la Interfaz (`src/components/`)

Esta carpeta alberga la biblioteca de componentes modulares de Vue 3 desarrollados con TypeScript y la Composition API (`<script setup>`). Implementan el sistema de diseño institucional de LendIt UJAP con validación reactiva de formularios, accesibilidad nativa y desacoplamiento de capas.

---

## 1. Tabla Resumen de Componentes

| Componente | Tipo | Props Principales | Emits | Uso Clave |
|---|---|---|---|---|
| `AccountMenu.vue` | Menú desplegable | — | `logout` | Gestión de perfil, accesibilidad, calendario y salida. |
| `ArticleCard.vue` | Presentacional | `article`, `isOwn` | `request` | Tarjeta del catálogo de artículos con formato de precio y estado. |
| `AuthPageShell.vue` | Layout | `title`, `description`, `wideCard`, etc. | — | Envoltorio estructural para pantallas de login y registro. |
| `CareersManagerPanel.vue` | Panel CRUD | — | — | Gestión administrativa de carreras y facultades. |
| `CategoriesManagerPanel.vue`| Panel CRUD | — | — | Mantenimiento de categorías y emojis asociados. |
| `CategoryCard.vue` | Presentacional | `category`, `isPlaceholder` | `select` | Botón interactivo de categorías en la landing page. |
| `IconPicker.vue` | Selector flotante | `modelValue` | `update:modelValue` | Selector de emojis accesible con cálculo inteligente de posición. |
| `LoadingState.vue` | Feedback visual | `label`, `compact` | — | Animación de carga cónica con soporte de reducción de movimiento. |
| `LoginForm.vue` | Formulario | `mode` (`institutional` \| `admin`) | `success`, `switch-to-register` | Autenticación con validación por dominio o administrativa. |
| `ModalDialog.vue` | Diálogo accesible | `title`, `wide` | `close` | Ventana emergente teletransportada al body con backdrop difuminado. |
| `PhotoDropzone.vue` | Carga de archivos | `modelValue`, `alt`, `hint` | `update:modelValue` | Subida, recorte y compresión local de imágenes vía HTML5 Canvas. |
| `PublishArticleForm.vue` | Formulario complejo | `article`, `submitLabel` | `published`, `updated` | Publicación de artículos con soporte de foto, audiencia y alquiler. |
| `RegisterForm.vue` | Formulario complejo | — | `success`, `switch-to-login` | Registro estudiantil y docente con selector de carrera y foto. |
| `RequestLoanForm.vue` | Formulario modal | `article` | `submitted` | Formulario para pedir un préstamo con selector de fechas. |
| `RoleManagerPanel.vue` | Panel de permisos | — | — | Matriz interactiva de asignación de permisos por rol. |
| `SiteFooter.vue` | Estructural | — | — | Pie de página con enlaces institucionales de la UJAP. |
| `SiteHeader.vue` | Navegación | `showMarketplaceNav` | `open-login`, `logout` | Barra de navegación superior responsiva y adaptable. |
| `StepCard.vue` | Informativo | `step`, `isCompleted` | `complete` | Tarjeta didáctica de la sección "Cómo funciona". |
| `UsersManagerPanel.vue` | Panel administrativo | — | — | Tabla de usuarios con conmutación de roles y reseteo de claves. |

---

## 2. Detalle Exhaustivo de Componentes Clave

### `AccountMenu.vue`
Menú emergente anclado al avatar del usuario en la barra superior.

- **Sub-Modales Administrados**:
  1. `profile`: Edición de nombre, apellido, teléfono y cambio de foto de perfil con subida automática a Supabase Storage.
  2. `accessibility`: Ajuste en tiempo real de tamaño de texto (`normal`, `large`, `larger`), tema (`light`, `dark`) y paleta para daltonismo.
  3. `calendar`: Calendario de compromisos de retiro y devolución de objetos.
  4. `preferences`: Notificaciones y configuraciones personales.
  5. `languages`: Información de localización (Español institucional).
- **Control de Clic Exterior**: Registra eventos en el `document` al montarse y los retira en `onBeforeUnmount` para cerrar el menú si el usuario interactúa fuera de su contenedor.
- **Cierre de Sesión Seguro**: Ejecuta `emit('logout')` antes de invalidar la sesión asíncrona para garantizar que la interfaz se desmonte ordenadamente.

---

### `PhotoDropzone.vue`
Zona interactiva para arrastrar y soltar o seleccionar archivos fotográficos locales.

- **Procesamiento de Imágenes en Cliente (`resizeImage`)**:
  ```typescript
  // Escala proporcionalmente a un máximo de 1200px y comprime a JPEG calidad 0.82
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  context.drawImage(image, 0, 0, width, height)
  resolve(canvas.toDataURL('image/jpeg', 0.82))
  ```
- **Validaciones**: Rechaza archivos de más de 5 MB o con tipos MIME diferentes a JPEG o PNG.

---

### `PublishArticleForm.vue`
Formulario principal de creación y edición de artículos.

- **Validación con Vee-Validate y Zod**:
  - `title`: Mínimo 3 caracteres.
  - `categoryKey`: Obligatorio, poblado dinámicamente desde `useCatalogStore`.
  - `duration`: Tiempo sugerido de préstamo (mínimo 2 caracteres).
  - `price` y `currency`: Obligatorios y mayores que cero únicamente si `publicationMode === 'RENTAL'`.
- **Selector de Audiencia Restringida**: Permite marcar qué roles (`STUDENT`, `PROFESSOR`, etc.) podrán visualizar y pedir el artículo publicado.
- **Manejo de Fotos en Storage**: Si el usuario seleccionó una imagen nueva en base64, invoca `uploadItemPhoto()` para obtener la URL pública antes de persistir el registro del artículo. Si retira la foto anterior, invoca `removeItemPhoto()` para no saturar el almacenamiento.

---

### `RoleManagerPanel.vue`
Matriz de control de acceso basada en roles (RBAC).

- **Gestión de Permisos**: Muestra una cuadrícula con todos los roles del sistema y todos los permisos disponibles. Permite alternar *checkboxes* para modificar permisos en memoria local.
- **Persistencia Transaccional**: El botón "Guardar" envía `PATCH /api/roles/:id` con la matriz completa de `permissionKeys`.
- **Creación de Roles**: Modal con validación que envía `POST /api/roles` transformando el nombre a mayúsculas con guiones bajos.
- **Protección de Roles Base**: Bloquea la eliminación de los roles `ADMIN`, `STUDENT` y `PROFESSOR` mediante la función `isProtectedRole()`.

---

### `UsersManagerPanel.vue`
Herramienta de supervisión y gestión de cuentas registradas en el campus.

- **Cambio Reactivo de Rol**: Desplegable por cada fila que envía inmediatamente un `PATCH /api/users/:id` con `{ roleId }` y muestra un indicador visual de guardado (`flashSaved`).
- **Suspensión / Reactivación**: Conmuta el booleano `isActive` para deshabilitar temporalmente el acceso de un usuario infractor sin destruir sus publicaciones ni préstamos históricos.
- **Restablecimiento de Contraseña**: Dispara una solicitud `POST /api/users/:id/reset-password` hacia Supabase Auth para enviar un correo de recuperación al usuario.

---

### `RequestLoanForm.vue`
Formulario interactivo para coordinar el préstamo de un artículo específico.

- **Cálculo de Fechas Automático**: Inicializa la fecha de inicio 30 minutos en el futuro y la de devolución 2 horas y media después.
- **Validación Cronológica**: Comprueba que la fecha de devolución sea estrictamente posterior a la de inicio y que el inicio no pertenezca al pasado.
- **Despacho Transaccional**: Invoca `useRequestsStore().create()` enviando `{ resource: 'request', itemId, startsAt, endsAt, message }`.
