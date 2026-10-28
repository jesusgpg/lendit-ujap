<script setup lang="ts">
import { isEligibleCampusEmail } from '../lib/emailEligibility'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { push } from 'notivue'
import { getSupabaseClient } from '../lib/supabase'
import { verifyEmailConfirmation } from '../lib/authCallbacks'
import { useAuthStore } from '../stores/auth'
import { getCooldownRemaining, parseAuthCallbackParams, resolvePostAuthRoute, startCooldown } from '../lib/authRecovery'
import AuthPageShell from '../components/AuthPageShell.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const isChecking = ref(true)
const isConfirmed = ref(false)
const errorMessage = ref('')
const emailForResend = ref('')
const confirmationCode = ref('')
const confirmationError = ref('')
const resendError = ref('')
const resendSuccess = ref(false)
const isConfirming = ref(false)
const isResending = ref(false)
const cooldownSeconds = ref(0)
let timerId: number | null = null

const COOLDOWN_KEY = 'resend_email_confirmation'

function updateCooldown() {
  cooldownSeconds.value = getCooldownRemaining(COOLDOWN_KEY, 60)
  if (cooldownSeconds.value <= 0 && timerId !== null) {
    window.clearInterval(timerId)
    timerId = null
  }
}

async function checkConfirmation() {
  isChecking.value = true
  isConfirmed.value = false
  errorMessage.value = ''

  try {
    const fullLocation = typeof window !== 'undefined'
      ? window.location.href
      : ''
    const callbackData = parseAuthCallbackParams(fullLocation)

    if (!callbackData.errorCode && (route.query.error || route.query.error_code)) {
      callbackData.errorCode = String(route.query.error_code || route.query.error)
      callbackData.errorDescription = route.query.error_description ? String(route.query.error_description) : null
    }

    if (callbackData.errorCode) {
      if (callbackData.errorCode.includes('expired') || callbackData.errorCode === 'otp_expired') {
        errorMessage.value = 'El enlace anterior ya no es válido. Solicita un correo nuevo e ingresa el código de confirmación.'
      } else {
        errorMessage.value = callbackData.errorDescription || 'El enlace de confirmación es inválido o ya fue usado.'
      }
      return
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    if (data.session) {
      await verifyEmailConfirmation(supabase, session => authStore.syncProfile(session))
      isConfirmed.value = true
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo comprobar la confirmación del correo.'
  } finally {
    isChecking.value = false
  }
}

onMounted(() => {
  const queryEmail = typeof route.query.email === 'string' ? route.query.email : ''
  if (queryEmail && isEligibleCampusEmail(queryEmail)) {
    emailForResend.value = queryEmail
  }
  updateCooldown()
  if (cooldownSeconds.value > 0) {
    timerId = window.setInterval(updateCooldown, 1000)
  }
  void checkConfirmation()
})

watch([() => route.hash, () => route.query], () => {
  const queryEmail = typeof route.query.email === 'string' ? route.query.email : ''
  if (queryEmail && isEligibleCampusEmail(queryEmail)) {
    emailForResend.value = queryEmail
  }
  void checkConfirmation()
})

onUnmounted(() => {
  if (timerId !== null) {
    window.clearInterval(timerId)
  }
})

function continueToApp() {
  const destination = resolvePostAuthRoute(
    authStore.user?.role,
    authStore.user?.teacherVerification?.status,
  )
  void router.replace(destination)
}

async function handleConfirm() {
  confirmationError.value = ''
  resendError.value = ''
  resendSuccess.value = false

  const email = emailForResend.value.trim().toLowerCase()
  if (!isEligibleCampusEmail(email)) {
    resendError.value = 'Usa tu correo institucional (@ujap.edu.ve).'
    return
  }

  if (!confirmationCode.value.trim()) {
    confirmationError.value = 'Escribe el código que recibiste por correo.'
    return
  }

  isConfirming.value = true
  try {
    const result = await authStore.confirmSignupWithCode(email, confirmationCode.value)
    if (!result.ok) {
      confirmationError.value = result.error ?? 'No se pudo confirmar el correo.'
      push.error({ title: 'No se pudo confirmar', message: confirmationError.value })
      return
    }

    await verifyEmailConfirmation(getSupabaseClient(), session => authStore.syncProfile(session))
    isConfirmed.value = true
    push.success({ title: 'Correo confirmado', message: 'Tu cuenta ya está activa en LendIt.' })
  } catch (error) {
    confirmationError.value = error instanceof Error ? error.message : 'No se pudo comprobar la confirmación del correo.'
    push.error({ title: 'No se pudo confirmar', message: confirmationError.value })
  } finally {
    isConfirming.value = false
  }
}

async function handleResend() {
  resendError.value = ''
  resendSuccess.value = false
  confirmationError.value = ''

  const val = emailForResend.value.trim().toLowerCase()
  if (!isEligibleCampusEmail(val)) {
    resendError.value = 'Usa tu correo institucional (@ujap.edu.ve).'
    return
  }

  if (cooldownSeconds.value > 0) return

  isResending.value = true

  try {
    const result = await authStore.resendConfirmationEmail(val)
    if (!result.ok) {
      resendError.value = result.error ?? 'No se pudo reenviar el correo.'
      push.error({ title: 'Error', message: resendError.value })
      return
    }

    confirmationCode.value = ''
    startCooldown(COOLDOWN_KEY)
    updateCooldown()
    if (timerId === null) {
      timerId = window.setInterval(updateCooldown, 1000)
    }

    resendSuccess.value = true
    push.success({ title: 'Código enviado', message: 'Revisa tu bandeja de entrada o spam.' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado al reenviar.'
    resendError.value = msg
    push.error({ title: 'Error', message: msg })
  } finally {
    isResending.value = false
  }
}
</script>

<template>
  <AuthPageShell
    eyebrow="Confirmación de cuenta / LendIt"
    title="Verifica tu correo institucional."
    description="Confirma que tienes acceso al correo con el que creaste tu cuenta."
    note="Confirmar tu correo no sustituye la revisión del carnet o de tu acreditación universitaria."
    card-kicker="Verificación UJAP"
    card-title="Confirmar cuenta"
    card-label="Estado de confirmación de correo electrónico"
    public-session
  >
    <div class="confirmation-view">
      <!-- 1. Verificando estado -->
      <div v-if="isChecking" class="confirmation-view__status">
        <p class="confirmation-view__desc">Comprobando confirmación de correo…</p>
      </div>

      <!-- 2. Correo confirmado con éxito -->
      <div v-else-if="isConfirmed" class="confirmation-view__card" role="status">
        <div class="confirmation-view__icon-wrap confirmation-view__icon-wrap--success">
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h3 class="confirmation-view__heading">¡Cuenta confirmada con éxito!</h3>
        <p class="confirmation-view__desc">
          Tu correo está confirmado. Puedes continuar a LendIt y completar los datos de tu cuenta.
        </p>
        <div class="confirmation-view__actions">
          <button class="btn btn--primary" type="button" @click="continueToApp">
            Continuar a LendIt
          </button>
        </div>
      </div>

      <!-- 3. Confirmar con código o solicitar otro -->
      <div v-else class="confirmation-view__form-section">
        <div v-if="errorMessage" class="confirmation-view__alert" role="alert">
          {{ errorMessage }}
        </div>

        <form class="auth-form" novalidate @submit.prevent="handleConfirm">
          <p class="auth-form__hint">
            Escribe el código de un solo uso que enviamos a tu correo. Si no lo encuentras o ya venció, puedes pedir uno nuevo.
          </p>

          <label class="field">
            <span>Correo institucional</span>
            <input
              v-model="emailForResend"
              type="email"
              placeholder="tu.nombre@ujap.edu.ve"
              autocomplete="email"
              required
              :disabled="isConfirming || isResending"
              :aria-invalid="Boolean(resendError)"
              :aria-describedby="resendError ? 'confirmation-email-error' : undefined"
            />
            <span v-if="resendError" id="confirmation-email-error" class="field__error" role="alert">{{ resendError }}</span>
          </label>

          <label class="field">
            <span>Código de confirmación</span>
            <input
              v-model="confirmationCode"
              class="field__input--code"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              autocapitalize="off"
              spellcheck="false"
              placeholder="Escribe el código del correo"
              required
              :disabled="isConfirming || isResending"
              :aria-invalid="Boolean(confirmationError)"
              :aria-describedby="confirmationError ? 'confirmation-code-error' : 'confirmation-code-hint'"
            />
            <span id="confirmation-code-hint" class="field__hint">El código es de un solo uso.</span>
            <span v-if="confirmationError" id="confirmation-code-error" class="field__error" role="alert">{{ confirmationError }}</span>
          </label>

          <p v-if="resendSuccess" class="auth-form__success" role="status">
            ✓ Código enviado. Revisa tu buzón o carpeta de spam.
          </p>

          <button
            class="btn btn--primary auth-form__submit"
            type="submit"
            :disabled="isConfirming || isResending"
          >
            {{ isConfirming ? 'Confirmando…' : 'Confirmar correo' }}
          </button>

          <button
            class="btn btn--ghost auth-form__resend"
            type="button"
            :disabled="isConfirming || isResending || cooldownSeconds > 0"
            @click="handleResend"
          >
            {{ isResending ? 'Enviando código…' : cooldownSeconds > 0 ? `Reenviar en ${cooldownSeconds}s` : 'Enviar o reenviar código' }}
          </button>

          <p class="auth-form__switch">
            <router-link class="auth-form__link" to="/login">
              ← Volver al inicio de sesión
            </router-link>
          </p>
        </form>
      </div>
    </div>
  </AuthPageShell>
</template>

<style scoped>
.confirmation-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.confirmation-view__status {
  padding: 24px 0;
  text-align: center;
}

.confirmation-view__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 12px 0;
}

.confirmation-view__icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  margin-bottom: 4px;
}

.confirmation-view__icon-wrap--success {
  background: var(--navy-bg, rgba(27, 54, 93, 0.08));
  color: var(--navy);
}

.confirmation-view__heading {
  font: 500 22px/1.2 var(--display);
  color: var(--ink);
  margin: 0;
}

.confirmation-view__desc {
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--ink-soft);
  margin: 0;
}

.confirmation-view__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  margin-top: 8px;
}

.confirmation-view__alert {
  font-size: 13px;
  color: var(--crimson-dark);
  background: var(--crimson-bg);
  padding: 10px 14px;
  border-radius: 8px;
  border-left: 3px solid var(--crimson-dark);
  margin-bottom: 12px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.auth-form__hint {
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink-faint);
  margin: 0;
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
  min-height: 48px;
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

.field__error {
  color: var(--crimson-dark);
  font-size: 12px;
  font-weight: 500;
}

.field__hint {
  color: var(--ink-faint);
  font-size: 12px;
  font-weight: 400;
}

.field__input--code {
  font-family: var(--mono) !important;
  font-size: 18px !important;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-align: center;
}

.auth-form__success {
  font-size: 13px;
  color: var(--navy);
  background: var(--navy-bg, rgba(27, 54, 93, 0.08));
  padding: 10px 14px;
  border-radius: 8px;
  border-left: 3px solid var(--navy);
  margin: 0;
}

.auth-form__submit {
  width: 100%;
  min-height: 48px;
  margin-top: 4px;
}

.auth-form__resend {
  width: 100%;
  min-height: 48px;
  justify-content: center;
}

.auth-form__switch {
  text-align: center;
  font-size: 13.5px;
  color: var(--ink-faint);
  margin: 0;
}

.auth-form__link {
  font-weight: 600;
  color: var(--crimson-dark);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.15s ease;
}

.auth-form__link:hover {
  color: var(--crimson);
}
</style>
