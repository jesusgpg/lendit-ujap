# Entrega Sección B — Seguridad de Cuenta: Cambio de Contraseña y Reautenticación Segura

- **Fecha:** 2026-10-26 (Actualizado tras revisión técnica)
- **Agente:** B (Seguridad de Cuenta)
- **Alcance de archivos propios:**
  - `src/views/AccountView.vue`
  - `src/components/AccountSecurityPanel.vue` (nuevo)
  - `src/lib/accountPassword.ts` (nuevo)
  - `src/lib/accountPassword.spec.ts` (nuevo)
  - `tests/auth-deliveries/account-security.md` (reporte)

---

## 1. Resumen de la revisión y corrección de hallazgos críticos

Durante la revisión técnica del flujo de reautenticación en `changeAccountPassword`, se detectaron y corrigieron tres riesgos de seguridad y estabilidad de sesión:

### Hallazgo 1: `signOut()` sin scope explícito en Supabase SDK (Riesgo de cierre de sesión global)
- **Causa:** En el SDK `@supabase/supabase-js` / `gotrue-js`, `auth.signOut()` tiene como valor por defecto `scope: 'global'`. Al invocarse sin opciones, el cliente envía una petición HTTP a `/auth/v1/logout?scope=global`, lo que revoca en el servidor Supabase la familia de tokens de actualización (*refresh token*) del usuario para todos sus navegadores y dispositivos activos.
- **Corrección:** Se configuró explícitamente `isolatedClient.auth.signOut({ scope: 'local' })`. El scope `local` instruye al SDK a limpiar únicamente el estado en memoria del cliente efímero, sin emitir ninguna llamada de revocación de tokens al backend de Supabase.

### Hallazgo 2: Orden de operaciones en el bloque `finally`
- **Causa:** La llamada previa a `signOut()` residía en un bloque `finally` interno inmediatamente posterior a `signInWithPassword`, ejecutándose *antes* de `mainClient.auth.updateUser`. Si dicha limpieza generaba efectos colaterales o si el token era revocado globalmente, dejaba la sesión principal en un estado vulnerable antes de persistir la nueva contraseña.
- **Corrección:** Se reestructuró el flujo para que `updateUser` se ejecute directamente tras la verificación exitosa, y la limpieza con `{ scope: 'local' }` se realice en el `finally` exterior tras completar todo el proceso, garantizando la conservación de la sesión activa en el cliente principal.

### Hallazgo 3: Validación incompleta de la respuesta de `signInWithPassword`
- **Causa:** El código asumía que la mera ausencia de `error` garantizaba que la autenticación correspondía exactamente a la misma identidad activa.
- **Corrección:** Se incorporó una validación estricta de correspondencia de identidad:
  ```ts
  if (
    !signInData?.user ||
    signInData.user.id !== activeUserId ||
    signInData.user.email?.toLowerCase() !== email.toLowerCase()
  ) {
    return {
      ok: false,
      error: 'La identidad verificada no coincide con el usuario de la sesión activa.',
    }
  }
  ```
  Si el identificador (`id`) o el correo devuelto difieren de la sesión activa, la operación se cancela de inmediato y no se llama a `updateUser`.

---

## 2. Arquitectura de seguridad e implementación (`src/lib/accountPassword.ts`)

1. **Cliente temporal aislado (`createIsolatedAuthClient`):**
   - `persistSession: false`.
   - `autoRefreshToken: false`.
   - `detectSessionInUrl: false`.
   - `storage` con métodos *no-op* (`getItem: () => null, setItem: () => {}, removeItem: () => {}`).
2. **Validación previa en cliente:**
   - Longitud mínima de 6 caracteres.
   - Nueva clave distinta a la actual.
   - Confirmación idéntica. Si hay discrepancia, se interrumpe de inmediato (*mismatch no llama proveedor*).
3. **Comprobación de sesión activa en cliente principal:**
   - Se valida `mainClient.auth.getSession()` antes de cualquier interacción con el cliente efímero.
4. **Reautenticación con validación de identidad:**
   - Invocación de `isolatedClient.auth.signInWithPassword({ email, password: currentPassword })`.
   - Verificación de identidad (`user.id` y `user.email`).
5. **Actualización segura y conservación de sesión:**
   - Invocación de `mainClient.auth.updateUser({ password: newPassword })`.
   - Limpieza garantizada con `signOut({ scope: 'local' })`.
   - La sesión principal (`mainClient`) nunca es cerrada (`mainClient.auth.signOut` no es llamado).
6. **Políticas de confidencialidad:**
   - No se almacenan contraseñas en memoria persistente, ni en `localStorage`, ni en variables reactivas globales.
   - Las contraseñas nunca se imprimen en consola ni en logs.
   - No se envían contraseñas a ningún endpoint propio no autorizado.

---

## 3. Componente de UI y Accesibilidad (`src/components/AccountSecurityPanel.vue`)

- **Campos del formulario:**
  1. Contraseña actual (`autocomplete="current-password"`).
  2. Nueva contraseña (`autocomplete="new-password"`).
  3. Confirmar nueva contraseña (`autocomplete="new-password"`).
- **Accesibilidad y feedback:**
  - `<label>` visibles y atributos `aria-describedby` para ayudas de validación.
  - Alertas accesibles con `role="alert"` (errores) y `role="status"` (éxito).
  - Botones independientes para mostrar/ocultar contraseñas (`aria-label`, `aria-pressed`, iconos SVG).
  - Protección de doble envío (`createPasswordChangeController`), `aria-busy` y controles deshabilitados durante el guardado.
  - Limpieza automática de campos tras éxito.
- **Cumplimiento de diseño:** Tokens Fraunces (`--display`) y Archivo (`--sans`), adaptabilidad móvil (targets >= 44px), modo daltónico y `prefers-reduced-motion`.

---

## 4. Integración en `src/views/AccountView.vue`

- Se integró la sección `seguridad` en la navegación lateral de Mi Cuenta (`/cuenta/seguridad`).
- Compatible con los tres perfiles: estudiante, profesor y administrador.
- Se preservaron íntegramente las secciones de perfil, carnet, acreditación y preferencias.
- La expresión regular de ruta en `src/router/index.ts` ya contiene `seguridad` (`:section(perfil|carnet|acreditacion|preferencias|seguridad)`), enlazada por el Agente A.

---

## 5. Pruebas Unitarias y Automatizadas (`src/lib/accountPassword.spec.ts`)

La suite cuenta con 17 pruebas deterministas (todas pasando) con verificación estricta de argumentos:

1. **Validaciones sintácticas y de reglas de negocio:**
   - Clave actual obligatoria.
   - Nueva clave obligatoria y longitud >= 6 caracteres.
   - Rechazo cuando la nueva clave es igual a la actual.
   - Confirmación requerida y rechazo por discrepancia.
2. **Aserciones de comportamiento y seguridad:**
   - `mismatch no llama proveedor`: discrepancia en confirmación no llama a ningún cliente.
   - `sesión ausente`: fallo ordenado si no hay sesión activa en el cliente principal.
   - `clave actual inválida no actualiza`: credenciales erróneas impiden la llamada a `updateUser` y ejecutan `signOut({ scope: 'local' })`.
   - `identidad devuelta`: rechaza si el `user.id` devuelto por el proveedor difiere del usuario activo.
   - `correo devuelto`: rechaza si el correo devuelto difiere del correo activo.
   - `usuario ausente en respuesta`: rechaza de forma segura si la respuesta no incluye datos de usuario.
   - `updateUser fallido`: traduce y propaga el error del proveedor sin emitir éxito falso.
   - `éxito con scope local y conservación de sesión`: verifica que `isolatedClient.auth.signOut` se llame estrictamente con `{ scope: 'local' }`, que NO se llame con `{ scope: 'global' }` ni sin argumentos, que `mainClient.auth.signOut` jamás se invoque y que la sesión activa se conserve intacta.
   - `doble envío bloqueado`: bloquea envíos simultáneos en el controlador.
   - `éxito borra campos`: limpia los valores del formulario mediante el callback `onSuccess`.

---

## 6. Estado de la Suite Global de Pruebas

- **`src/lib/accountPassword.spec.ts`:** **17/17 tests aprobados (100%)**.
- **`tests/api` (Supertest / OpenAPI):** **22/22 tests de integración aprobados**.
- **`pnpm vue-tsc --noEmit`:** **0 errores de tipado en todo el proyecto**.
- **Incidencia externa registrada (sin invadir archivos ajenos):**
  - En la suite global (`pnpm test --run`), falla 1 prueba perteneciente al archivo del **Agente A** (`src/stores/auth.spec.ts:104` en `updatePassword > rechaza contraseñas con menos de 6 caracteres`). La prueba espera un mensaje de longitud mínima, pero el store valida primero la existencia de la sesión de recuperación. De acuerdo con las reglas de aislamiento, no se modificaron archivos del Agente A.
