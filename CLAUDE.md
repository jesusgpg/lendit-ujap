# LendIt UJAP

Proyecto del curso Electiva Profesional III – Tópicos Especiales en Programación Web (UJAP). Es una SPA construida en capas a lo largo del semestre; el objetivo del producto es una red de préstamos de objetos entre estudiantes (tipo Airbnb, pero para calculadoras, cargadores y equipo, por tiempo limitado).

## Stack

- Vue 3 (Composition API, `<script setup>`) + TypeScript
- Vue Router, Pinia
- Vite, Vitest
- Sin backend todavía — todos los datos son mock/localStorage (la API real llega en la Unidad 4 del curso)

## Comandos

```
pnpm dev      # servidor de desarrollo
pnpm build    # type-check (vue-tsc) + build de producción
pnpm test     # vitest
```

## Estructura

```
src/
  types/       interfaces TS puras (Article, Category, AuthUser, NewArticleInput...)
  data/        funciones que devuelven datos mock (getArticles, getCategories, getAppName...)
  stores/      Pinia — auth.ts (login mock + localStorage) y articles.ts (artículos publicados)
  components/  presentacionales, comunican por props/emits (ArticleCard, CategoryCard, StepCard,
               ModalDialog, LoginForm, PublishArticleForm)
  views/       LandingView.vue (única vista por ahora)
  router/
```

`types/` y `data/` están separados a propósito: cuando llegue la Unidad 4 (API real), las funciones de `data/` se reemplazan por llamadas HTTP sin tocar las interfaces.

## Estado actual

Implementado:
- Landing responsiva (mobile-first) con Grid para la estructura general y Flexbox dentro de cada sección, HTML semántico.
- Componentes con props/emits tipados contra interfaces de `types/`.
- Estado reactivo (`ref`/`computed`) para notificaciones, pasos completados y artículos.
- Dos formularios funcionales: login (mock, valida `@ujap.edu.ve` + contraseña ≥6 caracteres) y publicar artículo — ambos con `v-model`, validación básica y persistencia en `localStorage` vía Pinia.
- Flujo: publicar sin sesión abre login primero y encadena al formulario de publicar tras autenticar.

Pendiente / riesgos conocidos:
- **GitHub**: el historial hasta ahora es prácticamente de un solo autor. El criterio "Organización en GitHub" del Avance 1 evalúa trabajo visible de todos los integrantes del equipo — falta que cada quien suba su parte con su propia cuenta.
- No hay ESLint/Prettier configurado (se planteó en clase para la Unidad 6).
- `LoginForm` y `PublishArticleForm` llaman a los stores de Pinia directamente en vez de solo emitir hacia el padre, a diferencia del resto de componentes (patrón puramente props+emit). Es una decisión válida pero inconsistente con el resto del código.

## Evaluación relevante

**Avance 1** (semana 5, 20% de la nota final, grupal) — rúbrica analítica de 4 criterios, 5% c/u:
1. Estructura y maquetación (Grid/Flexbox, mobile-first)
2. Props y Emits tipados
3. Estado reactivo y formularios
4. Organización en GitHub (commits descriptivos, trabajo de todos los integrantes)
