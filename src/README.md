# Entrada Principal del Frontend (`src/`)

Esta carpeta es la raíz del código de la aplicación cliente en Vue 3 y TypeScript. Contiene el punto de entrada de la aplicación, el componente raíz con soporte de notificaciones globales, la hoja de estilos global y las subcarpetas organizadas por responsabilidad (componentes, tiendas Pinia, utilidades, rutas y vistas).

---

## Archivos y Funciones

### 1. `main.ts`
Archivo de inicio (*bootstrapper*) de la aplicación web Vue 3.

#### Funciones y Lógica de Inicialización
- `initAccessibility()`: Se ejecuta de manera síncrona antes del montaje de la aplicación para aplicar preferencias de tamaño de fuente, modo claro/oscuro y modo daltónico almacenadas en `localStorage`.
- `createApp(App)`: Crea la instancia de la aplicación Vue.
- `createPinia()`: Crea e inyecta la instancia del manejador de estado global Pinia.
- **Guardia de Navegación Global (`router.beforeEach`)**:
  - Inicializa el almacén de autenticación (`await authStore.initialize()`) para restaurar la sesión de Supabase si existe.
  - Verifica rutas protegidas por permisos específicos (`to.meta.requiredPermission`): si el usuario no posee el permiso (por ejemplo `roles.manage`), lo redirige a la vista `admin-login` conservando la ruta de destino en la query.
  - Verifica rutas que requieren autenticación (`to.meta.requiresAuth`): si el usuario no está autenticado, lo redirige a la vista `login`.
- **Configuración de Notivue (`createNotivue`)**:
  - Registra el sistema de notificaciones flotantes configurado en la posición superior derecha (`top-right`), con límite de 3 notificaciones simultáneas, encolamiento automático y pausa al pasar el puntero o interactuar en pantallas táctiles.
- `app.mount('#app')`: Monta la aplicación en el elemento DOM raíz `#app`.

---

### 2. `App.vue`
Componente raíz de la interfaz de usuario.

#### Lógica y Estructura
- **Tema Visual de Notificaciones (`lenditTheme`)**: Define tokens CSS específicos para la apariencia de Notivue acordes a la identidad visual de la UJAP (colores institucionales vino tinto `--crimson`, dorado `--gold`, sombras y bordes redondeados).
- **Plantilla `<template>`**:
  - `<Notivue>` con soporte de descarte por deslizamiento táctil (`<NotivueSwipe>`), barra de progreso (`<NotificationProgress>`) y botón accesible de cierre.
  - `<router-view>`: Punto de montaje dinámico donde se renderizan las vistas enrutadas por Vue Router.
- **Estilos Scoped / Globales**:
  - Personaliza los botones de cierre y transiciones de las notificaciones flotantes.

---

### 3. `style.css`
Hoja de estilos global y sistema de diseño visual de LendIt UJAP.

#### Contenido
- **Variables CSS (`:root`)**:
  - Colores de marca: `--crimson` (`#7a1c2e`), `--crimson-dark`, `--crimson-bg`, `--gold`, `--navy`, `--ink`, etc.
  - Paleta de fondos y tarjetas: `--paper`, `--paper-2`, `--line-subtle`, `--line-strong`.
  - Soporte de temas: reglas para `[data-theme="dark"]` y `[data-colorblind]`.
  - Tipografía responsiva basada en tamaños relativos para accesibilidad.
- **Normalización y Reseteo**: Estilos para formularios, inputs, botones, modales y tablas.

---

## Subdirectorios
- **`components/`**: Componentes reutilizables de Vue (tarjetas, modales, formularios, barra de navegación y pie de página).
- **`data/`**: Datos estáticos y textos institucionales.
- **`lib/`**: Clientes de servicios externos y utilidades compartidas (API, Supabase, Accesibilidad, Almacenamiento).
- **`router/`**: Configuración de rutas y metadatos de acceso.
- **`stores/`**: Almacenes reactivos de estado de Pinia (artículos, autenticación, catálogo y solicitudes).
- **`types/`**: Definición de interfaces y tipos TypeScript en todo el frontend.
- **`views/`**: Vistas de página completa que representan las pantallas del sistema.
