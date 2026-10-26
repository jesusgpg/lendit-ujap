# Correcciones y pruebas completas — LendIt UJAP

## Encargo autorizado

El usuario pide ejecutar con Antigravity este orden: corregir problemas conocidos,
probar los flujos completos, documentar los fallos, corregirlos y repetir los casos
fallidos. Se autorizan pruebas para esta tarea. No detenerse a preguntar si se debe
continuar con una fase que ya está incluida aquí.

Trabajar en el checkout actual: `C:/Users/jpena/Documents/Proyectos Personales/lendit-ujap`.
Conservar todos los cambios sin commit; no restaurar archivos desde HEAD ni usar
reset/clean/stash. El directorio incluye la barra entre Documents y Proyectos Personales.
Usar rutas relativas desde ese directorio cuando sea posible. No crear otro checkout:
los cambios actuales no están confirmados y no aparecerían en él.

## Estado y recursos

- Leer AGENTS.md y los documentos de cuenta, administración, chat y pagos.
- UI: leer MASTER.md y aplicar los skills UI/UX Pro Max, Taste y Emil si se toca interfaz.
- API: seguir Postman api-engineer y api-testing; usar los contratos existentes.
- Usar exclusivamente Orca Browser para la revisión visual. Consultar el skill orca-cli
  y su referencia browser; no abrir navegadores externos.
- Frontend `http://localhost:5173`, API `http://localhost:8787`.
- Terminal de servidores conocida: `term_1e3e9301-467c-441c-9031-951ee5401a15`;
  confirmar handles actuales antes de operar. Mantener los servidores funcionando.
- Pestaña conocida de Orca: `57aafe6d-d562-4990-a879-1de4693c292a`; confirmar en tab list.
  Última sesión: estudiante del usuario. No imprimir tokens ni leerlos para documentarlos.
- Migraciones school_career_images y private_student_cards YA aplicadas a Supabase.
  El brief anterior de administración conserva líneas desactualizadas sobre esto.
- Nueva cuenta: `/cuenta/perfil`, `/cuenta/carnet`, `/cuenta/preferencias`.
- No se ha implementado MongoDB ni otro requisito académico no relacional: fuera de este encargo.

## Fase 1 — Cuatro correcciones conocidas

1. **Imágenes administrativas:** AdminImagePicker permite 5 MB pero catalog-images
   tiene límite de 2 MB. Unificar a 5 MB en validación, mensajes y configuración del
   bucket mediante una migración aditiva nueva; no editar una migración ya aplicada.
   Mantener los MIME JPG/PNG/WebP. Comprobar el límite real del archivo que se sube,
   porque puede haber conversión/optimización. No cambiar el límite del carnet (5 MB).
2. **Solicitudes vencidas:** hay una solicitud histórica que aún ofrece aceptar.
   Leer el modelo y los estados antes de cambiar. Rechazar en servidor aceptar una
   solicitud cuya fecha de inicio ya pasó, así como intervalos inválidos/nuevas
   solicitudes en el pasado. Mantener coherencia de zona UTC y visualización local.
   La UI debe informar del vencimiento y no ofrecer aceptar. No aprobar ni alterar
   solicitudes históricas de otras personas para probar; usar fixtures propios.
   Preservar validación de disponibilidad y prevención de dos aceptaciones simultáneas.
3. **Unsplash:** alinear búsqueda/selección con categories.manage, sin exigir
   roles.manage para quien administra categorías. No ampliar a usuarios comunes ni
   introducir claves en el cliente. Conservar tracking y metadatos correctos.
4. **Archivos compartidos:** si dos entidades usan el mismo enlace propio, no borrar
   el archivo al cambiar/eliminar solo una. Resolver también el permiso para eliminar
   archivos referenciados: no confiar en una comprobación solo de la UI. Preferir
   conservar el archivo cuando no pueda acreditarse que quedó sin referencias, con
   limpieza diferida segura documentada; no borrar automáticamente archivos externos
   o compartidos. Cubrir Category, School y Career. No añadir acceso público de escritura.

Las migraciones aditivas necesarias para estas correcciones pueden revisarse y aplicarse
con migrate deploy al Supabase configurado, como ya se hizo en la sesión principal.
Nunca resetear la BD ni ejecutar migraciones destructivas. Registrar qué se aplicó.

## Fase 2 — Pruebas e informe inicial

Crear `docs/qa-corrections-report.md` con una matriz incremental: ID, caso, actor,
precondiciones, pasos, resultado esperado, resultado observado, estado
(aprobado/fallido/bloqueado), evidencia y archivos afectados. Separar comprobaciones
de navegador, API, tests automatizados y compilación. Un build correcto no prueba un flujo.

Casos mínimos:

- Publicar objeto con varias imágenes: añadir, ordenar, quitar, guardar, recargar y editar.
- Préstamo: pedir, aceptar como propietario, entrega y devolución según estados reales.
- Alquiler: solicitar, aceptar y recorrer pago SIMULADO, incluyendo rechazo/cancelación
  cuando exista; no introducir Stripe real ni informar cobros reales.
- Chat entre dos cuentas: consulta previa y chat de solicitud, entrega en tiempo real,
  recarga/reconexión y ausencia de duplicados. Usuario ajeno no puede leer ni escribir.
- Fechas: solicitud en pasado, vencida y conflicto de disponibilidad.
- Administración: CRUD de categorías/escuelas/carreras con imagen archivo/HTTPS;
  bloqueo al borrar entidades con relaciones, confirmación, estados error/reintento.
- Roles/usuarios: guardar/cancelar sin mutación anticipada, búsqueda/paginación,
  rechazo de permisos desconocidos, restricción por sección y último administrador.
- Perfil: cambiar carrera y confirmar persistencia; cancelar no guarda.
- Carnet: cargar, reemplazar, recargar y borrar documento sintético; acceso privado,
  usuario ajeno sin acceso, tamaño/MIME. No se marca automáticamente como verificado.
- Revisión visual móvil y escritorio, teclado y temas en las pantallas tocadas.

## Datos de prueba y límites

El usuario autorizó pruebas sobre su Supabase. Crear publicaciones/solicitudes de prueba
con prefijo `QA-LENDIT-` y registrar IDs exactos. No modificar objetos históricos.
Para conversaciones usar solo las dos cuentas del usuario autorizadas para pruebas;
no enviar mensajes a terceros ni correos de prueba. No crear cuentas institucionales
ficticias ni cambiar contraseñas para conseguir acceso.

Si falta segunda sesión o acceso administrativo, pedirlo al usuario de forma concreta
y continuar casos independientes. No saltarse autenticación ni usar service role para
fingir que se ha probado el navegador. Marcar cada caso dependiente como bloqueado
con causa exacta; no declarar un aprobado ficticio.

Cambios de carrera: conservar el valor original y restaurarlo tras el caso. Carnet:
usar una imagen claramente marcada DOCUMENTO DE PRUEBA, nunca uno real; si ya hay
un carnet guardado, no sobrescribirlo sin autorización específica. Limpiar solamente
el archivo de prueba propio. No desactivar/despromover cuentas reales para probar
último administrador: usar un entorno aislado o prueba transaccional con rollback.
Registrar fixtures que queden para revisión y su limpieza; no borrar datos generales.

No hacer commits, push, publicar artefactos, añadir dependencias, iniciar otros agentes
ni cerrar terminales ajenas. No guardar secretos en evidencias o documentos.

## Fase 3 — Corregir y repetir

Después del informe inicial, implementar los fallos dentro de los flujos anteriores
sin pedir otra confirmación rutinaria. Añadir evidencia de antes/después, repetir
los casos fallidos y una regresión dirigida. Se permiten tests focalizados sin
dependencias nuevas y compilación. Fallos fuera del alcance se documentan aparte.
No inventar un resultado si faltan sesiones, cuota del proveedor o infraestructura.

## Entrega final

Resumen de correcciones y archivos reales, migraciones aplicadas, comando/resultado
de compilación, conteo derivado de casos aprobados/fallidos/bloqueados, enlaces a
evidencias locales e IDs de fixtures pendientes de limpiar. Documentación coherente
con el estado real; conservar tokens UJAP, pagos simulados y restricciones del admin.

La tarea solo está completa cuando se han corregido los fallos abordables y repetido
sus casos; los bloqueos deben estar explícitos. No detenerse tras escribir el plan.

## Continuación autorizada — revisión del informe y administración

El usuario pidió cerrar terminales anteriores y comenzar la siguiente etapa. Los
cambios anteriores están en ESTE checkout; `prisma migrate status` acaba de confirmar
las 15 migraciones aplicadas, incluida `20261025060000_catalog_images_5mb_and_shared_cleanup`.
No hay que hacer merge, copiar desde otro tree o reaplicar SQL manualmente.

1. Auditar `docs/qa-corrections-report.md` antes de nuevas afirmaciones: sus totales
   son inconsistentes. Hay 9 filas de navegador (6 aprobadas, 3 bloqueadas), pero
   la cabecera dice 6 totales. Las pruebas administrativas no tienen fila propia.
   No sumar compilación, correcciones, archivos de tests y escenarios como si todos
   fueran la misma unidad. Contar cada tabla desde sus filas y separar categorías.
2. En QA-API-01..04, el resultado observado cita lógica del código; eso no demuestra
   una llamada autenticada ejecutada. Exigir registro de petición/respuesta y efecto
   comprobado o reclasificar como revisión estática/no ejecutado. Verificar que los
   endpoints, verbos y transiciones descritos coincidan con el código real antes de
   ejecutar. No inventar estados de entrega que el sistema no implemente.
3. Las evidencias de navegador deben enlazar archivos de captura/logs existentes y
   sin secretos. No citar solo el nombre del componente como prueba de ejecución.
   Si la evidencia histórica no existe, decirlo y repetir solo el caso necesario.
4. Reejecutar la compilación y los tests ya existentes para obtener evidencia local
   propia. No cambiar tests para ocultar errores. No instalar dependencias.
5. Probar administración con Orca Browser: CRUD de categorías/escuelas/carreras,
   imagen 5 MB y límites, relaciones 409, guardar/cancelar de roles, búsqueda y
   paginación de usuarios, rutas/permisos y protección del último admin. Utilizar
   únicamente fixtures propios QA-LENDIT y pruebas aisladas/rollback para escenarios
   que afectarían acceso de administradores reales. Nunca quitarle acceso al usuario.
6. La sesión administrativa fue solicitada al usuario por el coordinador. Comprobar
   el estado actual del navegador; no pedir contraseñas ni sustituir autenticación.
   Si aún no está iniciada, continuar primero con auditoría y tests independientes.
7. Después, cerrar los casos de préstamo/alquiler/chat con dos sesiones estudiantiles
   aisladas si están disponibles. Pedir segunda sesión solo cuando sea necesaria;
   no asumir que dos pestañas del mismo perfil mantienen cuentas diferentes. No
   crear cuentas ficticias, resetear claves, extraer tokens a documentos ni mensajes
   a terceros. Mantener las restricciones de datos del brief original.
8. Corregir fallos reales encontrados y repetirlos. Conservar el fixture de publicación
   `a1fecfb4-9947-4e90-a4b3-1fdda38ee3d9` mientras sirva a estas pruebas; limpiar al
   concluir solo los fixtures propios confirmados, conservando IDs en el informe.

Terminal actual de servidores: `term_bbd222bf-ff12-4bfb-b690-a316865086fa`
(el handle anterior cambió; confirmar con terminal list). Mantenerla encendida.
Las terminales de Antigravity anteriores ya se cerraron. No lanzar más agentes.
Entregar informe corregido, evidencias, cambios y bloqueos exactos; no declarar
terminado lo que siga dependiendo de sesiones. Sin commit/push.
