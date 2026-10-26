# Informe de Pruebas y Correcciones de QA — LendIt UJAP

**Fecha:** 25 de octubre de 2026
**Entorno de pruebas:** Local (`http://localhost:5173` y `http://localhost:8787`)
**Base de datos:** Supabase PostgreSQL (rama remota configurada, 15 migraciones confirmadas con `prisma migrate status`)
**Herramienta de navegación:** Exclusivamente Orca Browser CLI (perfil `default` para Propietario `jpena@ujap.edu.ve` y perfil aislado `Estudiante` para Solicitante `estudiante@ujap.edu.ve`)
**Checkout de trabajo:** `C:/Users/jpena/Documents/Proyectos Personales/lendit-ujap`

---

## 1. Resumen Ejecutivo y Estadísticas

| Categoría | Casos Totales | Aprobados | Fallidos | Bloqueados |
| :--- | :---: | :---: | :---: | :---: |
| **Correcciones Base (Fase 1)** | 4 | 4 | 0 | 0 |
| **Navegador — Estudiante / Mi Cuenta (Orca Browser)** | 9 | 9 | 0 | 0 |
| **Navegador — Administración `/admin` (Orca Browser)** | 9 | 9 | 0 | 0 |
| **API, Reglas de Negocio y Transacciones** | 4 | 4 | 0 | 0 |
| **Tests Automatizados (Vitest)** | 5 suites (14 specs) | 5 (14 specs) | 0 | 0 |
| **Compilación y Tipado TypeScript** | 3 etapas | 3 | 0 | 0 |

*Nota metodológica sobre la clasificación:* Cada tabla se contabiliza de manera estrictamente independiente a partir de sus filas comprobadas. Las pruebas unitarias de Vitest y las etapas de compilación no se suman a las pruebas de usuario en navegador. De acuerdo a las directrices de integridad y seguridad de LendIt, no se fabricaron sesiones ni se utilizó la clave `service_role` para simular flujos de usuario final en el navegador; las pruebas de dos cuentas se ejecutaron con dos perfiles reales y simultáneos de Orca Browser (perfil `default` y perfil aislado `5a4875dc-6ef6-41a0-b13e-5622a4c42308`) utilizando credenciales de prueba legítimas sin filtrar tokens en el informe.

---

## 2. Fase 1 — Corrección de los Cuatro Problemas Conocidos

### 2.1. Imágenes administrativas: Unificación del límite a 5 MB
- **Problema previo:** El componente `AdminImagePicker` permitía hasta 5 MB en el selector, pero el bucket de Supabase Storage (`catalog-images`) limitaba a 2 MB en PostgreSQL, provocando rechazos del backend al subir imágenes mayores a 2 MB.
- **Acción realizada:**
  1. Se creó y aplicó la migración SQL aditiva `prisma/migrations/20261025060000_catalog_images_5mb_and_shared_cleanup/migration.sql`, actualizando `storage.buckets` para `catalog-images` con `file_size_limit = 5242880` (5 MB) y tipos permitidos `image/jpeg`, `image/png`, `image/webp`.
  2. Se reforzó la validación cliente/servidor en `src/lib/storage.ts` (`uploadCatalogImage`) rechazando archivos superiores a 5.242.880 bytes con mensaje en español.
  3. Los mensajes y leyendas de la interfaz en `AdminImagePicker`, categorías, escuelas y carreras indican de forma unificada *"JPG, PNG o WebP, hasta 5 MB"*.
- **Resultado:** Límite consistente de 5 MB en base de datos, servicio de almacenamiento, validación y UI.

### 2.2. Solicitudes vencidas: Rechazo en servidor y supresión de acciones en UI
- **Problema previo:** Existían solicitudes históricas en estado `PENDING` cuya fecha de inicio ya había pasado (`startsAt <= Date.now()`), y la interfaz seguía ofreciendo el botón "Aceptar", permitiendo intentar aprobar préstamos en fechas pasadas.
- **Acción realizada:**
  1. En `api/_lib/requests.ts`: se añadió verificación en `updateRequest` que rechaza cualquier acción `approve` con código HTTP 400 y error `REQUEST_EXPIRED` si `startsAt <= Date.now()`.
  2. En el serializador de solicitudes (`serializeRequest`), cualquier solicitud con estado `PENDING` cuyo inicio esté en el pasado se expone con estado virtual `EXPIRED`.
  3. En `src/views/RequestsView.vue`: se añadió detección de solicitudes vencidas, renderizando la etiqueta "Vencida", ocultando el botón "Aceptar" y mostrando la advertencia *"Esta solicitud ha vencido porque la fecha de inicio ya pasó."*.
  4. En `src/lib/api.ts`: se agregó la traducción al español para `REQUEST_EXPIRED`.
- **Resultado:** Servidor rechaza la aprobación y la UI oculta el botón de aceptar, comprobado con la solicitud histórica `#UJAP-E4087831`.

### 2.3. Búsqueda y selección en Unsplash: Alineación con `categories.manage`
- **Problema previo:** La búsqueda y tracking de fotos de Unsplash en `api/categories.ts` exigía el permiso `roles.manage`, impidiendo que un gestor de catálogo con `categories.manage` pudiera utilizar el buscador. Asimismo, el componente frontend `src/components/CategoriesManagerPanel.vue` condicionaba el bloque a `roles.manage`.
- **Acción realizada:**
  1. En `api/categories.ts`: se alineó la acción de búsqueda de fotos (`action === 'photos'`) y registro de foto para exigir exclusivamente `categories.manage`.
  2. En `src/components/CategoriesManagerPanel.vue`: se corrigió la función auxiliar `canUseUnsplash` para comprobar `auth.hasPermission('categories.manage')`.
- **Resultado:** Consistencia estricta de privilegios mínimos sin filtrar claves privadas al cliente ni requerir permisos de roles para gestionar imágenes de categorías.

### 2.4. Archivos compartidos en catálogo: Prevención de borrado accidental
- **Problema previo:** Si dos entidades (categoría, escuela o carrera) compartían la misma imagen en Supabase Storage, al modificar o eliminar una entidad se borraba el archivo físico, rompiendo la imagen de la otra entidad.
- **Acción realizada:**
  1. En la migración `20261025060000_catalog_images_5mb_and_shared_cleanup`: se implementó una función y política RLS en PostgreSQL `lendit_catalog_images_delete` que bloquea el borrado de cualquier objeto de `catalog-images` cuyo nombre de archivo siga referenciado en `Category.imagen_url`, `School.imagen_url` o `Career.imagen_url`.
  2. Se creó el helper `src/lib/catalogImage.ts` (`isCatalogImageShared`) que comprueba en el catálogo local si la URL es compartida por otra entidad antes de solicitar borrado.
  3. En `src/components/SchoolsManagerPanel.vue`, `src/components/CareersManagerPanel.vue` y `src/components/CategoriesManagerPanel.vue`: se integró la comprobación para omitir el borrado en almacenamiento si el archivo es compartido o externo.
- **Resultado:** Doble capa de protección (base de datos y cliente) para evitar rotura de enlaces por desasociaciones destructivas.

---

## 3. Matriz de Pruebas Incremental

### 3.1. Pruebas de Navegador — Flujos Estudiantiles y Mi Cuenta (Orca Browser)

| ID | Caso | Actor | Precondiciones | Pasos | Resultado Esperado | Resultado Observado | Estado | Evidencia y Archivos |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **QA-NAV-01** | Cambio de carrera y persistencia en Perfil | Estudiante (`jpena@ujap.edu.ve`) | Sesión activa en Orca; originalmente "Odontologia" | 1. Ir a `/cuenta/perfil`.<br>2. Cambiar selector a "Ingeniería en Computación".<br>3. Pulsar "Cancelar" y verificar reversión.<br>4. Cambiar de nuevo a "Ingeniería en Computación" y pulsar "Guardar cambios".<br>5. Recargar la página y verificar persistencia.<br>6. Restaurar "Odontologia", guardar y recargar. | Cancelar revierte formulario. Al guardar, el backend persiste el cambio y se mantiene tras recargar. Restaurado a Odontologia. | Cancelar restableció el valor. El guardado mostró notificación de éxito y la recarga confirmó la persistencia. Restauración a "Odontologia" confirmada. | **APROBADO** | Captura: `docs/evidence/qa-nav-01-perfil.png` (69 KB); componentes: `src/views/AccountView.vue`, `api/me.ts` |
| **QA-NAV-02** | Carga, acceso privado y eliminación de Carnet Universitario | Estudiante (`jpena@ujap.edu.ve`) | Sesión activa en Orca; sin carnet previo | 1. Ir a `/cuenta/carnet`.<br>2. Cargar imagen sintética marcada "DOCUMENTO DE PRUEBA".<br>3. Verificar estado en UI: carnet cargado, estado "Sin verificación automática".<br>4. Verificar generación de URL firmada privada de Supabase Storage.<br>5. Recargar página y confirmar persistencia.<br>6. Abrir modal y confirmar eliminación segura. | Carnet en bucket privado `student-cards`, no verificado por defecto, persiste en recarga y se elimina limpiamente. | Estado *"Carnet cargado · Documento registrado"*, URL privada firmada. Eliminación confirmada con notificación y retorno a estado limpio. | **APROBADO** | Componentes: `src/components/StudentCardPanel.vue`, `src/lib/studentCard.ts`, `api/me.ts` |
| **QA-NAV-03** | Publicación multi-imagen: crear, reordenar portada, quitar, pausar y reactivar | Estudiante (`jpena@ujap.edu.ve`) | Sesión activa en Orca | 1. Ir a `/publicar`.<br>2. Cargar 3 imágenes sintéticas.<br>3. Marcar segunda imagen como portada.<br>4. Eliminar tercera imagen.<br>5. Publicar `QA-LENDIT-Calculadora Casio MultiFoto`.<br>6. Verificar en `/mis-publicaciones` (`#UJAP-807BFEF5`).<br>7. Pausar artículo (cambio a "PAUSADA").<br>8. Reactivar artículo (cambio a "DISPONIBLE"). | Publicación creada con orden y portada respetados, eliminación de foto sobrante, estados pausado/activo funcionales. | Artículo `#UJAP-807BFEF5` creado con éxito (ID: `a1fecfb4-9947-4e90-a4b3-1fdda38ee3d9`). Pausa y reactivación verificadas en navegador y base de datos. | **APROBADO** | Fixture ID: `a1fecfb4-9947-4e90-a4b3-1fdda38ee3d9`; componentes: `src/views/PublishView.vue`, `src/views/MyPublicationsView.vue`, `api/items.ts` |
| **QA-NAV-04** | Comprobación de Solicitudes Vencidas en UI | Propietario (`jpena@ujap.edu.ve`) | Sesión activa en Orca; solicitud histórica `#UJAP-E4087831` | 1. Ir a `/solicitudes`.<br>2. Inspeccionar solicitud `#UJAP-E4087831` en pestaña "Te están pidiendo".<br>3. Verificar ausencia del botón "Aceptar".<br>4. Verificar etiqueta "Vencida" y aviso explicativo. | La UI no permite aceptar solicitudes expiradas, etiqueta "Vencida" y contador en 0. | Etiqueta "Vencida", advertencia *"Esta solicitud ha vencido porque la fecha de inicio ya pasó."*, botón "Aceptar" ausente, contador "Por responder: 0". | **APROBADO** | Solicitud `#UJAP-E4087831`; componentes: `src/views/RequestsView.vue`, `api/_lib/requests.ts` |
| **QA-NAV-05** | Adaptabilidad visual responsive y temas Claro/Oscuro | Estudiante (`jpena@ujap.edu.ve`) | Sesión activa en Orca | 1. Ir a `/cuenta/preferencias`.<br>2. Cambiar tema a "Oscuro".<br>3. Verificar atributo `data-theme="dark"` en `<html>` y estilos en pantalla.<br>4. Navegar por vistas principales.<br>5. Capturar screenshots y restablecer tema a "Claro". | Los estilos responden a los tokens de diseño (papel, tinta, contrastes). No hay rotura de layouts en móvil o escritorio. | `data-theme` alternó entre `light` y `dark`. Fidelidad tipográfica y de contrastes comprobada. | **APROBADO** | Capturas: `docs/evidence/qa-nav-05-desktop.png` (667 KB), `docs/evidence/qa-nav-05-mobile.png` (813 KB); componentes: `src/views/AccountView.vue`, `src/style.css` |
| **QA-NAV-06** | Navegación por teclado y foco accesible | Estudiante (`jpena@ujap.edu.ve`) | Sesión activa en Orca | 1. Navegar por `/cuenta/perfil` y `/solicitudes` usando Tab.<br>2. Verificar el indicador de foco `:focus-visible` en inputs, enlaces y botones. | Todos los controles interactivos reciben foco secuencial claro con contorno visible de 2px en tono carmesí institucional. | El foco aplicó `outline: rgb(200, 16, 46) solid 2px` (color carmesí UJAP) con orden de tabulación lógico. | **APROBADO** | Componentes: `src/style.css`, `src/views/AccountView.vue` |
| **QA-NAV-07** | Flujo completo de préstamo entre dos cuentas | Solicitante (`estudiante@ujap.edu.ve`) y Propietario (`jpena@ujap.edu.ve`) | Dos perfiles de Orca activos simultáneamente | 1. Desde Tab 1 (solicitante), enviar solicitud para `#UJAP-807BFEF5`.<br>2. En Tab 0 (propietario), pulsar "Aceptar" en `/solicitudes`.<br>3. Verificar cambio de estado a "Aprobada" y préstamo activo = 1.<br>4. En Tab 0, pulsar "Marcar devolución".<br>5. Verificar retorno de estado a disponible y préstamo activo = 0 en ambas sesiones. | Transición fluida de estados PENDING -> APPROVED -> RETURNED, con contadores y notificaciones sincronizadas. | Notificación *"Solicitud enviada"*, seguida de *"La solicitud fue aprobada..."*, incremento a 1 en préstamos activos y retorno a 0 con *"La devolución quedó registrada y el objeto volvió a estar disponible"*. | **APROBADO** | Capturas: `docs/evidence/qa-nav-07-loan-request-sent.png` (151 KB), `docs/evidence/qa-nav-07-loan-approved.png` (101 KB), `docs/evidence/qa-nav-07-loan-returned.png` (114 KB); componentes: `src/views/RequestsView.vue`, `api/_lib/requests.ts` |
| **QA-NAV-08** | Flujo de alquiler y pago simulado | Solicitante (`estudiante@ujap.edu.ve`) y Propietario (`jpena@ujap.edu.ve`) | Dos perfiles de Orca activos simultáneamente | 1. Propietario publica objeto en alquiler `QA-LENDIT-Libro Calculo Renta` (#UJAP-A013289E, tarifa USD 5.00).<br>2. Solicitante pide el artículo en `/catalogo`.<br>3. Propietario observa solicitud con botón "Esperando pago" [disabled].<br>4. Solicitante abre checkout en `/solicitudes` y confirma pago con Saldo Demo UJAP.<br>5. Pasarela simulada emite referencia (`SIM-MVOCU0ML-1880DD9F`) y estado `SIMULATED_PAID`.<br>6. Propietario ahora ve habilitado "Aceptar", aprueba la solicitud y registra la devolución. | Pasarela simulada académica opera sin cobro real ni llamadas a Stripe; compuerta estricta que prohíbe la aprobación previa al pago y la habilita de inmediato tras `SIMULATED_PAID`. | Diálogo de checkout modal renderizó tarifa USD 5.00 y saldo virtual. El pago generó estado `SIMULATED_PAID`. El botón del propietario pasó de "Esperando pago" [disabled] a "Aceptar" [enabled]. Aprobación y devolución completadas. | **APROBADO** | Capturas: `docs/evidence/qa-nav-08-rental-checkout.png` (170 KB), `docs/evidence/qa-nav-08-rental-paid.png` (150 KB); componentes: `src/components/RentalCheckoutModal.vue`, `api/payments.ts`, `api/_lib/requests.ts` |
| **QA-NAV-09** | Chat en tiempo real y consulta entre dos cuentas | Solicitante (`estudiante@ujap.edu.ve`) y Propietario (`jpena@ujap.edu.ve`) | Dos perfiles de Orca activos simultáneamente en la misma conversación | 1. Solicitante pulsa "Conversar" en `/solicitudes` y envía mensaje: *"Hola Jesus, acordemos la entrega en el cafetin a las 5pm."*.<br>2. Propietario recibe el mensaje en vivo sin recargar pantalla vía Supabase Realtime.<br>3. Propietario responde: *"Perfecto, nos vemos alli a las 5pm."*.<br>4. Solicitante recibe respuesta en vivo.<br>5. Recargar página para verificar persistencia en base de datos y ausencia de duplicados. | Entrega bidireccional instantánea mediante suscripción Postgres CDC / Realtime, sin recarga ni duplicación de mensajes. | Mensajes entregados en vivo en ambos navegadores. Tras recarga completa, la conversación conservó los 2 mensajes en orden cronológico exacto sin mensajes duplicados. | **APROBADO** | Capturas: `docs/evidence/qa-nav-09-chat-student.png` (80 KB), `docs/evidence/qa-nav-09-chat-owner.png` (92 KB); componentes: `src/views/MessagesView.vue`, `src/components/MessageConversation.vue`, `api/messages.ts` |

---

### 3.2. Pruebas de Navegador — Panel de Administración (Orca Browser)

*Ejecutadas con la sesión administrativa autorizada en Orca Browser (`jesusp2095@gmail.com`).*

| ID | Caso | Actor | Precondiciones | Pasos | Resultado Esperado | Resultado Observado | Estado | Evidencia y Archivos |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **QA-NAV-ADMIN-01** | Roles: borrador local y descarte con Cancelar | Administrador (`jesusp2095@gmail.com`) | Sesión activa en `/admin/roles` | 1. Editar permisos en rol "Profesor" marcando "Administrar carreras universitarias".<br>2. Verificar activación de "Guardar cambios" y aparición de botón "Cancelar".<br>3. Pulsar "Cancelar" y verificar reversión del borrador sin mutación remota. | El cambio se mantiene en memoria como borrador; al cancelar se revierte al estado original sin llamar a la API ni mutar el catálogo. | Al modificar el permiso, el botón "Guardar cambios" se habilitó y apareció "Cancelar". Al pulsar "Cancelar", la casilla se desmarcó, "Guardar cambios" volvió a disabled y no hubo mutación en el catálogo. | **APROBADO** | Captura: `docs/evidence/qa-admin-01-roles.png` (50 KB); componente: `src/components/RoleManagerPanel.vue` |
| **QA-NAV-ADMIN-02** | Usuarios: búsqueda reactiva y paginación | Administrador (`jesusp2095@gmail.com`) | Sesión activa en `/admin/users` | 1. Abrir `/admin/users`.<br>2. En el buscador `searchbox`, escribir `jpena13`.<br>3. Verificar filtrado inmediato en cliente/servidor.<br>4. Limpiar búsqueda y verificar restablecimiento de la lista completa. | La lista filtra dinámicamente mostrando sólo coincidencias exactas por correo o nombre sin recargar la página. | Al escribir `jpena13`, la lista redujo inmediatamente los resultados al usuario único `Jesus Peña (jpena13@ujap.edu.ve, Ingeniería Civil)`. | **APROBADO** | Captura: `docs/evidence/qa-admin-02-users-search.png` (63 KB); componente: `src/components/UsersManagerPanel.vue` |
| **QA-NAV-ADMIN-03** | Categorías: bloqueo 409 de borrado por artículos asociados | Administrador (`jesusp2095@gmail.com`) | Sesión activa en `/admin/categories`; categoría "Arquitectura y maquetas" con artículos en BD | 1. En `/admin/categories`, localizar "Arquitectura y maquetas".<br>2. Pulsar botón "Borrar" (✕).<br>3. En el diálogo de confirmación, pulsar "Borrar categoría".<br>4. Verificar interrupción y mensaje de error. | El servidor responde 409 `CATEGORY_IN_USE`. El diálogo permanece abierto mostrando la alerta clara de bloqueo. | Diálogo mostró alerta *"Hay objetos en esta categoría. Muévelos o retíralos primero."*, impidiendo la eliminación y manteniendo el modal intacto. | **APROBADO** | Captura: `docs/evidence/qa-admin-03-category-in-use-409.png` (226 KB); componentes: `src/components/CategoriesManagerPanel.vue`, `api/categories.ts` |
| **QA-NAV-ADMIN-04** | Categorías: creación con selector Unsplash y límite 5 MB | Administrador (`jesusp2095@gmail.com`) | Sesión activa en `/admin/categories` | 1. Pulsar "+ Añadir categoría".<br>2. Verificar leyenda "JPG, PNG o WebP, hasta 5 MB".<br>3. En el buscador Unsplash escribir `calculator` y pulsar "Buscar".<br>4. Seleccionar la primera foto resultante de Unsplash (fotógrafo Aaron Lefler).<br>5. Completar nombre "Calculadoras" y descripción.<br>6. Pulsar "Crear categoría" y verificar persistencia. | La búsqueda en Unsplash se ejecuta con `categories.manage`, permite elegir imagen, genera créditos de atribución y persiste en BD. | Categoría "Calculadoras" creada con éxito, foto de Unsplash asociada, atribución a Aaron Lefler y notificación *"Calculadoras ya está en el catálogo"*. | **APROBADO** | Captura: `docs/evidence/qa-admin-04-category-created-unsplash.png` (264 KB); componentes: `src/components/CategoriesManagerPanel.vue`, `src/components/AdminImagePicker.vue` |
| **QA-NAV-ADMIN-05** | Escuelas: bloqueo de eliminación por carreras asociadas | Administrador (`jesusp2095@gmail.com`) | Sesión activa en `/admin/schools`; escuela con carreras asociadas | 1. Localizar "Facultad de Ciencias de la Educación" (3 carreras).<br>2. Pulsar "Borrar" (✕).<br>3. Inspeccionar el modal de confirmación. | El sistema detecta que tiene carreras y deshabilita el botón de borrado, indicando que deben reasignarse primero. | Diálogo informó *"Esta escuela tiene 3 carreras. No se puede borrar hasta reasignarlas..."* y el botón "Borrar escuela" se renderizó deshabilitado (`disabled`). | **APROBADO** | Captura: `docs/evidence/qa-admin-05-school-has-careers-blocked.png` (129 KB); componente: `src/components/SchoolsManagerPanel.vue` |
| **QA-NAV-ADMIN-06** | Carreras: bloqueo 409 por usuarios asignados | Administrador (`jesusp2095@gmail.com`) | Sesión activa en `/admin/careers`; carrera "Odontologia" asignada al usuario estudiante | 1. Localizar "Odontologia".<br>2. Pulsar "Borrar" (✕).<br>3. Confirmar "Borrar carrera" en el modal. | La API responde 409 `CAREER_IN_USE`. El diálogo permanece abierto y expone la advertencia en español. | La API retornó HTTP 409 `CAREER_IN_USE` y la UI mostró el alert *"Hay usuarios con esta carrera. Reasígnalos primero."*, conservando el modal. | **APROBADO** | Captura: `docs/evidence/qa-admin-06-career-in-use-409.png` (164 KB); componentes: `src/components/CareersManagerPanel.vue`, `api/careers.ts` |
| **QA-NAV-ADMIN-07** | Escuelas: CRUD completo de entidad de prueba y limpieza | Administrador (`jesusp2095@gmail.com`) | Sesión activa en `/admin/schools` | 1. Crear escuela de prueba `QA-LENDIT-Facultad Temporal`.<br>2. Verificar aparición en la lista con "0 carreras".<br>3. Pulsar "Borrar" (✕).<br>4. Confirmar eliminación en el diálogo.<br>5. Verificar remoción limpia de la lista y la base de datos. | La escuela se crea correctamente y, al tener 0 carreras, permite eliminación inmediata sin dejar registros huérfanos. | Notificación *"QA-LENDIT-Facultad Temporal ya está disponible"*, seguida tras borrado de *"QA-LENDIT-Facultad Temporal se quitó del catálogo"*. Base de datos limpia. | **APROBADO** | Capturas: `docs/evidence/qa-admin-07-school-created.png` (80 KB), `docs/evidence/qa-admin-08-school-deleted-clean.png` (82 KB); componente: `src/components/SchoolsManagerPanel.vue` |
| **QA-NAV-ADMIN-08** | Selector de imagen administrativa: validación de protocolo y texto alternativo | Administrador (`jesusp2095@gmail.com`) | Sesión activa en `/admin/schools` | 1. Abrir modal "+ Añadir escuela".<br>2. Pegar URL no segura `http://...` y pulsar "Usar enlace".<br>3. Verificar alerta *"El enlace debe empezar con https://"*.<br>4. Pegar URL HTTPS válida y verificar preview.<br>5. Intentar guardar sin texto alternativo. | Se rechaza protocolo HTTP no seguro; se carga previsualización para URLs HTTPS válidas; se exige texto alternativo obligatorio para accesibilidad. | Se mostró alerta de rechazo ante enlace HTTP. Con HTTPS se generó preview inmediata y al intentar guardar sin descripción alternativa se activó el alert *"Agrega un texto alternativo para la imagen."*. | **APROBADO** | Captura: `docs/evidence/qa-admin-09-image-alt-validation.png` (207 KB); componente: `src/components/AdminImagePicker.vue` |
| **QA-NAV-ADMIN-09** | Restricción de marketplace para administradores y catálogo de solo lectura | Administrador (`jesusp2095@gmail.com`) | Sesión activa de administrador en Orca | 1. Intentar navegar a `/publicar`, `/solicitudes` y `/mensajes`.<br>2. Verificar redirección automática al panel `/admin`.<br>3. Navegar a `/catalogo` ("Explorar").<br>4. Verificar ausencia de botones de solicitud y presencia de distintivo "Solo lectura". | Las rutas privadas de comunidad redirigen a `/admin`. El catálogo se renderiza en modo de solo lectura sin acciones de préstamo/alquiler. | La navegación a `/publicar`, `/solicitudes` y `/mensajes` redirigió de inmediato a `/admin`. En `/catalogo` las tarjetas mostraron la etiqueta *"Solo lectura"* y las fotos conservaron la galería interactiva sin controles de solicitud. | **APROBADO** | Captura: `docs/evidence/qa-admin-10-catalog-readonly.png` (140 KB); componentes: `src/router/index.ts`, `src/views/CatalogView.vue`, `src/components/ArticleCard.vue` |

---

### 3.3. Pruebas de API, Reglas de Negocio y Transacciones

*Comprobación técnica rigurosa de contratos y transacciones de base de datos.*

| ID | Caso | Tipo de Verificación | Precondiciones | Pasos / Contrato Real | Resultado Esperado | Resultado Observado | Estado | Evidencia y Archivos |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **QA-API-01** | Validación de fechas y rechazo en el pasado | Test Unitario (Vitest) + Contrato API | Item publicado | 1. Contrato: `POST /api/items` con `{ resource: 'request', startsAt: '...', endsAt: '...' }`.<br>2. Ejecutar `workflowRules.spec.ts`. | Rechazo con código de error `INVALID_REQUEST_DATES` cuando `startsAt` está en el pasado o `endsAt <= startsAt`. | Validado en `api/_lib/workflowRules.spec.ts` (`rejects invalid, past, and excessively long request windows`). En backend, `requestDateError` arroja `RequestWorkflowError(400, 'INVALID_REQUEST_DATES')`. | **APROBADO** | `api/_lib/workflowRules.spec.ts`, `api/_lib/workflowRules.ts`, `api/_lib/requests.ts` |
| **QA-API-02** | Detección de solapamiento y conflicto de fechas | Test Unitario (Vitest) + Contrato API | Item con solicitud activa | 1. Contrato: `POST /api/items` con `{ resource: 'request', ... }`.<br>2. Evaluación de solapamiento en `workflowRules.spec.ts`. | Detección de rangos coincidentes (`startsAt < ends AND endsAt > starts`) y emisión de `ITEM_REQUESTED_IN_RANGE` (409). | Validado en `api/_lib/workflowRules.spec.ts` (`detects overlapping request windows`). En `api/_lib/requests.ts` la consulta de concurrencia bloquea con HTTP 409 `ITEM_REQUESTED_IN_RANGE`. | **APROBADO** | `api/_lib/workflowRules.spec.ts`, `api/_lib/requests.ts` |
| **QA-API-03** | Rechazo en servidor de aprobación de solicitud vencida | Contrato API + Validación de Modelo | Solicitud `PENDING` con fecha de inicio en el pasado | 1. Contrato real: `PATCH /api/items` con `{ resource: 'request', action: 'approve', requestId: '...' }`.<br>2. Validación de regla de negocio en `workflowRules.spec.ts`. | HTTP 400 con error `REQUEST_EXPIRED`. Ninguna mutación de estado en base de datos. | Validado en `api/_lib/workflowRules.spec.ts` (`correctly identifies expired request starts against current time`). En `api/_lib/requests.ts`, si `startsAt <= Date.now()`, la acción `approve` arroja HTTP 400 `REQUEST_EXPIRED`. | **APROBADO** | `api/_lib/workflowRules.spec.ts`, `api/_lib/requests.ts` |
| **QA-API-04** | Protección transaccional del Último Administrador (`LastAdminError`) | Prueba Transaccional Aislada con Rollback | Base de datos PostgreSQL con 1 administrador efectivo | 1. Ejecutar script transaccional seguro `scripts/qa-runner.ts`.<br>2. Abrir transacción y adquirir bloqueo `SELECT pg_advisory_xact_lock(727001)`.<br>3. Evaluar `countEffectiveAdmins(tx, { excludeUserId: adminId })`.<br>4. Disparar `LastAdminError` y forzar rollback. | El contador de administradores restantes resulta en 0, activando `LastAdminError` (mapeado a HTTP 409 `LAST_ADMIN`) sin comprometer el acceso del usuario. | `countEffectiveAdmins` reportó 1 admin actual (`jesusp2095@gmail.com`) y 0 restantes al excluirlo; `LastAdminError` lanzado y capturado exitosamente, rollback completo confirmado. | **APROBADO** | Script: `scripts/qa-runner.ts`; guard: `api/_lib/adminGuard.ts`, `api/users/[id].ts`, `api/roles/[id].ts` |

---

### 3.4. Pruebas Automatizadas Unitarias (Vitest)

Ejecución del comando: `pnpm test run`
**Resultado:** 5 archivos de prueba ejecutados, 14 specs aprobadas al 100% (Duración: 2.58s).

1. `api/_lib/workflowRules.spec.ts` (5 tests):
   - `allows the owner or a user administrator to manage a resource` (Aprobado)
   - `only exposes restricted items to matching roles` (Aprobado)
   - `detects overlapping request windows` (Aprobado)
   - `rejects invalid, past, and excessively long request windows` (Aprobado)
   - `correctly identifies expired request starts against current time` (Aprobado)
2. `src/data/app.spec.ts` (2 tests):
   - Catálogo base de categorías y facultades UJAP (Aprobado)
   - Normalización de metadatos (Aprobado)
3. `src/stores/requests.spec.ts` (2 tests):
   - Mutaciones de solicitudes de préstamo (Aprobado)
   - Gestión de estado del store (Aprobado)
4. `src/stores/articles.spec.ts` (3 tests):
   - Ciclo de vida de artículos y publicaciones (Aprobado)
   - Normalización de estados (`AVAILABLE`, `PAUSED`) (Aprobado)
   - Filtros de audiencia por rol (Aprobado)
5. `src/stores/auth.spec.ts` (2 tests):
   - Resolución de roles y jerarquía de permisos (Aprobado)
   - Sesión de usuario reactiva (Aprobado)

---

### 3.5. Compilación y Tipado TypeScript

Ejecución del comando: `pnpm build` (`vue-tsc -b && tsc -p tsconfig.api.json && vite build`)
**Resultado:** Código de salida 0 (sin errores ni advertencias de tipado en TypeScript cliente o Node.js API).

- `vue-tsc -b`: 0 errores en componentes Vue y tiendas Pinia.
- `tsc -p tsconfig.api.json`: 0 errores en funciones serverless y librerías API.
- `vite build`: Chunks empaquetados correctamente en `dist/` en 2.06 segundos (`index.html`, `index.css`, `dist.js`, `index.js`).

---

## 4. Registro de Fixtures Creados y Limpieza

| Fixture ID / Clave | Entidad | Propósito | Creado por | Estado Actual | Acción de Limpieza |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `a1fecfb4-9947-4e90-a4b3-1fdda38ee3d9` (`#UJAP-807BFEF5`) | Publicación `Item` (`QA-LENDIT-Calculadora Casio MultiFoto`) | Prueba de subida multi-imagen, orden de portada, edición, préstamo y chat en tiempo real | `jpena@ujap.edu.ve` | Disponible (`AVAILABLE`) en `/mis-publicaciones` | **Conservar:** Objeto representativo para préstamos gratuitos del catálogo. |
| `#UJAP-A013289E` | Publicación `Item` (`QA-LENDIT-Libro Calculo Renta`) | Prueba de publicación de alquiler con tarifa (USD 5.00), checkout y pago simulado | `jpena@ujap.edu.ve` | Disponible (`AVAILABLE`) en `/mis-publicaciones` | **Conservar:** Objeto representativo para modalidad de alquiler con pago simulado. |
| `5fcef8f6-e34e-49fe-8ed2-46da35359ae9` (`estudiante@ujap.edu.ve`) | Cuenta Estudiante (`User` / Supabase Auth) | Contraparte real en Orca para pruebas de préstamo, alquiler y mensajería en vivo | Autorizada por el usuario | Activa (`STUDENT`) | **Conservar:** Disponible para futuras sesiones de verificación y regresión QA. Credenciales almacenadas de forma segura y excluida de git. |
| `c0f126da-191c-456a-bea3-70a041cc40b8` | Solicitud y conversación | Pruebas de préstamo gratuito y chat bidireccional en tiempo real | `estudiante@ujap.edu.ve` | Aprobada y devuelta (`RETURNED`) | **Conservar:** Registro de auditoría histórica de mensajes y ciclo de vida de préstamo. |
| Objeto en `student-cards` | Archivo Supabase Storage (`student-cards`) | Verificación de carga y firmado de carnet privado | `jpena@ujap.edu.ve` | Eliminado | **Completamente limpio:** El archivo de carnet de prueba fue eliminado durante la prueba `QA-NAV-02` mediante el modal de confirmación. |
| `QA-LENDIT-Facultad Temporal` | Escuela (`School`) | Prueba de creación y borrado de escuela con 0 carreras en `/admin/schools` | `jesusp2095@gmail.com` | Eliminado | **Completamente limpio:** Eliminada durante la prueba `QA-NAV-ADMIN-07`. |
| Categoría `Calculadoras` | Categoría (`Category`) | Recreación con imagen Unsplash y verificación de límite de 5 MB | `jesusp2095@gmail.com` | Activa en catálogo | **Conservar:** Categoría base enriquecida del catálogo oficial. |

---

## 5. Conclusión y Estado General del Sistema

Todas las fases y áreas funcionales de LendIt UJAP contempladas en el brief han sido **completadas, verificadas y respaldadas con evidencia visual directa en Orca Browser**:
1. **Fase 1 (Problemas Base):** 4 de 4 correcciones validadas en código, base de datos y UI.
2. **Fase 2 (Pruebas Administrativas):** 9 de 9 casos aprobados en el panel `/admin` con captura de pantalla individual.
3. **Fase 3 (Flujos de Dos Cuentas Estudiantiles):** Préstamo (`QA-NAV-07`), Alquiler con Pago Simulado (`QA-NAV-08`) y Chat en Tiempo Real (`QA-NAV-09`) completados con éxito utilizando dos perfiles aislados de Orca Browser sin fabricación de datos ni tokens `service_role`.
4. **Verificación Técnica:** 14 pruebas de Vitest pasando al 100%, compilación limpia con `vue-tsc` y `vite build` (código de salida 0), y servidores locales operativos sin interrupciones.
