# Pantallas y estándar visual de LendIt UJAP

Inventario basado en `src/router/index.ts`. Existen **17 pantallas con ruta propia** después de separar la información pública y añadir el inicio privado y los mensajes. `/admin` es una redirección y `/comofunciona` un alias; no son pantallas adicionales.

| Área | Ruta | Pantalla | Aplicación del estándar |
| --- | --- | --- | --- |
| Pública | `/` | Portada | Búsqueda y publicaciones destacadas; información extensa retirada |
| Pública | `/catalogo` | Catálogo | Composición nueva con filtros laterales y tarjetas con fotografía grande |
| Pública | `/como-funciona` | Proceso del préstamo | Página propia con cuatro pasos y acceso a publicar |
| Pública | `/categorias` | Directorio de categorías | Datos reales y enlaces al catálogo filtrado |
| Pública | `/confianza` | Acuerdos y recomendaciones | Página propia; explicación explícita del pago simulado |
| Acceso | `/login` | Inicio de sesión de la comunidad | Marco de acceso compartido, escudo, campos y jerarquía actualizados |
| Acceso | `/register` | Registro | Mismo marco, formulario ancho y adaptación a móvil |
| Acceso | `/admin/login` | Inicio de sesión administrativo | Mismo estándar, contexto restringido y retorno al acceso de comunidad |
| Estudiante | `/publicar` | Nueva publicación | Formulario, cabecera y superficies del estándar común |
| Estudiante | `/inicio` | Panel personal | Solicitudes por responder, préstamos activos, devoluciones y publicaciones reales |
| Estudiante | `/mensajes` | Bandeja y conversación | Consultas antes de solicitar y chats de solicitudes; lista y detalle en escritorio, una vista por vez en móvil |
| Estudiante | `/mis-publicaciones` | Gestión de publicaciones | Cabecera, resumen y filas de objetos actualizados |
| Estudiante | `/solicitudes` | Solicitudes y préstamos | Resumen, listas, estados y acciones actualizados |
| Administración | `/admin/roles` | Roles y permisos | Marco administrativo, tarjetas y controles comunes |
| Administración | `/admin/users` | Usuarios | Marco, filas y controles comunes |
| Administración | `/admin/categories` | Categorías | Marco, filas y formulario comunes |
| Administración | `/admin/careers` | Carreras | Marco, grupos y formulario comunes |

## Superficies adicionales

Las rutas incluyen estados de carga, vacío, error, validación y permisos. También se incluyen los diálogos de solicitud, edición y eliminación de publicaciones, chat, pago simulado, perfil y creación/edición de datos administrativos. Son estados de las pantallas anteriores, no rutas independientes.

## Contrato compartido

- Paleta institucional del proyecto: carmesí `#c8102e`, azul `#1a2b6b`, dorado `#c9971f`, crema `#efe6d0`; variantes de accesibilidad y tema conservadas mediante variables.
- Archivo para texto y controles; Fraunces para titulares de marca. Sin textos administrativos minúsculos en monoespaciado.
- La crema funciona como acento institucional; las áreas de trabajo usan papel y superficies neutras.
- Imágenes de producto grandes, datos reales y un estado visible. Los objetos sin foto usan la inicial de su categoría.
- Botones de al menos 44px en acciones principales, campos legibles, foco visible y estructura adaptable a móvil.
- La navegación informativa usa rutas reales y permanece disponible en cabecera o pie de página.
- Capa común de componentes en `src/ui-system.css`; catálogo y tarjetas tienen estilos propios, sin depender del diseño anterior.

## Alcance de la comprobación

La compilación comprueba todas las vistas y componentes. La revisión visual automatizada recorre las ocho rutas públicas y de acceso en escritorio y móvil.

La revisión autenticada como estudiante del 25 de octubre de 2026 recorrió `/inicio`, `/publicar`, `/mis-publicaciones` y `/solicitudes` con datos reales a 1440, 768, 390 y 375px. No se detectó desbordamiento horizontal. La sesión persistió al recargar las rutas y la portada redirigió al inicio privado al terminar la inicialización.

Se comprobaron el menú móvil, el despliegue de consejos, los campos de alquiler, la apertura de edición y el ciclo de foco del diálogo: entrada, Tab/Shift+Tab, Escape y devolución al botón de origen. No se guardaron publicaciones, solicitudes, pagos ni mensajes durante esta revisión. La compilación final pasó; permanece la advertencia de tamaño del paquete JavaScript.

La revisión visual autenticada del administrador sigue pendiente. No se ha verificado en esta pasada la entrega de mensajes en tiempo real ni una operación completa de préstamo/pago/devolución.

Hallazgo funcional adicional: hay una solicitud con plazo de septiembre que todavía figura como pendiente y ofrece aceptar. Revisar la política de vencimiento y la validación de aprobación en servidor; una revisión visual no establece que ese flujo sea correcto.
