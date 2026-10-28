# Manejo de Estado Global con Pinia (`src/stores/`)

Esta carpeta centraliza el estado reactivo global de la aplicación utilizando Pinia. Desacopla la lógica de negocio, las peticiones a la API y el manejo de sesiones respecto a los componentes de la interfaz de usuario.

---

## Almacenes (Stores) y Funciones

### 1. `articles.ts` (`useArticlesStore`)
Administra los artículos publicados en la red (catálogo público y publicaciones propias del usuario autenticado).

#### Estado (`state`)
- `articles: Article[]`: Lista de artículos públicos disponibles en el campus.
- `myArticles: Article[]`: Lista de artículos que pertenecen al usuario actualmente autenticado.
- `isLoading: boolean`: Bandera de carga para el catálogo público.
- `isLoadingMine: boolean`: Bandera de carga para las publicaciones propias.
- `error: string | null`: Mensaje de error al cargar el catálogo.
- `mineError: string | null`: Mensaje de error al cargar publicaciones propias.
- `isInitialized: boolean`: Indica si el catálogo general ya fue cargado previamente.

#### Acciones (`actions`)

| Acción | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `initialize()` | Ninguno | `Promise<void>` | Carga el catálogo público solo si aún no ha sido inicializado ni se encuentra en proceso de carga. |
| `load()` | Ninguno | `Promise<void>` | Realiza una petición `GET /api/items` para obtener los artículos disponibles según los permisos del usuario y actualiza `articles`. |
| `publish(input)` | `input: NewArticleInput` | `Promise<Article>` | Envía una petición `POST /api/items` con los datos del nuevo objeto. Tras la creación, recarga el catálogo global mediante `load()` y retorna el artículo creado. |
| `loadMine()` | Ninguno | `Promise<void>` | Envía una petición `GET /api/items?mine=1` para traer todos los objetos pertenecientes al usuario actual (incluyendo disponibles y pausados) y actualiza `myArticles`. |
| `update(id, input)` | `id: string`, `input: UpdateArticleInput` | `Promise<Article>` | Envía una petición `PATCH /api/items` para modificar las propiedades del artículo, actualiza el registro correspondiente en la lista local `myArticles` y refresca el catálogo general. |
| `setStatus(id, status)` | `id: string`, `status: 'available' \| 'paused'` | `Promise<Article>` | Método abreviado que llama a `update()` modificando únicamente el estado del objeto (pausar o reactivar disponibilidad). |
| `remove(id)` | `id: string` | `Promise<{ id: string; photoUrl: string \| null }>` | Envía una petición `DELETE /api/items` para eliminar el artículo. Remueve el elemento de `myArticles` y de `articles` en memoria local y retorna el identificador y URL de foto eliminados. |

---

### 2. `auth.ts` (`useAuthStore`)
Controla la sesión de autenticación con Supabase Auth, la validación de dominios institucionales y la sincronización del perfil de usuario y permisos en PostgreSQL.

#### Funciones Auxiliares Exportadas e Internas
- `isInstitutionalEmail(email)`: Comprueba si el correo cumple con el dominio `@ujap.edu.ve`.
- `isValidEmail(email)`: Valida la estructura genérica de una dirección de correo electrónico.
- `isAdministrativeUser(user)`: Evalúa si el usuario es `ADMIN` o posee el permiso `roles.manage`.
- `errorMessage(error, fallback)`: Traduce códigos y mensajes de excepción en explicaciones claras en español para el usuario.
- `validateCommonFields(input)`: Valida la completitud y formatos mínimos de los campos del formulario de registro.

#### Estado (`state`)
- `user: AuthUser | null`: Datos del perfil autenticado (nombre, carrera, teléfono, foto, rol y permisos).
- `isLoading: boolean`: Indica si se está inicializando o procesando la sesión.
- `isInitialized: boolean`: Bandera de finalización de la carga inicial de autenticación.
- `initializationError: string | null`: Errores ocurridos al sincronizar la sesión.

#### Getters
- `isAuthenticated`: Retorna `true` si `user !== null`.
- `hasPermission(key)`: Función que recibe una clave de permiso y comprueba si el usuario la posee en `user.permissions`.

#### Acciones (`actions`)

| Acción | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `initialize()` | Ninguno | `Promise<void>` | Comprueba la existencia de una sesión activa en Supabase Auth, sincroniza el perfil con `syncProfile()` y registra un listener reactivo (`onAuthStateChange`) para responder a eventos de inicio de sesión, refresco de token o cierre de sesión. |
| `syncProfile(session?)` | `session?: Session \| null` | `Promise<void>` | Consulta el endpoint `/api/me` para obtener el perfil y permisos del usuario desde la base de datos PostgreSQL. Si el usuario no tiene perfil aún (error `PROFILE_REQUIRED`), dispara automáticamente un `PATCH /api/me` para crearlo. |
| `register(input)` | `input: RegisterInput` | `Promise<AuthResult>` | Valida campos, registra la cuenta en Supabase con `signUp`, sube la foto de perfil al bucket de Storage y actualiza el perfil en la base de datos vía `/api/me`. |
| `login(credentials)` | `credentials: LoginCredentials` | `Promise<AuthResult>` | Valida credenciales según el modo (`institutional` o `admin`), autentica contra Supabase con `signInWithPassword`, sincroniza el perfil y valida que el tipo de cuenta sea coherente con el portal de acceso. |
| `logout()` | Ninguno | `Promise<void>` | Limpia de inmediato la referencia reactiva `user = null` y notifica a Supabase Auth para cerrar la sesión remota. |

---

### 3. `catalog.ts` (`useCatalogStore`)
Gestiona los datos de soporte de la plataforma: categorías, carreras académicas, escuelas y roles.

#### Estado (`state`)
- `categories: Category[]`: Lista de categorías activas para clasificar artículos.
- `careers: Career[]`: Lista de carreras universitarias.
- `schools: School[]`: Lista de escuelas o facultades de la UJAP.
- `roles: Role[]`: Lista de roles disponibles en el sistema (para selectores de audiencia y administración).
- `isInitialized: boolean`: Indica si los datos de catálogo ya fueron cargados.

#### Acciones (`actions`)

| Acción | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `initialize()` | Ninguno | `Promise<void>` | Ejecuta en paralelo las cargas de categorías, carreras y escuelas (`Promise.all`) si aún no se ha inicializado el store. |
| `loadCategories()` | Ninguno | `Promise<void>` | Realiza `GET /api/categories` y actualiza la lista reactiva de categorías. |
| `loadCareers()` | Ninguno | `Promise<void>` | Realiza `GET /api/careers` y almacena las carreras con sus respectivas escuelas. |
| `loadSchools()` | Ninguno | `Promise<void>` | Realiza `GET /api/schools` y almacena las escuelas universitarias. |
| `loadRoles()` | Ninguno | `Promise<void>` | Realiza `GET /api/roles` (requiere usuario autenticado) para poblar la lista de roles del sistema. |

---

### 4. `requests.ts` (`useRequestsStore`)
Gestiona el ciclo de vida y estado de las solicitudes de préstamo y alquiler.

#### Estado (`state`)
- `requests: LoanRequest[]`: Arreglo de solicitudes enviadas o recibidas por el usuario actual.
- `isLoading: boolean`: Bandera de carga de solicitudes.
- `error: string | null`: Mensaje de error en caso de fallo en la carga.

#### Acciones (`actions`)

| Acción | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `load()` | Ninguno | `Promise<void>` | Solicita `GET /api/items?view=requests` y almacena las solicitudes entrantes y salientes del usuario autenticado. |
| `create(input)` | `input: NewLoanRequestInput` | `Promise<LoanRequest \| null>` | Envía una petición `POST /api/items` con `{ resource: 'request', ...input }` para crear una nueva solicitud en un rango de fechas. |
| `act(input)` | `input: RequestAction` | `Promise<LoanRequest \| null>` | Envía una petición `PATCH /api/items` con la acción solicitada (`approve`, `reject`, `cancel` o `return`) y el identificador de solicitud o préstamo correspondiente. |
