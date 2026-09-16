# LendIt UJAP

Proyecto del curso Electiva Profesional III – Tópicos Especiales en Programación Web (UJAP). Es una SPA construida en capas a lo largo del semestre; el objetivo del producto es una red de préstamos de objetos entre estudiantes (tipo Airbnb, pero para calculadoras, cargadores y equipo, por tiempo limitado).

## Stack

- Vue 3 (Composition API, `<script setup>`) + TypeScript
- Vue Router, Pinia
- Vite, Vitest
- Funciones serverless en `api/` para Vercel
- Supabase Auth + PostgreSQL mediante Prisma

## Comandos

```
pnpm dev      # servidor de desarrollo
pnpm dev:full # frontend y API local mediante server/dev-api.ts
pnpm build    # type-check (vue-tsc) + build de producción
pnpm test     # vitest
pnpm db:validate
pnpm db:migrate:deploy
```

## Estructura

```
src/
  types/       interfaces TS puras (Article, Category, AuthUser, NewArticleInput...)
  data/        datos mock estáticos que aún usa la landing
  stores/      Pinia — sesión Supabase y catálogo conectado a la API
  lib/         cliente Supabase, cliente HTTP y utilidades de acceso
  components/ componentes presentacionales, formularios y paneles administrativos
  views/       landing, login, registro y panel administrativo
api/           funciones serverless HTTP detectadas por Vercel
prisma/        schema, migraciones y cliente generado (generated/ está ignorado)
server/        adaptador Express local para probar los handlers de api/
scripts/       utilidades administrativas, como promote-user.ts
vercel.json    build Vite y fallback para Vue Router
```

`types/` y la capa de acceso (`src/lib/`, `api/`) permanecen separadas para que el frontend dependa de interfaces y no de detalles de PostgreSQL.

## Estado actual

Implementado:
- Landing responsiva (mobile-first) con Grid para la estructura general y Flexbox dentro de cada sección, HTML semántico.
- Componentes con props/emits tipados contra interfaces de `types/`.
- Estado reactivo (`ref`/`computed`) para sesión, notificaciones, pasos completados y artículos.
- Login y registro mediante Supabase Auth; estudiantes/profesores requieren `@ujap.edu.ve` y los administradores tienen acceso separado desde `/admin/login`.
- Artículos, perfiles, roles, permisos, categorías, carreras y escuelas se sirven mediante funciones API y Prisma.
- Flujo: publicar sin sesión navega a `/login` y conserva la intención hasta autenticar.
- Edición de perfil con foto optimizada en el navegador y persistida como `photoUrl`.
- Panel administrativo con rutas `/admin/roles`, `/admin/users`, `/admin/categories` y `/admin/careers`.
- `vercel.json` configura el build de producción y el fallback requerido por Vue Router.

Pendiente / riesgos conocidos:
- **GitHub**: el historial hasta ahora es prácticamente de un solo autor. El criterio "Organización en GitHub" del Avance 1 evalúa trabajo visible de todos los integrantes del equipo — falta que cada quien suba su parte con su propia cuenta.
- **Vercel/Supabase**: falta configurar las variables de producción, las URLs de redirección de Supabase y ejecutar `pnpm db:migrate:deploy` contra la base de datos remota.
- No hay ESLint/Prettier configurado (se planteó en clase para la Unidad 6).
- El build local de Vercel requiere un proyecto/token válido para ejecutar `vercel build`; el build de Vite sí está validado con `pnpm build`.

## Evaluación relevante

**Avance 1** (semana 5, 20% de la nota final, grupal) — rúbrica analítica de 4 criterios, 5% c/u:
1. Estructura y maquetación (Grid/Flexbox, mobile-first)
2. Props y Emits tipados
3. Estado reactivo y formularios
4. Organización en GitHub (commits descriptivos, trabajo de todos los integrantes)
