# Implementación de profesores — LendIt UJAP

Fecha: 2026-10-25. Autorizado por el usuario: «Vale adelante entonces».
Este brief sustituye las propuestas incompatibles de professor-review.md. La auditoría no es evidencia de implementación.

## Resultado esperado

Un profesor aprobado participa en préstamos, alquileres simulados y chat con alumnos y otros profesores. No obtiene privilegios administrativos. El dueño acepta o rechaza cada solicitud. La audiencia de la publicación limita quién puede verla, pedirla e iniciar consultas; no depende del rol del propietario.

| Audiencia | Estudiante | Profesor aprobado | Solicitante docente pendiente |
| --- | --- | --- | --- |
| Pública | Sí | Sí | Puede consultar; sin operaciones de marketplace hasta aprobación |
| Solo estudiantes | Sí | No | No |
| Solo profesores | No | Sí | No |

No permitir solicitar objetos propios. Mantener las reglas existentes de disponibilidad, devolución, pagos simulados y participantes del chat. ADMIN sigue teniendo catálogo de solo lectura y administración.

## Registro y aprobación

- Seleccionar «Soy profesor» expresa una solicitud, nunca asigna PROFESSOR desde metadatos controlados por el cliente.
- Registrar identidad y escuela obligatoria; departamento/cátedra opcional (máximo 120 caracteres); carrera opcional, perteneciente a la escuela seleccionada cuando se indique.
- No asignar una carrera arbitraria ni presentar al solicitante docente como estudiante verificado. Modelar explícitamente su tipo de cuenta y estado de validación; no confiar en el nombre del rol ni en metadatos del navegador para autorizar.
- Estados visibles: borrador, pendiente, requiere corrección, rechazado y aprobado. Enviar requiere datos completos y credencial. Pendiente congela la versión enviada. Corrección/rechazo permiten editar y reenviar con historial preservado. Rechazo y solicitud de corrección requieren motivo.
- Solo aprobación administrativa asigna PROFESSOR y habilita marketplace. Prohibir que edición de perfil, signup, fallback de /api/me, actualización de auth metadata o PATCH de usuarios permita saltarse esta compuerta. Si administración necesita asignar PROFESSOR, dirigir al mismo proceso validado.
- Revisión en «Validaciones docentes»: listado paginado/filtrado, detalle, credencial privada, acciones, estado y motivo. Nuevo permiso específico, por ejemplo teachers.review, otorgado inicialmente a ADMIN; autorización servidor y navegación por permiso.
- Guardar autor, fecha, motivo y versión de cada decisión. Proteger concurrencia, doble aprobación y decisiones sobre versiones obsoletas (409). La asignación del rol y la aprobación deben ser atómicas.
- Comunicar estado y motivo en Mi cuenta; reutilizar notificaciones internas existentes si las hay. No añadir correo/SMS ni servicios nuevos. Editar datos académicos relevantes o reemplazar/eliminar una credencial aprobada exige nueva revisión; mientras tanto suspender accesos docentes exclusivos y nuevas operaciones sin romper devolución/chat de acuerdos existentes.
- Preservar cuentas existentes. No degradar masivamente profesores históricos ni inventar aprobaciones. Inspeccionar si existen y documentar estrategia de transición segura antes de aplicar cambios que los afecten.

## Modelo, contratos y migraciones

- Migraciones nuevas y aditivas; no editar migraciones aplicadas, resetear BD ni eliminar datos existentes. Se autoriza aplicar las migraciones de este alcance al Supabase del usuario tras validarlas.
- User.schoolId y department; careerId nullable en almacenamiento, requerido para estudiantes por validación servidor y registro. Backfill de escuela desde la carrera actual, conservando valores existentes.
- Modelo de solicitud/decisiones con versión y vínculo seguro a la credencial. Definir invariantes de estado antes de implementar.
- Revisar todos los consumidores de careerId/career, serializadores, trigger signup, fallback /api/me, auth store, usuarios, borrado de escuela/carrera y scripts afectados. No dejar desreferencias de relaciones opcionales ni referencias huérfanas.
- Antes de implementar, documentar contrato en un artefacto local reutilizable (reutilizar OpenAPI/colección si existe; si no, documento de endpoints y ejemplos): perfil, lectura/envío/reenvío propio, listado/detalle administrativo, decisiones, descarga firmada. Definir métodos, validación, paginación y errores 400/401/403/404/409/413 según corresponda; no exponer detalles internos.
- Seguir postman:api-engineer y api-testing. Pruebas de funciones puras no sustituyen pruebas del handler HTTP y sus efectos en BD.

## Credencial privada

- Separar almacenamiento docente del carnet estudiantil si simplifica permisos; preservar archivos/políticas estudiantiles funcionales.
- Admitir JPEG/PNG/WebP hasta 5 MB, validando contenido además de extensión/tipo declarado. Mantener el alcance en imágenes; no añadir soporte PDF sin validación/visor correspondiente.
- Acceso solo del propietario activo y revisores autorizados activos; nunca URL pública. URLs firmadas de vida corta, sin mostrarlas en logs o evidencia. Paths sin nombres personales, ni nombres originales de documentos.
- RLS y handlers impiden acceso directo por otros estudiantes/profesores. Revisores consultan el documento de la versión enviada; el solicitante no puede sustituirlo tras envío para alterar lo revisado. Limpiar cargas fallidas/temporales sin borrar evidencia necesaria ni archivos ajenos.
- Documento sintético de prueba rotulado claramente; nunca presentar un fixture como carnet real ni como verificación universitaria automática.

## Interfaz

- Leer AGENTS.md, MASTER.md, ui-ux-pro-max, design-taste-frontend (flujo app screens) y emil-design-eng antes de tocar UI. Mantener tokens, fuentes, marca y modos existentes; sin dependencias nuevas.
- Adaptar registro, Mi cuenta, inicio y administración con lenguaje apropiado para docentes. Mostrar estados reales, instrucciones y acciones concretas.
- Responsive; etiquetas visibles, errores junto al campo, feedback de guardado, confirmaciones necesarias, navegación por teclado, foco y reduced-motion. Preservar edición de carrera estudiantil y todas las pantallas existentes.

## Validación obligatoria

1. Signup docente y metadata manipulada no conceden PROFESSOR/ADMIN; carrera requerida solo para estudiante; escuela/carrera incompatibles rechazadas por servidor.
2. Solicitud, envío, corrección, rechazo, reenvío y aprobación; motivos/historial; duplicados y concurrencia; usuario sin permiso no revisa ni firma URLs. No basta cambiar directamente el rol en BD para demostrar aprobación.
3. Credencial: carga, límite/tipos, aislamiento propietario/terceros/revisor, reemplazo y revisión sobre versión exacta. El carnet estudiantil sigue funcionando.
4. Profesor pide préstamo a estudiante y estudiante a profesor; aprobación, entrega y devolución. Alquiler en ambos sentidos con pago explícitamente simulado y sin cargos externos.
5. Chat en ambos sentidos, persistencia, participantes correctos y controles de audiencia. Probar pública, estudiantes y profesores en catálogo, solicitud y consulta, incluyendo acceso HTTP directo.
6. ADMIN no publica, solicita, paga ni usa chat del marketplace; solicitante pendiente no obtiene permisos docentes exclusivos ni opera como estudiante por accidente.
7. Completar pendientes previos: solicitud vencida rechazada en handler real sin crear préstamo/pago; protección del último administrador mediante mutaciones HTTP reales y concurrencia en entorno aislado. Nunca poner en riesgo el único administrador real.
8. Build/typecheck y suite apropiada; validar visualmente en Orca Browser, escritorio y móvil. No abrir ventanas externas. Preservar sesiones del usuario.

Se autoriza crear una cuenta docente sintética aislada para este QA y usar estudiante@ujap.edu.ve y la sesión del propietario ya autorizados. Generar secreto de prueba aleatorio y guardarlo solo en .env ignorado, nunca en este brief, logs o capturas. No modificar roles ni claves de las cuentas personales. Aislar pruebas destructivas/concurrentes en BD de pruebas o transacciones/fixtures seguros y demostrar límites si no es posible ejecutarlas en remoto.

## Entrega

Actualizar docs/professor-implementation-report.md con archivos, contratos, migraciones creadas/aplicadas, pruebas realmente ejecutadas (comando y resultado), evidencia local sin secretos, fixtures conservados/eliminados y pendientes concretos. Distinguir análisis estático, pruebas aisladas y flujos reales. No declarar aprobado lo que no se ejecutó. No hacer commit/push; preservar cambios ajenos y servidores. Identidad de Git si se consulta: jesusgpg / jesusp2095@gmail.com.
