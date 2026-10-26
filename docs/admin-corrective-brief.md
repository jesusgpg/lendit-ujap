
## Estado de implementación (verificado el 25/10/2026)

**Implementado en el árbol de trabajo (sin commit):**

- `api/schools.ts`: GET (con `careerCount`), POST, PATCH y DELETE por `?id=`; 400 para ID/entrada inválida, 404 inexistente, 409 `SCHOOL_IN_USE` si tiene carreras (sin cascada), 409 duplicado. Exige `careers.manage`.
- `api/careers.ts`: crea/edita con `imagenUrl` (solo HTTPS) e `imagenAlt`; serializa imagen igual en GET/POST/PATCH; rechaza PATCH vacío; mapea P2002/P2025/P2003.
- `api/categories.ts`: acepta `imagenUrl` HTTPS propia/externa, limpia metadatos de Unsplash al cambiar de origen; Unsplash sigue exigiendo `roles.manage`.
- `prisma/schema.prisma` y migración revisable `prisma/migrations/20261025040000_school_career_images/migration.sql` (columnas aditivas + bucket `catalog-images` con escritura limitada a `categories.manage`/`careers.manage`). **No aplicada** en ninguna base de datos.
- `src/components/AdminImagePicker.vue`: subir archivo (JPG/PNG/WebP, 5 MB), pegar enlace HTTPS, vista previa, enlace roto, reemplazar/quitar y texto alternativo.
- `src/lib/storage.ts` (`uploadCatalogImage`, `removeCatalogImage`) y `src/lib/catalogImage.ts`: sube al guardar, borra la subida huérfana si falla el guardado y elimina el archivo anterior propio solo después de guardar.
- `src/components/SchoolsManagerPanel.vue` (ruta `/admin/schools`), `CareersManagerPanel.vue` (por ID, escuelas vacías visibles, sin crear escuela en línea) y `CategoriesManagerPanel.vue` (selector general + Unsplash opcional), con confirmación de borrado vía `ModalDialog`, estados de carga/vacío/error con reintento y bloqueo de doble envío.
- Permisos: guard por sección en `src/main.ts`, `meta` por ruta en `src/router/index.ts`, navegación filtrada en `AdminView.vue`, `/admin` redirige a la primera sección autorizada y `AdminForbiddenView.vue` (`/admin/acceso-denegado`) evita el bucle al login.
- `vercel.json` y `server/dev-api.ts`: ruta `/api/schools/:id`.
- `pnpm build` (vue-tsc + tsc api + vite): terminó con código 0.

- Roles/Usuarios (segunda entrega): `api/_lib/adminGuard.ts` (protección del último administrador con transacción y `pg_advisory_xact_lock`, `409 LAST_ADMIN`) usada en `api/users/[id].ts` y `api/roles/[id].ts`; PATCH de roles rechaza permisos desconocidos (`400 UNKNOWN_PERMISSION`), acepta solo descripción o solo permisos y ya no ignora claves; PATCH de usuario devuelve 404 si no existe. `api/users.ts` con búsqueda (`q`) y paginación (25 por página). `RoleManagerPanel.vue` con borrador local, Guardar/Cancelar, descripción editable, errores por tarjeta y confirmación de borrado. `UsersManagerPanel.vue` con búsqueda, paginación, error con reintento, confirmación al deshabilitar y restauración del selector de rol si el servidor rechaza. `src/lib/api.ts` traduce códigos de error conocidos a mensajes en español. Documentación: `docs/admin-access.md` (matriz de permisos y último administrador) y `docs/image-credits.md` (créditos por fuente).

**No implementado / no comprobado:**
- Renombrado de roles (opcional en el brief): no implementado; los roles base se identifican por nombre en código.
- Protección del último administrador, paginación y búsqueda sin probar contra una BD real ni con sesiones reales; solo compilación (`pnpm build` código 0).
- Unsplash solo para categorías; atribución pública previa al lanzamiento sigue pendiente.
- Migración `20261025040000_school_career_images` y políticas de Storage sin aplicar; requieren revisión y `prisma migrate deploy` por el responsable. Sin aplicar, guardar imágenes propias o columnas nuevas fallará.
- Sin prueba en navegador (Orca) ni contra BD real; solo compilación (`pnpm build` código 0).
- Si dos entidades referencian el mismo enlace propio, el borrado del archivo no comprueba referencias cruzadas (cada subida usa un UUID único, pero un enlace pegado a mano podría repetirse).

---
Fecha: 25 de octubre de 2026. Destinatario: Antigravity.

## Objetivo y alcance

Completar la gestión administrativa: categorías con imágenes de cualquier origen admitido, escuelas con CRUD propio y carreras con edición e imágenes. Corregir inconsistencias comunes de permisos, confirmaciones y estados de formulario. Preservar los flujos del marketplace y el diseño UJAP actual.

Este diagnóstico procede de lectura de componentes, API, rutas y esquema; no acredita una prueba funcional autenticada. Implementar cambios reales y entregar evidencia de archivos modificados y limitaciones. No declarar terminado un flujo solo por haber escrito un plan.

## Hallazgos confirmados

| Área | Estado actual y evidencia | Corrección |
| --- | --- | --- |
| Categorías | `CategoriesManagerPanel.vue` y `api/categories.ts` permiten crear, editar y borrar, pero la imagen se selecciona mediante `unsplashPhotoId`. No existe entrada general de archivo o URL. | Selector «Imagen» con subir archivo, pegar URL HTTPS y buscar en Unsplash como opción. |
| Escuelas | `api/schools.ts` solo GET/POST con nombre. `AdminView.vue` no tiene sección de escuelas. | Sección y ruta propias; listar, crear, editar y eliminar con restricciones de relaciones. |
| Carreras | `CareersManagerPanel.vue` tiene edición/borrado, pero crea escuelas dentro del formulario y agrupa por nombre de escuela. Las escuelas sin carreras desaparecen. | Gestionar por ID, mostrar escuelas vacías en su panel y permitir asignar/reasignar una carrera. |
| Imágenes académicas | `School` y `Career` en `prisma/schema.prisma` no tienen campos de imagen ni texto alternativo. | Campos opcionales y DTO completos; usar el mismo selector que categorías. |
| Consistencia al crear | El formulario crea primero escuela y luego carrera con dos peticiones independientes. Un fallo de carrera puede dejar una escuela inesperada. | Preferir crear escuela explícitamente en su panel y seleccionarla después; si se conserva creación conjunta, realizarla de forma atómica en servidor. |
| Borrado | Categorías, carreras y roles ejecutan DELETE directamente desde sus funciones de borrado. Categorías/carreras ya bloquean registros en uso. | Confirmación accesible con nombre e impacto; conservar bloqueos y explicar cómo resolverlos. |
| Permisos | `/admin` exige `roles.manage` para todos sus hijos; API de categorías usa `categories.manage`, pero operaciones Unsplash exigen además `roles.manage`. Escuelas/carreras usan `careers.manage`. | Matriz coherente por sección y acción; navegación y API coincidentes, sin ampliar privilegios accidentalmente. |
| Roles | UI solo guarda permisos, mutando directamente `catalog.roles` antes de guardar. API admite descripción, no renombrado. DELETE protege roles base y roles usados. PATCH ignora claves de permiso desconocidas. | Borrador local, guardar/cancelar; editar descripción; renombrado solo de roles personalizados si se implementa sin romper identificadores. Rechazar permisos desconocidos y conservar roles base. |
| Usuarios | API de detalle admite rol/activo; UI ofrece reinicio de clave y habilitar/deshabilitar. Listado limitado a 100 sin paginación. No se observan protecciones contra deshabilitarse o quitar acceso al último administrador en ese handler. | Mantener desactivación, añadir protecciones contra pérdida del último administrador, errores claros y búsqueda/paginación. No agregar borrado definitivo indiscriminado. |

## Prioridad 1: imágenes generales y estructura académica

1. Crear un componente reutilizable de imagen administrativa con vista previa, reemplazar, quitar y texto alternativo. Etiquetas generales: «Imagen», «Subir imagen», «Pegar enlace», «Buscar en Unsplash». No llamar «Unsplash» al campo completo.
2. Distinguir origen: archivo propio, enlace externo o Unsplash. Definir contrato de imagen compartido para categoría/escuela/carrera y adaptar tipos/store/serializadores. Preservar las 20 fotos existentes. Al cambiar de origen limpiar metadatos incompatibles; nunca atribuir una foto propia a un fotógrafo anterior.
3. Subidas: reutilizar patrones existentes de `src/lib/storage.ts` y `PhotoDropzone.vue`, pero definir almacenamiento y políticas apropiadas para catálogos administrativos. Validar tamaño y MIME, indicar límites visibles y ofrecer errores recuperables. No abrir escritura pública ni exponer claves privilegiadas. No reutilizar ciegamente borrado de fotos de objetos.
4. Enlaces: HTTPS válido, error si la previsualización falla, sin aceptar javascript/data/blob como URL persistida. No descargar desde servidor URLs arbitrarias. Los data URLs transitorios de un archivo local no son URLs persistidas.
5. Guardar primero la entidad y después limpiar el archivo anterior de propiedad comprobada. Ante fallo conservar imagen persistida y borrador. Eliminar solo archivos propios sin referencias; nunca enlaces externos ni archivos compartidos. Cancelar no debe borrar la imagen guardada; limpiar nuevas subidas huérfanas con manejo explícito de errores.
6. Mantener búsqueda Unsplash como fuente opcional, su tracking cuando corresponda y metadatos. Conservar `docs/image-credits.md` y actualizar créditos por fuente; no reintroducir créditos en tarjetas por esta tarea. Dejar documentado el pendiente de atribución pública antes de lanzamiento.
7. Escuelas: añadir `/admin/schools`, panel propio, CRUD por ID, imagen opcional y alt. La ausencia de imagen no bloquea creación. Mostrar número real de carreras relacionadas para explicar restricciones.
8. Carreras: nombre, escuela opcional conforme al modelo vigente, imagen opcional y alt. Crear/editar/reasignar sin perder usuarios asociados. No añadir descripciones u otros campos sin necesidad del flujo.
9. Borrar escuela con carreras debe devolver 409 y explicar reasignar o retirar carreras primero, aunque la relación actual permita SetNull. No realizar cascadas ni desvinculaciones silenciosas. Mantener 409 al borrar carrera con usuarios y categoría con objetos; contemplar carreras concurrentes y restricciones DB.

## Prioridad 2: formularios, roles y acceso

- Confirmación de borrado con nombre del registro, Cancelar como salida segura, foco atrapado/restaurado y bloqueo de doble envío. Usar `ModalDialog.vue` existente.
- Estados de carga, vacío, error con reintento, guardado y borrado; try/catch/finally en cargas. Mensajes por campo; no descartar borradores ante errores recuperables. Evitar éxito visual antes de confirmación del servidor.
- Validar IDs, nombres vacíos/duplicados y actualizaciones vacías. Mapear no encontrado a 404, conflicto a 409 y entrada inválida a 400; no convertir P2025/P2002/P2003 esperables en un 500 genérico. Uniformar respuestas de carrera entre GET/POST/PATCH.
- Cada sección administrativa usa su permiso: roles.manage, users.manage, categories.manage o careers.manage (escuelas también). Filtrar enlaces; escoger la primera sección autorizada como destino. Un usuario autenticado sin permiso recibe pantalla de acceso denegado y API 403, no un bucle al login.
- Conservar restricción vigente: administradores pueden explorar y administrar; no publicar, pedir objetos, gestionar publicaciones personales, chatear ni pagar como estudiantes. Revisar `docs/admin-access.md` antes de tocar guards.
- Roles: mantener identidades ADMIN/STUDENT/PROFESSOR y prohibición de borrarlas. No permitir retirar el último acceso administrativo efectivo mediante cambio de rol, desactivación o edición de permisos. Resolver protección en servidor con concurrencia considerada, no solo controles deshabilitados.
- Usuarios: conservar historial de préstamos, conversaciones y pagos simulados. Edición de datos personales o cambio de correo de Supabase requieren contrato explícito; no agregarlos de manera improvisada en esta entrega.

## Integración y orden de ejecución

1. Cerrar contrato compartido de imágenes, DTO y reglas de borrado/permisos.
2. Preparar migración aditiva para School/Career y origen de imágenes; actualizar API y tipos. No resetear base, eliminar registros reales ni ejecutar migraciones remotas como parte de este handoff. Entregar SQL y pasos de aplicación revisables.
3. En paralelo tras fijar contrato: componente de imagen y panel de escuelas pueden desarrollarse por separado; un solo responsable integra `schema.prisma`, `src/stores/catalog.ts`, `src/types/app.ts` y router para evitar choques. No lanzar nuevos agentes sin autorización adicional.
4. Integrar selector en categorías/carreras, confirmaciones y estados. Luego abordar roles/usuarios y la matriz de acceso.
5. Actualizar `server/dev-api.ts` y `vercel.json` para detalles de escuela, manteniendo compatibilidad local/Vercel con parámetros. No crear rutas que funcionen solo en Express.

## Diseño y límites de trabajo

Leer AGENTS.md y `design-system/lendit-ujap/MASTER.md`. Aplicar ui-ux-pro-max a formularios/accesibilidad, design-taste-frontend al panel de escuelas siguiendo referencia de app screens, y emil-design-eng al pulido final. Preservar `src/style.css` y `src/ui-system.css`: Fraunces/Archivo, tokens crimson/gold/navy, temas claro/oscuro y visión de color. No instalar dependencias ni rediseñar marca.

Hay numerosos cambios sin commit: no reset/stash/checkout destructivo, no reemplazar archivos completos para resolver conflictos, no commits/push. No mostrar `.env`, credenciales ni UNSPLASH_ACCESS_KEY. Usar Orca Browser para inspección, no abrir navegador externo. No iniciar sesión como otro usuario ni enviar mensajes/correos de prueba ni modificar datos reales para demostrar el flujo.

## Criterios de aceptación y entrega

- Categorías, escuelas y carreras permiten elegir archivo, HTTPS o Unsplash; previsualizar, reemplazar, quitar y conservar la elección al editar. Registros antiguos sin foto siguen operando.
- Escuelas sin carreras son visibles y editables. Un registro libre se puede borrar con confirmación; uno relacionado muestra conflicto explicado y conserva sus relaciones.
- Guardar/cancelar, carga fallida, archivo inválido, enlace roto, duplicado y doble clic tienen comportamiento definido. Un fallo no elimina la imagen previa ni deja UI indicando guardado falso.
- Permisos de menú, ruta y API coinciden. Considerar 401 sin sesión, 403 sin autorización y protección de último administrador. Conservar restricciones del marketplace administrativo.
- Formularios operables con teclado, foco visible, etiquetas y alt; sin desbordamiento en móvil, temas existentes y reduced-motion respetados.
- Puede ejecutar `pnpm build` y revisión estática de diff. No agregar ni ejecutar suites de tests sin petición del usuario. La matriz anterior es criterio de revisión; reportar expresamente lo no comprobado en navegador o contra BD.
- Entregar resumen de archivos cambiados, migraciones/políticas pendientes, resultado real de compilación y pendientes. No confundir código preparado con cambios ya aplicados en Supabase.
