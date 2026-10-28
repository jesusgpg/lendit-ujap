# Entrega de Implementación: Recuperación, Confirmación y Auth Compartido (Agente A)

**Fecha:** 2026-10-26  
**Agente:** Agente A (Recuperación de contraseña, confirmación de correo y arquitectura compartida de autenticación)  
**Rama:** `fix/users-login`  

---

## 1. Resumen Ejecutivo y Correcciones de la Revisión

Tras la retroalimentación de la primera entrega, se implementaron las siguientes correcciones de seguridad, autorización y robustez:

1. **Guardia Estricta de Autorización en `/auth/reset-password` (`ResetPasswordView.vue`):**
   * **Rechazo de sesiones ordinarias:** Ya no se confunde una sesión iniciada normalmente (`sessionData.session`) con una sesión autorizada de recuperación. Si un usuario con sesión normal ingresa a `/auth/reset-password`, se le rechaza explícitamente: *"Esta pantalla es exclusiva para restablecimiento de contraseña mediante el enlace enviado a tu correo. Tu sesión ordinaria no autoriza el cambio de clave por esta vía."*
   * **Bloqueo de manipulación declarativa:** Se detectan y rechazan URLs adulteradas con `#type=recovery` que carecen de tokens de acceso o de código PKCE mediante `isUnauthenticatedRecoveryAttempt()`.
   * **Manejo real de flujos PKCE e Implicit:** Se intercambia el parámetro `code` vía `supabase.auth.exchangeCodeForSession(code)` o se establece la sesión con `supabase.auth.setSession(...)` únicamente cuando los tokens de recuperación están presentes.
   * **Espera del evento `PASSWORD_RECOVERY`:** Se aguarda el evento genuino emitido por el SDK de Supabase antes de habilitar el formulario.
   * **Guardia en `handleSubmit`:** El manejador de envío verifica tanto `authStore.isPasswordRecoveryActive` como `hasRecoveryAccess.value`, impidiendo cualquier invocación manipulada por la UI o desde consola.

2. **Protección en el Store de Autenticación (`src/stores/auth.ts`):**
   * `updatePassword()` verifica obligatoriamente `this.isPasswordRecoveryActive === true`. Si no lo está, retorna `{ ok: false, error: 'No tienes una sesión de recuperación de contraseña autorizada.' }`.
   * **Prevención de doble consumo:** Al completarse exitosamente la actualización de la contraseña, el store desactiva de inmediato `isPasswordRecoveryActive = false` y ejecuta `supabase.auth.signOut()`, cerrando la sesión temporal de recuperación para exigir inicio de sesión limpio con la nueva clave. Cualquier segundo llamado inmediato es bloqueado.
   * Se añadió la acción `clearPasswordRecoveryState()` para limpiar el estado al salir de la pantalla.

3. **Ampliación de Cobertura de Pruebas Unitarias:**
   * Se agregaron pruebas específicas para sesiones ordinarias rechazadas, manipulación declarativa rechazada, callbacks válidos con tokens/PKCE aceptados, actualización autorizada y bloqueo por doble consumo.

---

## 2. Archivos Implementados y Propiedad Exclusiva

En estricto cumplimiento del alcance y las fronteras de archivos definidas en `docs/auth-parallel-implementation-brief.md`:

### Archivos Modificados / Creados por Agente A
1. [`src/lib/authRecovery.ts`](file:///C:/Users/jpena/Documents/Proyectos%20Personales/lendit-ujap/src/lib/authRecovery.ts): Utilidades puras para parseo de hash/query de Supabase Auth, detección de intentos no autenticados (`isUnauthenticatedRecoveryAttempt`), validación de callbacks legítimos (`isLegitimateRecoveryCallback`), validación de contraseñas (6–72 caracteres, coincidencia), unión segura de URLs (`safeJoinUrl`), cooldown reactivo (60s con fallback a memoria) y resolución de rutas post-auth por rol.
2. [`src/lib/authRecovery.spec.ts`](file:///C:/Users/jpena/Documents/Proyectos%20Personales/lendit-ujap/src/lib/authRecovery.spec.ts): Suite unitaria con **25 pruebas automatizadas aprobadas** que cubren parseo de tokens, detección de intentos espurios, PKCE, expiración y cooldowns.
3. [`src/views/RecoveryRequestView.vue`](file:///C:/Users/jpena/Documents/Proyectos%20Personales/lendit-ujap/src/views/RecoveryRequestView.vue): Vista `/recuperar-contrasena` con selector institucional (`@ujap.edu.ve`) y administrativo (`?mode=admin`), feedback neutro anti-enumeración ("Si la cuenta existe en LendIt, enviamos las instrucciones...") y botón de reenvío con temporizador de cooldown visible.
4. [`src/views/ResetPasswordView.vue`](file:///C:/Users/jpena/Documents/Proyectos%20Personales/lendit-ujap/src/views/ResetPasswordView.vue): Vista `/auth/reset-password` con guardia estricta, intercambio PKCE, detección de `#error_code=otp_expired`, rechazo de sesiones ordinarias y doble consumo bloqueado.
5. [`src/views/EmailConfirmationView.vue`](file:///C:/Users/jpena/Documents/Proyectos%20Personales/lendit-ujap/src/views/EmailConfirmationView.vue): Vista `/auth/confirmacion` para procesar la verificación entrante de correo, sincronizar el perfil con `/api/me`, y proveer formulario de reenvío de correo con cooldown para buzones `@ujap.edu.ve`.
6. [`src/components/LoginForm.vue`](file:///C:/Users/jpena/Documents/Proyectos%20Personales/lendit-ujap/src/components/LoginForm.vue): Incorporación del enlace accesible "¿Olvidaste tu contraseña?" tanto en el acceso institucional como en el acceso administrativo hacia `/recuperar-contrasena`.
7. [`src/router/index.ts`](file:///C:/Users/jpena/Documents/Proyectos%20Personales/lendit-ujap/src/router/index.ts): Registro de las rutas `/recuperar-contrasena`, `/auth/reset-password` y `/auth/confirmacion`. Reserva explícita de la sección `/cuenta/seguridad` en el regex de la ruta de cuenta para el Agente B:
   ```ts
   path: '/cuenta/:section(perfil|carnet|acreditacion|preferencias|seguridad)'
   ```
8. [`src/stores/auth.ts`](file:///C:/Users/jpena/Documents/Proyectos%20Personales/lendit-ujap/src/stores/auth.ts):
   * Manejador del evento `PASSWORD_RECOVERY` en `onAuthStateChange` activando `isPasswordRecoveryActive`.
   * Guardia en `updatePassword()` que exige `isPasswordRecoveryActive === true`, limpia la bandera y cierra la sesión de recuperación.
   * Acción `clearPasswordRecoveryState()`.
   * Parámetro `emailRedirectTo: `${origin}/auth/confirmacion`` configurado en `auth.register()`.
   * Integración del servicio de foto de registro de Agente C: guarda foto pendiente si `requiresEmailConfirmation` es `true` y la restaura en `syncProfile` si el perfil carece de foto.
9. [`src/stores/auth.spec.ts`](file:///C:/Users/jpena/Documents/Proyectos%20Personales/lendit-ujap/src/stores/auth.spec.ts): Suite unitaria con **14 pruebas automatizadas** que validan el store, reglas de correo, rate limits, guardia de recuperación y bloqueo de doble consumo.
10. [`backend/users/[id]/reset-password.ts`](file:///C:/Users/jpena/Documents/Proyectos%20Personales/lendit-ujap/backend/users/[id]/reset-password.ts): Construcción segura de URL de redirección:
   ```ts
   const baseUrl = process.env.APP_URL || 'http://localhost:5173'
   const resetRedirectUrl = new URL('/auth/reset-password', baseUrl).toString()
   ```

---

## 3. Límites y Archivos Respetados

* **Archivos de Agente B (Intactos por Agente A):**
  * `src/views/AccountView.vue` (NO modificado; la sección `/cuenta/seguridad` fue reservada en el router para que B la use libremente).
  * `src/components/AccountSecurityPanel.vue` (Propiedad exclusiva de B).
  * `src/lib/accountPassword.ts` / `.spec.ts` (Propiedad exclusiva de B).
* **Archivos de Agente C (Intactos por Agente A):**
  * `src/components/RegisterForm.vue` (NO modificado).
  * `src/components/PhotoDropzone.vue` (NO modificado).
  * `src/lib/pendingRegistrationPhoto.ts` (Integrado como consumidor a través del contrato fijado, sin alterar su implementación).
* **Archivos de infraestructura de pruebas y Codex (Intactos):**
  * `package.json` y `pnpm-lock.yaml` (No modificados).
  * `contracts/`, `scripts/generate-api-spec.mjs`, `scripts/run-api-tests.mjs`, `tests/api/`, `vitest.api.config.ts` (No tocados).
  * `.gitignore` (No modificado).
* **Seguridad de cuentas:**
  * No se repitió envío al correo personal del administrador `jesusp2095@gmail.com` ni se modificó su clave o rol.
  * No se utilizó la cuenta `jpena13@ujap.edu.ve`.

---

## 4. Verificación y Resultados de Pruebas

### 4.1. Pruebas Unitarias Vitest
```bash
$ pnpm test --run

 ✓ src/lib/authRecovery.spec.ts (25 tests) 34ms
 ✓ src/data/app.spec.ts (2 tests) 9ms
 ✓ backend/_lib/workflowRules.spec.ts (5 tests) 12ms
 ✓ src/lib/pendingRegistrationPhoto.spec.ts (19 tests) 144ms
 ✓ src/stores/articles.spec.ts (3 tests) 27ms
 ✓ src/lib/accountPassword.spec.ts (17 tests) 56ms
 ✓ src/stores/requests.spec.ts (2 tests) 28ms
 ✓ src/stores/auth.spec.ts (14 tests) 67ms
 ✓ server/api-routing.spec.ts (6 tests) 150ms

 Test Files  9 passed (9)
      Tests  93 passed (93)
   Duration  4.58s
```

### 4.2. Verificación de Tipos TypeScript y Vue
```bash
$ pnpm exec vue-tsc --noEmit
# Código de salida: 0 (0 errores)

$ pnpm exec tsc --noEmit
# Código de salida: 0 (0 errores)
```

---

## 5. Requerimientos de Configuración Externa (Allowlist Supabase)

Para el funcionamiento en producción y desarrollo sin cambios manuales imprevistos, Supabase Auth debe tener registradas las siguientes URLs en *Authentication -> URL Configuration -> Redirect URLs*:

* `http://localhost:5173/auth/reset-password`
* `http://localhost:5173/auth/confirmacion`
* `https://lendit-ujap.vercel.app/auth/reset-password`
* `https://lendit-ujap.vercel.app/auth/confirmacion`
* `https://lendit-ujap.vercel.app/admin/login`
