# Mi cuenta

La ruta `/cuenta` abre `/cuenta/perfil`. Está disponible para usuarios autenticados,
incluida administración, sin habilitarles acciones del mercado estudiantil.

- **Perfil:** nombre, apellido, foto, teléfono y carrera. La carrera se elige del
  catálogo real; `PATCH /api/me` valida formato y existencia antes de guardar.
  El correo permanece de solo lectura. Los cambios requieren Guardar; Cancelar
  recupera los datos actuales. La navegación advierte de cambios sin guardar.
- **Carnet:** `/cuenta/carnet`, solo estudiantes. Imagen JPG, PNG o WebP de hasta
  5 MB, con selección, vista previa, guardado, sustitución y borrado confirmado.
  Una carga nunca implica identidad verificada ni aprobación administrativa.
- **Apariencia y accesibilidad:** `/cuenta/preferencias`. Conserva las preferencias
  existentes de fuente, tema y colores accesibles en este navegador. El único idioma
  disponible es español; se retiraron las opciones sin implementar.
- **Fechas:** acceso a `/solicitudes`, donde se muestran los préstamos y sus fechas
  reales. Se retiró el modal de calendario que siempre mostraba un estado vacío.

## Almacenamiento del carnet

Migración `20261025050000_private_student_cards`. Bucket privado `student-cards`,
objeto único `<auth.uid()>/carnet`, sin nombre original del archivo ni URL pública.
Las políticas permiten leer, insertar, sustituir y eliminar únicamente al propio
estudiante activo. No se almacenan enlaces firmados en PostgreSQL o localStorage;
la vista solicita uno con vigencia de 5 minutos. “Actualizar vista” renueva el acceso.

No se implementa revisión administrativa del carnet en esta entrega. La foto de
perfil sigue usando el flujo público existente, separado del documento privado.

## Dirección visual

Se conserva el sistema UJAP y sus variantes de tema. Una navegación lateral agrupa
las tareas, con un panel por sección y navegación compacta en móvil. El acento
carmesí se usa para selección y acciones; los controles de tema muestran una vista
previa. La estructura sigue la dirección Taste `accent-ladder` adaptada a los tokens
existentes, sin nuevas dependencias ni tipografías.

## Comprobación de esta entrega

- Migración aplicada correctamente en el Supabase configurado.
- Compilación `pnpm build` correcta; continúa el aviso previo de tamaño del bundle.
- Revisado en Orca Browser con sesión de estudiante: perfil con las 17 carreras
  reales y carnet vacío cargado sin error de Storage. No se modificó la carrera ni
  se cargó un documento de ejemplo. La persistencia de esos cambios queda sin
  comprobar con documentos reales.
