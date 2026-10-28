# Integración y verificación conjunta — 2026-10-26

Revisión de Codex posterior a las entregas paralelas A/B/C. Este documento prevalece sobre sus cifras históricas para esta revisión; no implica despliegue ni commit.

## Correcciones integradas

- Recuperación: suscripción a los eventos de Supabase antes de leer/sincronizar la sesión inicial. La autorización se vincula al auth user ID de PASSWORD_RECOVERY y se verifica con getSession/getUser antes de guardar. No se activa por escribir type=recovery en la URL ni por tener una sesión ordinaria.
- El SDK consume los códigos/tokens de callback; la vista no vuelve a intercambiarlos en paralelo con detectSessionInUrl.
- Un SIGNED_IN repetido de la misma cuenta (por ejemplo al recuperar foco) ya no cancela una recuperación legítima. Otra identidad, salir de la ruta, cerrar sesión o finalizar el cambio elimina el estado de recuperación.
- El envío de cambio de clave tiene protección contra peticiones concurrentes. Se cierra solamente la sesión local del flujo al completar; la UI no promete revocaciones globales.
- Confirmación: se consulta al proveedor la identidad y su email_confirmed_at y se exige sincronización del perfil antes de mostrar éxito. Se retiró la afirmación de que confirmar correo equivale a verificar identidad universitaria/carnet.
- Seguridad de cuenta: reautenticación en cliente separado, comprobación de ID/email y limpieza explícita scope local. Local sí puede invocar logout del proveedor para esa sesión; no significa ausencia de red, pero evita el logout global del cliente temporal.
- Foto: se distinguen el ID de auth.users y el ID de public.User. Se conserva temporalmente por identidad, se restaura sin sobrescribir foto existente y se comprueba la coherencia del perfil retornado. Pruebas con ambos UUID distintos.

## Resultados automatizados

| Comando | Resultado observado |
| --- | --- |
| `pnpm test --run` | 10 archivos, 105 pruebas aprobadas, salida 0 |
| `pnpm test:api` | 22 casos Supertest con PostgreSQL temporal aprobados, salida 0 |
| `pnpm build` | vue-tsc, tsc API y Vite completados, salida 0; advertencia existente de bundle grande |

Estas suites incluyen respuestas simuladas del proveedor en las pruebas unitarias. No prueban por sí solas entrega de correo, políticas del panel Supabase o un despliegue remoto. Supertest conserva su informe en output/qa-api/.

## Verificaciones reales con Supabase y Orca Browser

Entorno local: localhost:5173 y API localhost:8787 contra Supabase del proyecto. Navegador en perfil aislado «Integracion Auth QA». Solo cuenta existente estudiante@ujap.edu.ve; no se modificaron cuentas personales ni ADMIN.

| Escenario | Resultado |
| --- | --- |
| Pantalla de reset sin sesión/enlace | Bloqueada con explicación y acción de solicitar enlace |
| Sesión ordinaria intentando entrar a reset | Bloqueada; no se presenta formulario de nueva clave |
| Callback con sesión de recuperación real verificada por Supabase | Abre formulario de nueva contraseña |
| Guardar nueva clave desde formulario local | UI de éxito; contraseña anterior rechazada y temporal aceptada por Supabase |
| Login con nueva clave | Permite acceder a Mi cuenta con el fixture |
| Cambiar clave desde /cuenta/seguridad, verificando clave actual | UI de éxito; se restauró la contraseña original del fixture usando ese mismo formulario |
| Verificación posterior de credenciales | Original aceptada, temporal rechazada |
| Restauración del servicio de foto con identidad real | Guardado de borrador, subida de JPEG sintético a Storage, PATCH del perfil, lectura de persistencia y eliminación del borrador: correctos |

El callback del fixture se preparó con generateLink + verifyOtp del proveedor, sin enviar correo. Se verificó el formulario y la autenticación reales, pero esto NO demuestra recorrido desde un email recibido por el fixture. La entrega a Gmail del usuario fue confirmada por él en una prueba anterior separada.

La prueba de foto ejecutó el servicio de integración desde la página autenticada; no fue un registro nuevo de principio a fin. Se conservó el perfil original y se eliminó la imagen sintética después de comprobar persistencia. Se usó envío del formulario mediante DOM requestSubmit en Orca Browser; no se simula evidencia de una prueba manual independiente.

## Limpieza y límites pendientes

- Contraseña original del estudiante de prueba restaurada y comprobada.
- Foto original conservada/restaurada; imagen sintética y borrador eliminados.
- Archivo privado temporal de sesión/credenciales eliminado. No incluir enlaces/tokens de recuperación en evidencias.
- Pendiente registro nuevo → correo en buzón institucional accesible → confirmación → primer acceso con foto. No usar la cuenta retirada jpena13 ni cambiar política de confirmación para eludir esta prueba.
- Pendiente revisar allowlist de Supabase para `/auth/reset-password` y `/auth/confirmacion` en los orígenes de desarrollo/producción. No se cambió la configuración remota.
- Los cambios están locales; hace falta revisión de diff, commit y validación del despliegue antes de afirmar que estas pantallas funcionan en producción.
- Advertencia existente de tamaño del bundle frontend y deprecación de concurrencia en pg durante pruebas: no equivalen a fallos de estas aserciones, pero siguen siendo trabajo de mantenimiento.
