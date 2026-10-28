# Librerías y Módulos de Soporte del Frontend (`src/lib/`)

Esta carpeta contiene utilidades compartidas, clientes de servicios en la nube (Supabase, Storage), capa de peticiones HTTP autenticadas y el sistema de preferencias de accesibilidad.

---

## Archivos y Funciones

### 1. `accessibility.ts`
Administra el estado reactivo y la persistencia de las preferencias de accesibilidad del usuario (tamaño de fuente, modo de tema claro/oscuro y modo para daltonismo).

#### Variables Reactivas Exportadas
- `fontSize: Ref<FontSize>`: Tamaño de letra seleccionado (`'normal'` $\to$ 17px, `'large'` $\to$ 19px, `'larger'` $\to$ 21px).
- `theme: Ref<ThemeMode>`: Modo de color (`'light'` \| `'dark'`).
- `colorblind: Ref<boolean>`: Booleano que activa paletas de alto contraste aptas para daltonismo.

#### Funciones

| Función | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `readStored()` *(privada)* | Ninguno | `StoredPrefs` | Lee y parsea la clave `lendit:accessibility` de `localStorage`. Si no existe o falla, provee valores predeterminados seguros (`normal`, `light`, `false`). |
| `applyToDocument()` *(privada)* | Ninguno | `void` | Aplica en el elemento raíz del DOM (`<html>`) el tamaño de fuente en píxeles, el atributo `data-theme` y el atributo `data-colorblind`, y guarda la configuración en `localStorage`. |
| `initAccessibility()` | Ninguno | `void` | Inicializa el sistema aplicando los estilos al cargar la aplicación y configura un `watch` reactivo de Vue para que cualquier cambio en `fontSize`, `theme` o `colorblind` actualice el documento y `localStorage` inmediatamente. |

---

### 2. `api.ts`
Cliente HTTP centralizado para comunicación con los endpoints de la API (`/api/*`).

#### Funciones

| Función | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `apiRequest<T>(path, init?)` | `path: string`, `init: RequestInit = {}` | `Promise<T>` | Envía una petición `fetch` hacia el backend. Obtiene automáticamente el token de acceso JWT de la sesión activa de Supabase y lo inyecta en la cabecera `Authorization: Bearer <token>`. Configura `Content-Type: application/json` si hay cuerpo en la petición. En caso de error HTTP (`!response.ok`), extrae el mensaje de error del payload y lanza una excepción. |

---

### 3. `roleLabels.ts`
Mapeo y traducción amigable para los nombres de roles en pantalla.

#### Funciones y Constantes

| Elemento | Tipo / Parámetros | Retorno | Descripción |
|---|---|---|---|
| `PROTECTED_ROLE_NAMES` | `string[]` | — | Lista de nombres de roles base del sistema (`ADMIN`, `STUDENT`, `PROFESSOR`) que no se pueden eliminar. |
| `roleLabel(name)` | `name: string` | `string` | Traduce el identificador técnico de la base de datos a español (e.g. `'ADMIN'` $\to$ `'Administrador'`, `'STUDENT'` $\to$ `'Estudiante'`, `'PROFESSOR'` $\to$ `'Profesor'`). Si es un rol personalizado, devuelve el nombre tal cual. |
| `isProtectedRole(name)` | `name: string` | `boolean` | Determina si un nombre de rol pertenece a la lista de roles protegidos. |

---

### 4. `storage.ts`
Gestión de archivos binarios e imágenes en Supabase Storage (bucket `item-photos`).

#### Funciones

| Función | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `uploadItemPhoto(dataUrl)` | `dataUrl: string` | `Promise<string>` | Convierte una imagen en formato Data URL / base64 a un `Blob`, genera una ruta única bajo el directorio del usuario autenticado (`<userId>/<uuid>.jpg`) y la sube al bucket `item-photos`. Retorna la URL pública accesible por CDN. |
| `removeItemPhoto(photoUrl)` | `photoUrl: string \| null \| undefined` | `Promise<void>` | Extrae la ruta relativa del archivo a partir de su URL pública y elimina el objeto correspondiente en el bucket `item-photos` de Supabase Storage para no dejar archivos huérfanos tras eliminar o cambiar fotos. |

---

### 5. `supabase.ts`
Instanciación y configuración del cliente cliente-servidor de `@supabase/supabase-js`.

#### Funciones

| Función | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `getSupabaseClient()` | Ninguno | `SupabaseClient` | Retorna la instancia singleton del cliente de Supabase configurada con las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`, habilitando refresco automático de tokens y detección de sesión en la URL. |
