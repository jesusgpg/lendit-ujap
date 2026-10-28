# Registro nuevo con buz?n accesible ? 2026-10-27

## Alcance y estado

Prueba local contra Supabase real, solicitada por el usuario. Correo autorizado: jesusp2095@hotmail.com. No se encontr? esa identidad en Auth antes de iniciar la prueba. No usar ni modificar la cuenta administradora de Gmail.

- Frontend local de esta sesi?n: http://localhost:5174 (5173 pertenece a otro proyecto; no se detuvo).
- API local: http://localhost:8787.
- La cuenta usa nombre Registro Prueba QA, tel?fono sint?tico y avatar sint?tico QA. La clave aleatoria se conserva solo en .env ignorado.
- Antigravity implementa la excepci?n local expl?cita; no se ha autorizado excepci?n en producci?n.

## Pasos y evidencia pendiente

| Paso | Estado |
| --- | --- |
| Comprobar que el correo no existe en Auth | Comprobado por consulta administrativa de solo lectura |
| Configurar lista exacta local en frontend/API | Variables locales configuradas; implementaci?n en curso |
| Completar formulario y subir avatar QA | Preparado en Orca Browser; todav?a sin enviar |
| Registrar desde UI y comprobar confirmaci?n obligatoria | Pendiente |
| Recibir correo en Hotmail | Pendiente de env?o y confirmaci?n del usuario |
| Abrir enlace recibido y verificar destino local | Pendiente; no sustituir por generateLink ni autoconfirmaci?n |
| Primer ingreso, rol STUDENT y perfil acad?mico | Pendiente |
| Foto persistida en Storage y perfil, borrador eliminado | Pendiente |
| Cierre e ingreso posterior y acceso admin denegado | Pendiente |

No registrar tokens, enlaces privados ni claves en este informe. No afirmar entrega de correo solo por respuesta aceptada de Supabase. No hay commit, push ni despliegue de esta ronda.

## Resultado real de esta sesion

- Registro completado desde el formulario de Orca Browser con envio DOM requestSubmit. Foto subida por input file con archivo sintetico QA, sin usar datos personales reales de contacto.
- Supabase creo la cuenta y devolvio sesion inmediata. Consulta administrativa de solo lectura: email_confirmed_at presente y confirmation_sent_at ausente.
- GET publico /auth/v1/settings (apikey publica): mailer_autoconfirm=true. NO se modifico esa configuracion remota. NO se envio correo de confirmacion. La entrega a Hotmail no queda probada.
- Primer acceso /inicio correcto. /api/me devuelve 200, rol STUDENT, carrera Ingenieria en Computacion y photo persistida. /api/users devuelve 403 con la misma identidad.
- Logout desde auth store, login posterior desde formulario UI y regreso a /inicio correctos; foto y rol conservados.
- Compilacion pnpm build correcta; advertencia de bundle grande existente. 105 pruebas previas aprobadas y 17 nuevas de politica de correo aprobadas por Codex. Informe API de Antigravity: 31 aprobadas, 0 fallidas.
- Pendiente decision del usuario sobre activar confirmacion de correo para todos los nuevos registros del proyecto Supabase, incluyendo produccion. No usar generateLink, auto-confirmacion administrativa o reset de la cuenta para simular un correo recibido.
- La cuenta QA permanece creada y disponible solo mediante la excepcion local explicita. La clave se conserva en .env ignorado, sin publicarla.

## Cambio de configuracion remota autorizado

El usuario autorizo explicitamente activar confirmacion para nuevos registros e inicio sesion en Supabase Dashboard. Codex activo Confirm email y guardo el cambio. Verificacion independiente GET /auth/v1/settings: mailer_autoconfirm=false, status200. No cambia la confirmacion de las cuentas preexistentes.

Se corrigio Site URL de http://localhost:3000 a https://lendit-ujap.vercel.app y se guardaron seis redirect URLs exactas: /auth/confirmacion y /auth/reset-password para localhost:5173, localhost:5174 y el dominio de produccion. Se comprobaron las seis filas guardadas en Dashboard. Los cambios frontend actuales siguen sin desplegar.

Bloqueo encontrado antes de recrear la cuenta: Dashboard Emails / SMTP Settings muestra custom SMTP desactivado. La documentacion oficial https://supabase.com/docs/guides/auth/auth-smtp explica que el transporte incluido solo envia a miembros del equipo del proyecto. No se ha acreditado que el Hotmail de prueba sea miembro del equipo y no se intento entrega ni se elimino/recreo la cuenta. Falta configurar transporte propio para probar el registro con destinatarios generales. La cuenta Hotmail existente permanece intacta y ya confirmada.

## Proveedor de correo elegido

El usuario pidi? usar una alternativa gratuita. Se eligi? Gmail SMTP para mantener Supabase Auth como gestor de cuentas y confirmaci?n. En el panel de Supabase se abri? Enable custom SMTP y se rellenaron sender email/name, host smtp.gmail.com, puerto587 y username con la cuenta Gmail existente. Se dej? Password en blanco y los cambios SIN guardar: el usuario debe generar una contrase?a de aplicaci?n con 2-Step Verification activa y escribirla directamente en el campo Password del panel, sin compartirla. SMTP de Gmail es una elecci?n para pruebas/bajo volumen, no una garant?a de entrega de producci?n.
