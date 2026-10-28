# Componentes de la Interfaz de Usuario (`src/components/`)

Esta carpeta contiene todos los componentes reutilizables de Vue 3 construidos con la **Composition API** y `<script setup lang="ts">`. Abarca desde componentes puramente presentacionales hasta modales complejos, paneles de administración y formularios con validación.

---

## Índice de Componentes

| Componente | Tipo | Responsabilidad Principal |
|---|---|---|
| `AccountMenu.vue` | Menú interactivo | Menú desplegable del usuario con sub-modales (perfil, accesibilidad, calendario, preferencias, idioma) y cierre de sesión. |
| `ArticleCard.vue` | Tarjeta presentacional | Muestra un artículo en el catálogo (foto, código, duración, modo, precio) y emite evento para solicitarlo. |
| `AuthPageShell.vue` | Layout estructural | Estructura visual envolvente para las pantallas de autenticación (`/login`, `/register`, `/admin/login`). |
| `CareersManagerPanel.vue` | Panel administrativo | Gestión de carreras académicas y facultades/escuelas (crear, editar, eliminar y agrupar). |
| `CategoriesManagerPanel.vue` | Panel administrativo | Gestión de categorías del catálogo (crear, editar nombre, cambiar emoji y eliminar). |
| `CategoryCard.vue` | Tarjeta interactiva | Botón de selección de categoría para la landing y filtros del catálogo. |
| `IconPicker.vue` | Selector interactivo | Selector emergente de emojis basado en el elemento web `emoji-picker-element` con posicionamiento inteligente. |
| `LoadingState.vue` | Indicador de estado | Spinner con animación de gradiente cónico y texto accesible para estados de carga. |
| `LoginForm.vue` | Formulario | Inicio de sesión con validación de correo institucional o administrativo mediante `vee-validate`. |
| `ModalDialog.vue` | Modal accesible | Ventana modal accesible con teletransportación al `body`, backdrop con desenfoque y botón de cierre. |
| `PhotoDropzone.vue` | Entrada de archivo | Zona de arrastrar y soltar para fotos; previsualiza, valida peso y redimensiona en cliente vía `<canvas>`. |
| `PublishArticleForm.vue` | Formulario complejo | Publicación y edición de artículos con selector de foto, modalidad de préstamo/alquiler, duración y audiencia restringida. |
| `RegisterForm.vue` | Formulario complejo | Registro de usuarios con validación de correo `@ujap.edu.ve`, carga de carrera y foto de perfil obligatoria. |
| `RequestLoanForm.vue` | Formulario de flujo | Formulario para pedir un objeto con selector de fechas de inicio y devolución y validación temporal. |
| `RoleManagerPanel.vue` | Panel administrativo | Matriz de permisos interactiva para activar/desactivar permisos por rol y crear nuevos roles. |
| `SiteFooter.vue` | Pie de página | Pie institucional con enlaces, lema del campus y créditos. |
| `SiteHeader.vue` | Cabecera global | Barra superior con logo de la UJAP, enlaces de navegación, botón de administración y menú de cuenta. |
| `StepCard.vue` | Tarjeta informativa | Paso explicativo de la sección "Cómo funciona" en la página de inicio. |
| `UsersManagerPanel.vue` | Panel administrativo | Tabla de administración de cuentas de usuario, cambio reactivo de roles y restablecimiento de contraseña. |

---

## Detalle de Componentes y Funciones

### 1. `AccountMenu.vue`
- **Props**: Ninguna.
- **Emits**: `logout()`
- **Funciones Internas**:
  - `toggleMenu()`: Alterna la visibilidad del menú desplegable.
  - `openModal(modal)`: Abre uno de los diálogos hijos (`'profile'`, `'calendar'`, `'accessibility'`, `'preferences'`, `'languages'`).
  - `navigateTo(path)`: Cierra el menú y redirige vía Vue Router.
  - `closeModal()`: Restablece el modal activo a `null`.
  - `handleClickOutside(event)`: Cierra el menú automáticamente al hacer clic fuera del componente.
  - `handleLogout()`: Emite `logout` síncronamente y ejecuta `authStore.logout()`.
  - `openProfileModal()`: Inicializa el formulario de edición de perfil con los datos actuales del usuario.
  - `handlePhotoUpdate(dataUrl)`: Almacena temporalmente la nueva foto seleccionada.
  - `saveProfile()`: Sube la nueva foto a Storage (si cambió a formato base64) y envía un `PATCH /api/me` para actualizar el perfil.

---

### 2. `ArticleCard.vue`
- **Props**:
  - `article: Article` (requerido)
  - `isOwn?: boolean` (opcional, por defecto `false` para indicar si el artículo pertenece al usuario actual).
- **Emits**: `request(articleId: string)`
- **Funciones Internas**:
  - `formatOffer(article)`: Retorna `'Préstamo gratuito'` o el monto formateado en divisa venezolana/extranjera (`USD`, `EUR`, `VES`) con `Intl.NumberFormat`.

---

### 3. `AuthPageShell.vue`
- **Props**:
  - `eyebrow: string`, `title: string`, `description: string`, `note: string`, `cardKicker: string`, `cardTitle: string`, `cardLabel: string`, `wideCard?: boolean`.
- **Emits**: Ninguno.
- **Funciones Internas**:
  - `goToLogin()`: Redirige hacia la ruta `/login`.

---

### 4. `CareersManagerPanel.vue`
- **Props**: Ninguna.
- **Emits**: Ninguno.
- **Funciones Internas**:
  - `groupedCareers`: Propiedad computada que agrupa las carreras por su facultad o escuela universitaria.
  - `openCreateModal()`: Abre el modal para registrar una nueva carrera.
  - `openEditModal(career)`: Abre el modal precargando los datos de la carrera a editar.
  - `closeModal()`: Cierra el diálogo de carrera.
  - `submitForm()`: Si es una carrera nueva o editada, crea escuelas al vuelo si se introdujo `newSchoolName` y envía `POST /api/careers` o `PATCH /api/careers/:id`.
  - `deleteCareer(careerId)`: Solicita confirmación y ejecuta `DELETE /api/careers/:id` (captura error si la carrera tiene estudiantes inscritos).

---

### 5. `CategoriesManagerPanel.vue`
- **Props**: Ninguna.
- **Emits**: Ninguno.
- **Funciones Internas**:
  - `openCreateModal()` / `openEditModal(category)` / `closeModal()`: Controladores de visibilidad del modal de categorías.
  - `submitForm()`: Valida y envía `POST /api/categories` para nuevas categorías o `PATCH /api/categories/:key` para ediciones.
  - `deleteCategory(categoryKey)`: Ejecuta `DELETE /api/categories/:key` tras confirmación, validando que no tenga artículos asociados.

---

### 6. `CategoryCard.vue`
- **Props**:
  - `category?: Category`
  - `isPlaceholder?: boolean` (para la tarjeta de "+ Y lo que falte").
- **Emits**: `select(categoryId: string)`

---

### 7. `IconPicker.vue`
- **Props**: `modelValue: string` (v-model con el emoji actual).
- **Emits**: `update:modelValue(value: string)`
- **Funciones Internas**:
  - `toggleOpen()`: Abre o cierra el popover y añade detectores de scroll y resize.
  - `positionPopover()`: Calcula dinámicamente las coordenadas del picker respecto al botón disparador para evitar desbordamientos de pantalla.
  - `handlePick(event)`: Captura el evento del selector de emojis (`event.detail.unicode`) y emite la actualización.
  - `close()`: Cierra el selector y retira los escuchadores de ventana.

---

### 8. `LoadingState.vue`
- **Props**:
  - `label?: string` (por defecto `'Cargando información…'`).
  - `compact?: boolean` (versión compacta para listas reducidas).
- **Emits**: Ninguno.

---

### 9. `LoginForm.vue`
- **Props**:
  - `mode?: LoginMode` (`'institutional'` o `'admin'`).
- **Emits**:
  - `success()`: Emitido cuando la autenticación es exitosa.
  - `switch-to-register()`: Emitido al hacer clic en crear cuenta.
- **Funciones Internas**:
  - `onSubmit`: Valida correo institucional o administrativo según el modo, autentica mediante `authStore.login()` y notifica con Notivue en caso de error.

---

### 10. `ModalDialog.vue`
- **Props**:
  - `title: string` (título accesible del modal).
  - `wide?: boolean` (ancho extendido de 540px vs 380px estándar).
- **Emits**: `close()`

---

### 11. `PhotoDropzone.vue`
- **Props**:
  - `modelValue?: string` (cadena dataURL de la imagen).
  - `alt?: string`, `hint?: string`.
- **Emits**: `update:modelValue(value: string)`
- **Funciones Internas**:
  - `openPicker()`: Dispara programáticamente el selector de archivos nativo.
  - `resizeImage(file, maxSize)`: Lee el archivo con `FileReader`, lo dibuja en un `<canvas>` HTML5 escalándolo a una dimensión máxima de 1200px con compresión JPEG al 82% y retorna el data URL generado.
  - `handleFile(file)`: Valida formato (JPG/PNG), tamaño límite (5MB) y procesa la imagen con `resizeImage()`.
  - `handleDrop(event)`: Gestiona el arrastrado de archivos sobre el contenedor.
  - `clearPhoto()`: Limpia la foto seleccionada.

---

### 12. `PublishArticleForm.vue`
- **Props**:
  - `article?: Article` (artículo a editar, opcional).
  - `submitLabel?: string`.
- **Emits**:
  - `published()`: Tras crear exitosamente un objeto.
  - `updated()`: Tras actualizar un objeto existente.
- **Funciones Internas**:
  - `toggleAudienceRole(roleName)`: Añade o retira roles para la visibilidad restringida del objeto.
  - `onPhotoUpdate(dataUrl)`: Recibe la foto procesada por `PhotoDropzone`.
  - `onPhotoRemove()`: Marca la foto para eliminación en Storage.
  - `onSubmit`: Valida los campos con `vee-validate`, sube la foto a Supabase Storage con `uploadItemPhoto()` si es un nuevo archivo y llama a `articlesStore.publish()` o `articlesStore.update()`.

---

### 13. `RegisterForm.vue`
- **Props**: Ninguna.
- **Emits**:
  - `success()`: Al culminar el registro.
  - `switch-to-login()`: Al pulsar el enlace para ir a iniciar sesión.
- **Funciones Internas**:
  - `loadCatalog()`: Carga carreras disponibles en el catálogo para el selector.
  - `onPhotoUpdate(dataUrl)`: Guarda la foto seleccionada en base64.
  - `onSubmit`: Valida nombre, apellido, correo `@ujap.edu.ve`, contraseña $\ge 6$, carrera, rol de registro y foto obligatoria; luego invoca `authStore.register()`.

---

### 14. `RequestLoanForm.vue`
- **Props**: `article: Article` (objeto que se desea solicitar).
- **Emits**: `submitted()`
- **Funciones Internas**:
  - `toLocalDateTime(date)`: Convierte un objeto `Date` a formato `YYYY-MM-DDTHH:mm` para inputs de fecha y hora locales.
  - `formatOffer(article)`: Formatea el costo del préstamo o gratuidad.
  - `submit(article)`: Valida que la fecha de devolución sea posterior a la de retiro y no esté en el pasado; despacha `requestsStore.create()` y notifica con Notivue.

---

### 15. `RoleManagerPanel.vue`
- **Props**: Ninguna.
- **Emits**: Ninguno.
- **Funciones Internas**:
  - `togglePermission(roleId, key)`: Conmuta la asignación de un permiso a un rol en memoria local.
  - `saveRole(roleId)`: Envía `PATCH /api/roles/:id` con la lista de permisos seleccionados para persistir los cambios.
  - `createRole()`: Envía `POST /api/roles` para crear un nuevo rol personalizado.
  - `deleteRole(roleId)`: Valida contra roles protegidos y ejecuta `DELETE /api/roles/:id`.

---

### 16. `SiteFooter.vue`
- **Props**: Ninguna.
- **Emits**: Ninguno.
- Renderiza el pie institucional con enlaces de navegación y descripción del proyecto.

---

### 17. `SiteHeader.vue`
- **Props**:
  - `showMarketplaceNav?: boolean` (muestra enlaces directos al catálogo, mis publicaciones y solicitudes).
- **Emits**: `open-login()`, `logout()`
- **Funciones Internas**: Renderiza la marca institucional, la barra de navegación pública o privada y alterna entre el botón "Empezar" y el componente `AccountMenu`.

---

### 18. `StepCard.vue`
- **Props**:
  - `step: Step` (número, título y texto explicativo).
  - `isCompleted?: boolean`.
- **Emits**: `complete(stepNum: string)`

---

### 19. `UsersManagerPanel.vue`
- **Props**: Ninguna.
- **Emits**: Ninguno.
- **Funciones Internas**:
  - `flashSaved(userId)`: Muestra un indicador visual de guardado durante 2 segundos.
  - `changeRole(user, roleId)`: Envía `PATCH /api/users/:id` para reasignar el rol de un usuario en tiempo real.
  - `toggleActive(user)`: Conmuta el estado `isActive` del usuario enviando `PATCH /api/users/:id` para habilitar o suspender su acceso.
  - `resetPassword(user)`: Envía `POST /api/users/:id/reset-password` para solicitar el envío del correo de recuperación de contraseña vía Supabase.
