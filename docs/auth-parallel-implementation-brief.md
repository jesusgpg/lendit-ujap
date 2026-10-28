# Implementación paralela de autenticación — 2026-10-26

El usuario autoriza avanzar en paralelo con Antigravity sobre los pendientes de autenticación, seguridad de cuenta y foto de registro. Tres trabajadores comparten checkout: respetar estrictamente la propiedad de archivos. No crear más agentes por iniciativa.

## Reglas comunes

- Leer AGENTS.md, design-system/lendit-ujap/MASTER.md, ui-ux-pro-max, design-taste-frontend (app screens) y emil-design-eng para UI. Preservar tokens, fuentes, temas, reduced-motion y flujos operativos. Sin nuevas dependencias ni cambios globales de estilo.
- Leer docs/auth-functional-qa-report.md críticamente: contiene hallazgos estáticos, no todas las afirmaciones son pruebas completas. El usuario YA confirmó recepción del correo de recuperación en jesusp2095@gmail.com. No hay bloqueo de entrega para ese Gmail. Queda demostrar recorrido de cambio de clave con fixture.
- NO repetir correos, cambiar contraseña/rol/perfil del ADMIN ni usar jpena13@ujap.edu.ve (retirada por el usuario). Solo fixtures QA autorizados para operaciones; secretos solo .env ignorado. No poner tokens/enlaces de recuperación privados en logs, capturas o documentación. Usar respuestas de proveedor simuladas para pruebas unitarias; distinguirlas de una entrega real.
- Cuenta real y Supabase remoto compartido: no alterar SMTP, allowlist, política de confirmación, DB ni roles por iniciativa. Documentar configuración requerida sin inventar valores ni límites. Si un enlace real falta, continuar pruebas independientes y marcar el caso pendiente.
- Solo Orca Browser; cada agente debe usar una pestaña/perfil propio sin cerrar ni desloguear las sesiones de otros. No iniciar otro servidor sobre un puerto ocupado. Preservar el servidor existente y cambios ajenos.
- Backend sigue en backend/, router server/app.ts, UNA función api/index.ts. Imports de servidor .js. No cambiar despliegue/arquitectura ni crear endpoints para operaciones que ya ofrece Supabase Auth.
- No tocar package.json, pnpm-lock.yaml, contracts/, scripts/generate-api-spec.mjs, scripts/run-api-tests.mjs, tests/api/ ni .gitignore. No commit/push/deploy. Reportes propios bajo tests/auth-deliveries/ para no competir ni depender de excepciones docs ignoradas.
- Ejecutar tests propios; al acabar build/typecheck si el árbol compartido lo permite. Registrar si un fallo pertenece a archivo de otro agente; no arreglarlo invadiendo propiedad. No declarar integración completa hasta prueba final conjunta.

## A — Recuperación, confirmación y archivos compartidos de auth

Propiedad exclusiva: src/stores/auth.ts, src/stores/auth.spec.ts, src/router/index.ts, src/main.ts, src/components/LoginForm.vue, src/views/LoginView.vue, src/views/AdminLoginView.vue, nuevas vistas RecoveryRequestView.vue, ResetPasswordView.vue, EmailConfirmationView.vue, src/lib/authRecovery.ts y sus tests, backend/users/[id]/reset-password.ts y tests propios del mismo flujo. Reporte tests/auth-deliveries/recovery.md.

Implementar:
1. Enlace «Olvidé mi contraseña» en ambos modos de login. Ruta /recuperar-contrasena con formulario institucional o admin según contexto, sin filtrar existencia de cuenta, feedback neutro y cooldown que no prometa protección de servidor inexistente.
2. Pantalla /auth/reset-password: procesar PASSWORD_RECOVERY y el mecanismo real de callback Supabase configurado (errores de hash/query/PKCE cuando corresponda); no confundir login ordinario con autorización de recuperación. Nueva clave y confirmación, validación coherente con política actual, estado de envío, error/caducidad/usado y enlace para solicitar otro. updateUser({password}) solo con sesión válida del flujo. No exponer tokens; evitar redirecciones abiertas y bucles de guards.
3. Confirmación/reenvío en /auth/confirmacion, emailRedirectTo de signup al origen correcto, cooldown y feedback. Tras confirmar mantener destino apropiado por rol/estado, incluido docente pendiente. No exigir un endpoint LendIt /api/register inexistente.
4. Reset administrativo apunta a APP_URL + /auth/reset-password con unión de URL segura; no localhost fijo en producción. Documentar allowlist necesaria (producción/local) sin cambiar panel Supabase.
5. Reservar sección /cuenta/seguridad en el regex de ruta de cuenta para el agente B. No editar AccountView.vue.
6. Integra servicio de foto del agente C SOLO después de que exista. A es único escritor del auth store: guardar foto pendiente únicamente cuando signup requiere confirmación y restaurar después de syncProfile de la misma identidad validada. No duplicar subidas ni mezclar cuentas. Si C aún no entrega, completar el resto y dejar integración detallada pendiente, sin stubs que simulen éxito.

Contrato con C: `storePendingRegistrationPhoto(email: string, dataUrl: string): Promise<void>`; `restorePendingRegistrationPhoto(email: string, profile: AuthUser): Promise<AuthUser | null>`; `clearPendingRegistrationPhoto(email: string): Promise<void>` en src/lib/pendingRegistrationPhoto.ts. restore devuelve perfil actualizado o null si no hay trabajo; nunca sobrescribe foto existente. Consultar tipos reales src/types. Tests: errores, callback válido/inválido/usado simulado, cooldown, destino por rol, sin correo/clave expuestos y casos de integración con helper C.

## B — Seguridad de Mi cuenta

Propiedad exclusiva: src/views/AccountView.vue, src/components/AccountSecurityPanel.vue, src/lib/accountPassword.ts, src/lib/accountPassword.spec.ts (y tests del componente si es viable sin dependencias). Reporte tests/auth-deliveries/account-security.md.

Añadir sección Seguridad en Mi cuenta para estudiante/profesor/admin, usando /cuenta/seguridad (A agregará la ruta). Formulario con clave actual, nueva y confirmación; etiquetas visibles, autocomplete adecuado, mostrar/ocultar individual, mensajes accesibles y estados de carga/error/éxito. Conservar todos los datos y secciones de perfil/carnet/acreditación/preferencias existentes.

Reautenticar con clave actual sin sustituir la sesión global ni generar eventos de otra cuenta (cliente temporal aislado si se usa signInWithPassword); solo después actualizar la clave del usuario actual con cliente principal. No almacenar claves, no imprimirlas ni enviarlas a un endpoint propio. Manejar error real del proveedor y sesión ausente. No afirmar revocación de todas las sesiones si no se implementó/verificó. Preservar política mínima coherente con actual y errores del proveedor.

No editar auth store, router, main.ts, LoginForm ni archivos de C. Si falta una acción compartida, describir integración al A en el reporte. Tests con proveedor simulado: mismatch no llama proveedor, clave actual inválida no actualiza, updateUser fallido no muestra éxito, doble envío bloqueado, éxito borra campos. No cambiar contraseña personal para probar.

## C — Foto pendiente y accesibilidad del registro

Propiedad exclusiva: src/lib/pendingRegistrationPhoto.ts, src/lib/pendingRegistrationPhoto.spec.ts, src/components/RegisterForm.vue, src/components/PhotoDropzone.vue (solo etiqueta contextual; preservar objetos/múltiples imágenes). Reporte tests/auth-deliveries/registration-photo.md.

Crear el servicio con el contrato anterior. Usar almacenamiento persistente de navegador por identidad/origen (preferiblemente IndexedDB) para sobrevivir al clic de confirmación en otra pestaña del mismo navegador. TTL y límite de tamaño; aviso claro en registro de conservación temporal. No guardar foto ni contraseña en metadata/JWT. Sin nuevas dependencias.

store valida imagen/tamaño y asocia correo normalizado. restore comprueba sesión real del mismo correo/usuario, perfil sin foto y confirmación antes de subir y PATCH /api/me. Usar utilidades existentes para Storage/API, no abrir endpoints nuevos. En fallo de red no perder la foto pendiente; en éxito borrar pendiente. Si ya hay foto, no sobrescribir y limpiar el pendiente adecuado. Aislar cuentas, evitar subidas duplicadas y purgar expirados; no prometer recuperación entre dispositivos/navegadores ni tras borrar datos del sitio.

Corregir el nombre accesible de carga de foto en RegisterForm. Si requiere prop nueva de PhotoDropzone, mantener default de objetos y multiimagen intactos. No modificar src/stores/auth.ts: A integrará esas llamadas. No añadir lógica de callback/reenvío en RegisterForm que compita con A; se puede enlazar a /auth/confirmacion y añadir ayuda de foto temporal.

Pruebas deterministas del servicio, sin Supabase remoto: cuenta distinta no sube, foto existente no sobrescribe, expiración elimina, error conserva borrador, éxito limpia y devuelve perfil, almacenamiento no disponible da feedback útil. Reportar limitaciones honestas.

## Validación conjunta posterior (no paralelizar sobre lo compartido)

Después de A/B/C: revisar diffs, conectar helper C desde A, verificar /cuenta/seguridad, pnpm test --run, pnpm test:api y pnpm build. Luego Orca Browser: registro → confirmación → primer login con foto; recuperación → nueva clave → login; cuenta → cambio clave; errores de enlace/sesión y regresiones por rol. Usar fixture y buzón autorizado, sin pedir la contraseña del correo ni tocar admin real. Solo entonces actualizar el informe global y decidir commit/deploy con el usuario.
