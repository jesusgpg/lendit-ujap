<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { push } from 'notivue'
import { getSupabaseClient } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { verifyRecoverySession } from '../lib/authCallbacks'
import {
  isUnauthenticatedRecoveryAttempt,
  parseAuthCallbackParams,
  validatePasswordConfirmation,
} from '../lib/authRecovery'
import AuthPageShell from '../components/AuthPageShell.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successCompleted = ref(false)

// Estados de validación del enlace
const isCheckingSession = ref(true)
const linkError = ref<string | null>(null)
const hasRecoveryAccess = ref(false)

async function checkAccess() {
  isCheckingSession.value = true
  linkError.value = null

  try {
    const fullLocation = typeof window !== 'undefined'
      ? window.location.href
      : ''
    const callbackData = parseAuthCallbackParams(fullLocation)

    if (!callbackData.errorCode && (route.query.error || route.query.error_code)) {
      callbackData.errorCode = String(route.query.error_code || route.query.error)
      callbackData.errorDescription = route.query.error_description ? String(route.query.error_description) : null
    }

    // 1. Error explícito reportado por el proveedor de autenticación
    if (callbackData.errorCode) {
      if (callbackData.errorCode.includes('expired') || callbackData.errorCode === 'otp_expired') {
        linkError.value = 'El enlace de recuperación ha expirado. Por seguridad, solicita uno nuevo.'
      } else {
        linkError.value = callbackData.errorDescription || 'El enlace de recuperación es inválido o ya fue utilizado.'
      }
      hasRecoveryAccess.value = false
      isCheckingSession.value = false
      return
    }

    // 2. Intento declarativo sin token (ej. usuario escribe a mano #type=recovery sin access_token ni PKCE code)
    if (isUnauthenticatedRecoveryAttempt(callbackData)) {
      linkError.value = 'Intento de recuperación no autenticado. Se requiere el enlace auténtico enviado a tu correo.'
      hasRecoveryAccess.value = false
      isCheckingSession.value = false
      return
    }

    const supabase = getSupabaseClient()

    // Supabase owns code/token consumption during initialization. Re-exchanging
    // a code here races with detectSessionInUrl and may consume a valid link twice.
    // 5. Esperar procesamiento del evento PASSWORD_RECOVERY del SDK si está en tránsito
    if (!authStore.isPasswordRecoveryActive) {
      await new Promise((r) => setTimeout(r, 350))
    }

    // 6. Validación de guardia estricta:
    // Si NO se activó el estado de recuperación, rechazar; si hay una sesión ordinaria,
    // advertir explícitamente que una sesión normal no autoriza el cambio sin reautenticación.
    if (!authStore.isPasswordRecoveryActive) {
      const { data: currentSession } = await supabase.auth.getSession()
      if (currentSession?.session) {
        linkError.value = 'Esta pantalla es exclusiva para restablecimiento de contraseña mediante el enlace enviado a tu correo. Tu sesión ordinaria no autoriza el cambio de clave por esta vía.'
      } else {
        linkError.value = 'No se encontró una sesión de recuperación activa. El enlace puede haber expirado o ya haber sido utilizado.'
      }
      hasRecoveryAccess.value = false
      isCheckingSession.value = false
      return
    }

    await verifyRecoverySession(supabase, authStore.passwordRecoveryUserId)
    hasRecoveryAccess.value = true
    linkError.value = null
  } catch {
    linkError.value = 'No se pudo verificar el enlace de recuperación.'
    hasRecoveryAccess.value = false
  } finally {
    isCheckingSession.value = false
  }
}

onMounted(checkAccess)
onUnmounted(() => authStore.clearPasswordRecoveryState())
watch([() => route.hash, () => route.query], checkAccess)

const destinationRoute = ref(authStore.isAdmin ? '/admin/login' : '/login')

async function handleSubmit() {
  errorMessage.value = ''

  // Guardia de ejecución en backend y frontend
  if (!authStore.isPasswordRecoveryActive || !hasRecoveryAccess.value) {
    errorMessage.value = 'La sesión de recuperación no es válida o ya fue utilizada.'
    linkError.value = errorMessage.value
    hasRecoveryAccess.value = false
    return
  }

  const validation = validatePasswordConfirmation(password.value, confirmPassword.value)
  if (!validation.valid) {
    errorMessage.value = validation.error ?? 'La contraseña no es válida.'
    return
  }

  isSubmitting.value = true
  destinationRoute.value = authStore.isAdmin ? '/admin/login' : '/login'

  try {
    const result = await authStore.updatePassword(password.value)
    if (!result.ok) {
      errorMessage.value = result.error ?? 'No se pudo actualizar la contraseña.'
      push.error({ title: 'Error', message: errorMessage.value })
      return
    }

    // Invalidar inmediatamente el acceso local para evitar doble consumo
    hasRecoveryAccess.value = false
    successCompleted.value = true
    push.success({
      title: 'Contraseña actualizada',
      message: 'Tu contraseña se cambió con éxito. Inicia sesión con tu nueva clave.',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado al guardar la clave.'
    errorMessage.value = msg
    push.error({ title: 'Error', message: msg })
  } finally {
    isSubmitting.value = false
  }
}

function goToLogin() {
  void router.replace(destinationRoute.value)
}

function goToRequestNewLink() {
  void router.push('/recuperar-contrasena')
}
</script>

<template>
  <AuthPageShell
    eyebrow="Seguridad de la cuenta / LendIt"
    title="Crea tu nueva contraseña."
    description="Establece una clave segura para proteger tus publicaciones, préstamos e intercambios en el campus."
    note="La contraseña debe tener un mínimo de 6 caracteres."
    card-kicker="Paso final"
    card-title="Restablecer clave"
    card-label="Formulario de nueva contraseña"
  >
    <div class="reset-view">
      <!-- 1. Estado de carga inicial verificando enlace -->
      <div v-if="isCheckingSession" class="reset-view__status">
        <p class="reset-view__desc">Verificando enlace de recuperación…</p>
      </div>

      <!-- 2. Enlace inválido, caducado o sin sesión de recuperación -->
      <div v-else-if="linkError" class="reset-view__error-card" role="alert">
        <div class="reset-view__icon-wrap reset-view__icon-wrap--error">
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 class="reset-view__heading">Enlace no disponible</h3>
        <p class="reset-view__desc">{{ linkError }}</p>
        <div class="reset-view__actions">
          <button class="btn btn--primary" type="button" @click="goToRequestNewLink">
            Solicitar nuevo enlace
          </button>
          <button class="btn btn--ghost" type="button" @click="goToLogin">
            Volver a iniciar sesión
          </button>
        </div>
      </div>

      <!-- 3. Éxito al actualizar contraseña -->
      <div v-else-if="successCompleted" class="reset-view__success" role="status">
        <div class="reset-view__icon-wrap reset-view__icon-wrap--success">
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h3 class="reset-view__heading">¡Contraseña actualizada!</h3>
        <p class="reset-view__desc">
          Tu nueva clave se guardó correctamente. Inicia sesión con tus nuevas credenciales.
        </p>
        <div class="reset-view__actions">
          <button class="btn btn--primary" type="button" @click="goToLogin">
            Iniciar sesión ahora
          </button>
        </div>
      </div>

      <!-- 4. Formulario de cambio de contraseña -->
      <form v-else-if="hasRecoveryAccess" class="auth-form" novalidate @submit.prevent="handleSubmit">
        <p class="auth-form__hint">
          Escribe tu nueva contraseña y confírmala para completar la recuperación.
        </p>

        <label class="field">
          <span>Nueva contraseña</span>
          <div class="field__password-control">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Mínimo 6 caracteres"
              autocomplete="new-password"
              required
              minlength="6"
              :disabled="isSubmitting"
            />
            <button
              type="button"
              class="field__pw-toggle"
              :aria-label="showPassword ? 'Ocultar contraseña' : 'Ver contraseña en texto'"
              @click="showPassword = !showPassword"
            >
              <svg v-if="!showPassword" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg v-else aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <line x1="2" x2="22" y1="2" y2="22" />
              </svg>
            </button>
          </div>
        </label>

        <label class="field">
          <span>Confirmar contraseña</span>
          <div class="field__password-control">
            <input
              v-model="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              placeholder="Repite la contraseña"
              autocomplete="new-password"
              required
              minlength="6"
              :disabled="isSubmitting"
            />
            <button
              type="button"
              class="field__pw-toggle"
              :aria-label="showConfirmPassword ? 'Ocultar confirmación' : 'Ver confirmación en texto'"
              @click="showConfirmPassword = !showConfirmPassword"
            >
              <svg v-if="!showConfirmPassword" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg v-else aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <line x1="2" x2="22" y1="2" y2="22" />
              </svg>
            </button>
          </div>
        </label>

        <p v-if="errorMessage" class="auth-form__error" role="alert">{{ errorMessage }}</p>

        <button
          class="btn btn--primary auth-form__submit"
          type="submit"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? 'Guardando contraseña…' : 'Guardar nueva contraseña' }}
        </button>

        <p class="auth-form__switch">
          <button type="button" class="auth-form__link" @click="goToLogin">
            Cancelar y volver
          </button>
        </p>
      </form>
    </div>
  </AuthPageShell>
</template>

<style scoped>
.reset-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reset-view__status {
  padding: 24px 0;
  text-align: center;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.auth-form__hint {
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink-faint);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-soft);
}

.field input {
  font: inherit;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field input:focus {
  outline: none;
  border-color: var(--crimson);
  box-shadow: 0 0 0 3px var(--crimson-bg);
}

.field__password-control {
  position: relative;
  display: flex;
  align-items: center;
}

.field__password-control input {
  width: 100%;
  padding-right: 44px;
}

.field__pw-toggle {
  position: absolute;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-faint);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.field__pw-toggle:hover {
  color: var(--crimson);
  background: var(--crimson-bg);
}

.auth-form__error {
  font-size: 13px;
  color: var(--crimson-dark);
  background: var(--crimson-bg);
  padding: 8px 12px;
  border-radius: 8px;
  border-left: 3px solid var(--crimson-dark);
}

.auth-form__submit {
  width: 100%;
  margin-top: 4px;
}

.auth-form__switch {
  text-align: center;
  font-size: 13.5px;
  color: var(--ink-faint);
  margin: 0;
}

.auth-form__link {
  background: transparent;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: var(--crimson-dark);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.15s ease;
}

.auth-form__link:hover {
  color: var(--crimson);
}

.reset-view__error-card,
.reset-view__success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 12px 0;
}

.reset-view__icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  margin-bottom: 4px;
}

.reset-view__icon-wrap--error {
  background: var(--crimson-bg);
  color: var(--crimson-dark);
}

.reset-view__icon-wrap--success {
  background: var(--navy-bg, rgba(27, 54, 93, 0.08));
  color: var(--navy);
}

.reset-view__heading {
  font: 500 22px/1.2 var(--display);
  color: var(--ink);
  margin: 0;
}

.reset-view__desc {
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--ink-soft);
  margin: 0;
}

.reset-view__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  margin-top: 8px;
}
</style>
