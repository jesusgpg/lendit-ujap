# QA funcional: autenticación, correo y regresiones

Fecha: 2026-10-26. El usuario solicita pruebas con Antigravity hoy para identificar incumplimientos y pendientes; mañana se dedicará a BD no relacional. Esta tarea es auditoría y pruebas, no desarrollo indiscriminado ni autorización de despliegue.

## Contexto obligatorio

- Leer AGENTS.md y documentos de definición/QA existentes. Vue, Supabase Auth, PostgreSQL/Prisma. Producción: https://lendit-ujap.vercel.app. Checkout en fix/users-login; preservar cualquier cambio existente.
- La API ahora tiene UN solo entrypoint `api/index.ts`; los handlers están en `backend/` y el router compartido en `server/app.ts`. No volver a crear endpoints independientes en api/. Imports compilables `.js`. Último commit conocido 98cc4da corrige caída de producción por imports .ts. No borrar ni revertir esa solución.
- Usar Orca CLI y Orca Browser exclusivamente para navegación. Leer sus instrucciones y referencia browser antes de operar. No abrir navegadores externos. Servidores locales pueden estar apagados; si hacen falta iniciarlos en terminal Orca separada, conservarlos y reportar handles.
- Usar postman:api-testing para comprobaciones HTTP; api-engineer si cambia contrato de pruebas. UI: MASTER.md, ui-ux-pro-max y skills pertinentes para auditar accesibilidad, sin rediseño.
- Producción comparte Supabase remoto: separar pruebas de solo lectura, pruebas con fixtures autorizados y pruebas destructivas en entorno aislado.

## Cuentas y correo

Actualización de esta sesión: el usuario autorizó un correo de prueba a **jpena13@ujap.edu.ve**. Codex ya ejecutó UNA solicitud `resetPasswordForEmail` con redirectTo `https://lendit-ujap.vercel.app/login`; Supabase respondió sin error. Recepción todavía NO confirmada. No repetir el envío ni cambiar la contraseña de esta cuenta; esperar confirmación del usuario. La autorización puntual de envío no autoriza cambiar perfil, clave ni rol. Esta actualización sustituye únicamente la falta de destinatario mencionada abajo.

Actualización posterior: el usuario NO tiene acceso a jpena13@ujap.edu.ve y proporcionó **jesusp2095@gmail.com** para comprobar recepción. Codex ya ejecutó UNA solicitud `resetPasswordForEmail` hacia ese Gmail con redirectTo `https://lendit-ujap.vercel.app/admin/login`; Supabase respondió sin error. Recepción pendiente de confirmación humana. No volver a enviar a ninguno de los dos ni cambiar la contraseña del administrador. No crear otra cuenta Gmail: ya existe la administrativa. Esta prueba solo confirma aceptación de solicitud hasta recibir evidencia de entrega.

- Fixtures autorizados existentes: estudiante@ujap.edu.ve y docente.qa@ujap.edu.ve. Secretos en .env ignorado; no imprimir valores, tokens, URLs de recuperación/confirmación completas ni incluirlos en archivos versionables/capturas. No crear tokens que suplanten sesiones personales.
- No cambiar contraseña, rol, perfil ni sesión de jesusp2095@gmail.com, jpena@ujap.edu.ve, jpena13@ujap.edu.ve ni de ningún ADMIN. No degradar el único admin real. Test del último admin ya cerrado en scripts/qa-last-admin.ts con PostgreSQL efímero; no volver a usar la BD compartida para pruebas destructivas de admin.
- El usuario autoriza probar envío de confirmación/recuperación, pero aún NO ha indicado un buzón receptor controlado para este QA. No enviar a terceros ni a direcciones inventadas/sintéticas del dominio UJAP. Esperar un destinatario confirmado para envíos reales; continuar en paralelo inspección y pruebas con servidor SMTP/identidad aislados cuando sea necesario.
- Si no hay buzón autorizado accesible, marcar recepción real BLOQUEADA por falta de destinatario/evidencia. Una respuesta 200 de Supabase, una URL generada por admin o email_confirm:true NO demuestran entrega ni recorrido desde correo real. No eludir confirmación para declarar exitoso un registro.
- Al obtener destinatario controlado, limitar envíos reales (uno por escenario, sin bucles) y registrar resultado sin secretos. Recibir prueba del usuario o buzón autorizado para confirmar recepción; no pedir contraseña de correo. No alterar configuración de Supabase/SMTP, confirmación de email ni redirect allowlist sin describir el cambio requerido y coordinación con usuario.

## Matriz prioritaria

1. Registro estudiante y solicitud docente: validaciones, escuela/carrera coherentes, foto obligatoria y persistencia tras confirmación, duplicados, password inválida, errores de servidor y móvil/teclado.
2. Confirmación de correo: comprobar si Supabase exige confirmación en este proyecto (solo si hay evidencia de configuración o registro real); llamada signUp, emailRedirectTo, APP_URL/Site URL/allowlist, callback de producción, sesión tras click, feedback y reenvío con cooldown. Probar enlace inválido/caducado/usado sin suplantar la validación.
3. Recuperación autoservicio desde login público y admin: ¿hay enlace/formulario? resetPasswordForEmail, respuesta neutra para correo existente/inexistente, redirect específico, evento PASSWORD_RECOVERY o callback PKCE, formulario nueva contraseña/confirmación, updateUser, fortaleza/errores y feedback, enlace expirado/usado/cancelación. Probar contraseña anterior rechazada y nueva aceptada SOLO sobre fixture aislado/autorizado; preservar o actualizar secreto QA en .env si procede, nunca cuentas personales. No tratar 'admin solicitó correo' como recuperación completa.
4. Login estudiante/profesor/admin: modo correcto, error de credenciales, no confirmado/desactivado, rol, rutas de destino, persistencia/recarga, logout, refresh token inválido/expirado, errores de red/API y ninguna pantalla colgada. Verificar que no hay sesión fantasma después de fallo en /api/me.
5. Cambio de contraseña desde cuenta si existe, reautenticación y cierre de sesiones como requisitos a evaluar; no prometer capacidades que el proveedor/configuración no demuestra.
6. Smoke de regresión con fixtures: catálogo y filtros, crear/editar publicación con varias imágenes, solicitudes y audiencias, préstamo/alquiler simulado, chat y devolución. Acreditación docente pendiente/aprobada y credenciales privadas. Comparar con evidencia previa para enfocar trabajo; no repetir toda la suite si no aporta cobertura nueva.
7. Administración: navegación por permisos y negativos HTTP sin mutaciones a cuentas personales; los recorridos que requieran sesión administrativa de usuario se marcan bloqueados si no está disponible. No pedir clave personal.
8. Producción: /api/health 200, protegidos sin sesión 401 JSON, rutas anidadas, callback recargable, frontend/API/Supabase en mismo proyecto y variables presentes por nombre (jamás valores privados), errores controlados. El build y la recepción de correo son evidencias diferentes.

## Pruebas y hallazgos

- Empezar por inventario de rutas y código. Hallazgo preliminar: src/stores/auth.ts solo maneja SIGNED_IN/INITIAL_SESSION/TOKEN_REFRESHED/SIGNED_OUT; no aparece PASSWORD_RECOVERY ni resetPasswordForEmail público. backend/users/[id]/reset-password.ts existe pero redirige a APP_URL. Confirmar y documentar, no asumir flujo terminado.
- Antes de tocar fixtures, identificar por IDs y conservar estado de referencia. Añadir pruebas reproducibles apropiadas y pequeñas. Fixtures nuevas solo en local/aislado; altas reales con correo únicamente cuando haya buzón autorizado.
- Diferenciar PASS, FAIL, BLOQUEADO, NO IMPLEMENTADO y NO EJECUTADO. Registrar fecha, entorno, rol, pasos, comportamiento esperado/real, status HTTP, causa si verificada, evidencia local sin datos sensibles y propuesta concreta.
- Priorización P0/P1/P2 con impacto real: bloquea acceso/recuperación, pérdida de datos/permisos, confusión/estética. No clasificar automáticamente toda carencia como crítica.
- No corregir producto a ciegas: entregar primero el inventario y pruebas. Se permiten scripts/tests y documentación; si una deficiencia impide el resto, documentar y continuar casos independientes. No hacer commit/push/deploy ni instalar servicios/dependencias nuevas por iniciativa.
- No iniciar MongoDB/NoSQL hoy. Cerrar con lista de correcciones ordenada, separando cambios de código, configuración Supabase/SMTP y pasos humanos inevitables para recepción de correo.

## Entrega

Crear docs/auth-functional-qa-report.md y, si hacen falta, pruebas versionables bajo scripts/ o server/; capturas bajo output/ sin secretos. Habilitar excepciones mínimas .gitignore para estos dos md. Incluir resultados reales, cobertura pendiente, fixtures creados/conservados/limpiados y comandos para repetir. Indicar qué se pudo comprobar hoy, sin promesas de cobertura 100% ni recepción inferida.
