# Brief de implementación — Accesibilidad LendIt UJAP

## Objetivo

Mejorar la accesibilidad de los flujos principales de LendIt UJAP —explorar artículos, registrarse, solicitar, publicar y gestionar préstamos— sin cambiar la identidad visual ni alterar reglas de negocio. Apuntar a WCAG 2.2 AA para las pantallas trabajadas.

## Contexto técnico y límites

- Vue 3 + TypeScript + Vue Router + Pinia + CSS propio.
- Respetar los tokens existentes en `src/style.css`, modos claro/oscuro y paleta para daltonismo.
- No añadir dependencias ni cambiar API, esquema de base de datos, autenticación o reglas de préstamos.
- No rediseñar la marca. Evitar regresiones en flujos existentes.
- Mantener los textos de la interfaz en español. El proyecto no tiene traducción al inglés activa.
- La integración MongoDB queda fuera de este bloque; se puede abordar luego en un cambio independiente.

## Hallazgos a resolver

1. `index.html` tiene `lang="en"`, aunque el contenido está en español.
2. En móvil, `SiteHeader.vue` oculta los enlaces de navegación y no muestra un menú alternativo.
3. `ModalDialog.vue` declara un diálogo modal, pero no gestiona el foco al abrir/cerrar, Escape ni el foco atrapado dentro del modal.
4. Varios campos eliminan el contorno de foco y solo cambian el borde. Los errores no siempre están enlazados al campo ni anunciados a tecnologías de asistencia.
5. En el tema claro, `--ink-faint` (#837d63) sobre blanco tiene contraste 4.13:1 y `--gold` (#c9971f) sobre blanco 2.65:1. Revisar usos de texto pequeño; preservar la paleta de marca usando variantes semánticas con contraste suficiente.
6. El área de carga de foto combina un `div role="button"` con un botón interno. Separar las acciones y usar controles HTML semánticos.
7. Los ajustes muestran visualmente el tema y tamaño de texto activo, pero deben anunciar su estado seleccionado.

## Trabajo en paralelo

Asignar cada bloque a un agente/terminal separado. Mantener la propiedad de archivos indicada para evitar conflictos. Si Antigravity no ofrece worktrees, asignar agentes al mismo checkout solo con estos límites de archivos.

### A — Navegación, idioma y contexto de ruta

**Archivos:** `index.html`, `src/components/SiteHeader.vue`, `src/components/AuthPageShell.vue`, `src/views/*.vue`, `src/router/index.ts`.

- Cambiar el idioma del documento a español (`es`).
- Añadir enlace “Saltar al contenido” que aparezca al recibir foco y un destino `<main>` válido en cada ruta.
- Hacer que toda la navegación principal esté disponible en móvil mediante un control de menú accesible por teclado; comunicar expandido/contraído y cerrar el menú después de navegar.
- Nombrar los landmarks de navegación cuando haya más de uno y exponer la ruta activa con `aria-current="page"`.
- Actualizar el título del documento por ruta y asegurar que el foco/contexto se actualice al navegar en la SPA, sin romper enlaces directos ni el historial atrás/adelante.

### B — Diálogos

**Archivos:** `src/components/ModalDialog.vue` únicamente.

- Asociar el nombre del diálogo a su encabezado con `aria-labelledby`.
- Al abrir, mover el foco a un destino razonable dentro del diálogo; mantener la navegación por teclado dentro mientras esté abierto.
- Cerrar con Escape y devolver el foco al elemento disparador al cerrar.
- Evitar que el fondo siga siendo operable mientras el diálogo está abierto y permitir desplazamiento interno en diálogos altos.
- Respetar `prefers-reduced-motion` en la transición.

### C — Foco, contraste y formularios

**Archivos:** `src/style.css`, `src/components/LoginForm.vue`, `src/components/RegisterForm.vue`, `src/components/PublishArticleForm.vue`, `src/components/RequestLoanForm.vue`, `src/components/PhotoDropzone.vue`.

- Definir un indicador de foco `:focus-visible` visible y consistente, sin borrar los estilos actuales de hover.
- Ajustar solo los colores de texto/controles que no alcancen contraste AA; mantener los colores de marca para decoración cuando corresponda.
- Asociar errores a sus controles con IDs, `aria-describedby` y `aria-invalid`; anunciar mensajes de error/éxito y enfocar el primer campo inválido al enviar.
- Mantener etiquetas visibles, valores ingresados tras errores y nombres específicos en acciones.
- Refactorizar `PhotoDropzone` para que el selector de archivo y “Cambiar foto” sean controles semánticos independientes, accesibles con teclado y con estado de proceso/error anunciado.
- Asegurar que las tarjetas y estados distingan disponibilidad/estado con texto además del color.

### D — Preferencias accesibles

**Archivos:** `src/components/AccountMenu.vue`, `src/lib/accessibility.ts` únicamente.

- Comunicar el estado seleccionado de tema y tamaño de fuente a lectores de pantalla (`aria-pressed` u otro patrón adecuado).
- Dar nombres accesibles que distingan los tres tamaños de fuente, no solo tres botones con la letra “A”.
- Validar los valores recuperados de `localStorage` y usar valores predeterminados seguros si están corruptos o fuera del conjunto permitido.
- Conservar persistencia actual de tema, tamaño y paleta para daltonismo.

## Criterios de aceptación

- Con teclado solamente se puede navegar desde la cabecera al catálogo y completar registro, inicio de sesión, solicitud y publicación; foco visible en cada control.
- El menú móvil permite llegar a las mismas rutas que el menú de escritorio.
- En cada modal, Tab/Shift+Tab permanecen dentro; Escape cierra; el foco vuelve al disparador.
- Los errores de formulario se identifican por campo y se anuncian; el primer campo inválido recibe foco.
- Ningún texto normal depende de un color con contraste menor a 4.5:1 en los temas admitidos; texto grande al menos 3:1. El foco y los controles tienen contraste perceptible.
- El contenido español se anuncia con idioma español. No hay navegación oculta sin alternativa ni controles con etiquetas ambiguas.
- El aumento de texto no recorta controles ni produce desplazamiento horizontal en móvil.
- `prefers-reduced-motion` elimina o reduce movimiento no esencial.
- Revisar manualmente a 375 px, 768 px y escritorio; recorrer con teclado y, si está disponible, lector de pantalla.
- Ejecutar `pnpm build` al integrar los bloques y corregir errores introducidos. No agregar tests o dependencias dentro de este trabajo sin autorización.

## Integración

Una persona integradora debe revisar los cuatro cambios juntos, resolver conflictos respetando el diseño existente y ejecutar la verificación final. No publicar ni desplegar. Reportar archivos cambiados, verificaciones realizadas y cualquier limitación pendiente.
