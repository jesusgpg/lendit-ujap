# LendIt UJAP — Resumen técnico de lo implementado

Red de préstamos de objetos entre estudiantes de la UJAP. Este resumen se enfoca en cómo está armada la capa de componentes: props, emits y estado reactivo — lo que pide la rúbrica del Avance 1.

## Stack

Vue 3 (Composition API, `<script setup>`) + TypeScript · Vue Router · Pinia · Vite · Vitest · Supabase Auth · Vercel Functions · Prisma · PostgreSQL.

## Componentes: props y emits tipados

Todos los componentes definen sus props y emits con `defineProps<T>()` / `defineEmits<T>()` contra interfaces de `src/types/`.

| Componente | Props | Emits |
|---|---|---|
| `ArticleCard.vue` | `article: Article` (requerido) | `request(articleId: string)` |
| `CategoryCard.vue` | `category?: Category`, `isPlaceholder?: boolean` | `select(categoryId: string)` |
| `StepCard.vue` | `step: Step` (requerido), `isCompleted?: boolean` | `complete(stepNum: string)` |
| `ModalDialog.vue` | `title: string` (requerido) + `<slot />` para el contenido | `close()` |
| `LoginForm.vue` | — (usa el store directo) | `success()` |
| `PublishArticleForm.vue` | — (usa el store directo) | `published()` |

Patrón general: `ArticleCard`, `CategoryCard` y `StepCard` son puramente presentacionales — reciben datos por props y notifican interacción por emit, sin tocar stores. `LoginForm` y `PublishArticleForm` son la excepción: llaman a `useAuthStore()` / `useArticlesStore()` directamente en vez de solo emitir hacia el padre (decisión válida pero inconsistente con el resto).

## Estado reactivo

Todo el estado vive en `LandingView.vue` (orquestador) y en los stores de Pinia:

- `LandingView.vue`:
  - `notification = ref<{message, type} | null>` — banner de notificaciones, con auto-ocultado vía `setTimeout`.
  - `completedSteps = ref<Record<string, boolean>>` — marca qué pasos del "Cómo funciona" están leídos.
  - `activeModal = ref<'login' | 'publish' | null>` — controla qué modal está abierto.
  - `pendingPublishAfterLogin = ref<boolean>` — encadena el flujo login → publicar.
  - `fullCategories = ref(getCategories())`, `articles = computed(() => articlesStore.articles)`.
- `stores/auth.ts` (Pinia): sesión de Supabase Auth, validación de correo institucional y sincronización del perfil mediante `/api/me`.
- `stores/articles.ts` (Pinia): lista de `articles` cargada y publicada mediante `/api/items`; no usa `localStorage`.

## Formularios

- **`LoginForm`**: `v-model` en `email`/`password`, validación básica (dominio + longitud de contraseña), mensaje de error reactivo, emite `success` al autenticar.
- **`PublishArticleForm`**: `v-model` en `title`/`category`/`duration`, valida campos requeridos antes de publicar, resetea el formulario y emite `published`.

## Flujo integrado (ejemplo de comunicación por props/emits)

1. Usuario sin sesión hace clic en "Publicar un objeto" → `LandingView` detecta `!authStore.isAuthenticated` y abre `ModalDialog` con `LoginForm`.
2. `LoginForm` emite `success` → `LandingView` cierra el modal de login y abre automáticamente el de `PublishArticleForm` (gracias a `pendingPublishAfterLogin`).
3. `PublishArticleForm` emite `published` → `LandingView` cierra el modal y dispara una notificación reactiva.

## Estructura de carpetas

```
src/
  types/       interfaces TS puras (Article, Category, AuthUser, NewArticleInput...)
  data/        funciones que devuelven datos mock (getArticles, getCategories, getAppName...)
  stores/      Pinia — auth.ts y articles.ts
  components/  ArticleCard, CategoryCard, StepCard, ModalDialog, LoginForm, PublishArticleForm
  views/       LandingView.vue (única vista por ahora)
  router/
```
