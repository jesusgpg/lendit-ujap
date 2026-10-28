<script setup lang="ts">
import { isEligibleCampusEmail } from '../lib/emailEligibility'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { push } from 'notivue'
import { isValidEmail, useAuthStore } from '../stores/auth'
import { getCooldownRemaining, startCooldown } from '../lib/authRecovery'
import AuthPageShell from '../components/AuthPageShell.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const isAdminMode = computed(() => route.query.mode === 'admin')
const email = ref('')
const emailError = ref('')
const isSubmitting = ref(false)
const requestSubmitted = ref(false)
const cooldownSeconds = ref(0)
let timerId: number | null = null

const cooldownKey = computed(() => `recovery_${isAdminMode.value ? 'admin' : 'inst'}`)

function updateCooldown() {
  cooldownSeconds.value = getCooldownRemaining(cooldownKey.value, 60)
  if (cooldownSeconds.value <= 0 && timerId !== null) {
    window.clearInterval(timerId)
    timerId = null
  }
}

onMounted(() => {
  updateCooldown()
  if (cooldownSeconds.value > 0) {
    timerId = window.setInterval(updateCooldown, 1000)
  }
})

onUnmounted(() => {
  if (timerId !== null) {
    window.clearInterval(timerId)
  }
})

function validate(): boolean {
  emailError.value = ''
  const val = email.value.trim().toLowerCase()
  if (!val) {
    emailError.value = isAdminMode.value
      ? 'Escribe el correo del administrador.'
      : 'Escribe tu correo institucional.'
    return false
  }

  if (isAdminMode.value) {
    if (!isValidEmail(val)) {
      emailError.value = 'Escribe un correo electrónico válido.'
      return false
    }
  } else {
    if (!isEligibleCampusEmail(val)) {
      emailError.value = 'Usa tu correo institucional (@ujap.edu.ve).'
      return false
    }
  }
  return true
}

async function handleSubmit() {
  if (!validate()) return
  if (cooldownSeconds.value > 0) return

  isSubmitting.value = true
  emailError.value = ''

  try {
    const result = await authStore.requestPasswordReset(
      email.value.trim(),
      isAdminMode.value ? 'admin' : 'institutional',
    )

    if (!result.ok) {
      emailError.value = result.error ?? 'No se pudo enviar la solicitud.'
      push.error({ title: 'Error de solicitud', message: emailError.value })
      return
    }

    // Iniciar cooldown de 60s
    startCooldown(cooldownKey.value)
    updateCooldown()
    if (timerId === null) {
      timerId = window.setInterval(updateCooldown, 1000)
    }

    requestSubmitted.value = true
    push.success({
      title: 'Solicitud enviada',
      message: 'Si la cuenta existe, se enviaron las instrucciones a tu correo.',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al procesar la recuperación.'
    emailError.value = msg
    push.error({ title: 'Error', message: msg })
  } finally {
    isSubmitting.value = false
  }
}

function handleBackToLogin() {
  if (isAdminMode.value) {
    void router.push('/admin/login')
  } else {
    void router.push('/login')
  }
}
</script>

<template>
  <AuthPageShell
    :eyebrow="isAdminMode ? 'Zona restringida / Seguridad' : 'Acceso UJAP / Seguridad'"
    title="Recupera tu acceso."
    description="Indica tu correo para recibir un enlace de restablecimiento seguro y crear una nueva contraseña."
    :note="isAdminMode ? 'Acceso reservado para administradores de LendIt.' : 'Solo cuentas institucionales @ujap.edu.ve registradas.'"
    card-kicker="Recuperación de contraseña"
    :card-title="isAdminMode ? 'Restablecer acceso admin' : 'Restablecer contraseña'"
    card-label="Formulario de solicitud de recuperación de contraseña"
  >
    <div class="recovery-view">
      <div v-if="requestSubmitted" class="recovery-view__success" role="status">
        <div class="recovery-view__icon-wrap">
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            <path d="m16 19 2 2 4-4" />
          </svg>
        </div>
        <h3 class="recovery-view__heading">Revisa tu correo</h3>
        <p class="recovery-view__desc">
          Si la cuenta está registrada en LendIt, enviamos las instrucciones de restablecimiento. Revisa tu bandeja de entrada y la carpeta de spam.
        </p>
        <p class="recovery-view__hint">
          El enlace de recuperación es de un solo uso y expirará pronto por seguridad.
        </p>

        <div class="recovery-view__actions">
          <button
            class="btn btn--secondary"
            type="button"
            :disabled="cooldownSeconds > 0 || isSubmitting"
            @click="handleSubmit"
          >
            {{ cooldownSeconds > 0 ? `Reenviar en ${cooldownSeconds}s` : 'Reenviar enlace' }}
          </button>
          <button class="btn btn--primary" type="button" @click="handleBackToLogin">
            Volver a iniciar sesión
          </button>
        </div>
      </div>

      <form v-else class="auth-form" novalidate @submit.prevent="handleSubmit">
        <p class="auth-form__hint">
          {{ isAdminMode ? 'Escribe el correo del administrador registrado para recibir las instrucciones.' : 'Escribe tu correo institucional UJAP para recibir el enlace de cambio de clave.' }}
        </p>

        <label class="field">
          <span>{{ isAdminMode ? 'Correo del administrador' : 'Correo institucional' }}</span>
          <input
            v-model="email"
            type="email"
            :placeholder="isAdminMode ? 'admin@gmail.com' : 'tu.nombre@ujap.edu.ve'"
            autocomplete="email"
            required
            :disabled="isSubmitting"
          />
          <span v-if="emailError" class="field__error" role="alert">{{ emailError }}</span>
        </label>

        <button
          class="btn btn--primary auth-form__submit"
          type="submit"
          :disabled="isSubmitting || cooldownSeconds > 0"
        >
          {{ isSubmitting ? 'Enviando…' : cooldownSeconds > 0 ? `Espera ${cooldownSeconds}s…` : 'Enviar enlace de recuperación' }}
        </button>

        <p class="auth-form__switch">
          <button type="button" class="auth-form__link" @click="handleBackToLogin">
            ← Volver al inicio de sesión
          </button>
        </p>
      </form>
    </div>
  </AuthPageShell>
</template>

<style scoped>
.recovery-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.field__error {
  color: var(--crimson-dark);
  font-size: 12px;
  font-weight: 500;
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

.recovery-view__success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 12px 0;
}

.recovery-view__icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--navy-bg, rgba(27, 54, 93, 0.08));
  color: var(--navy);
  margin-bottom: 4px;
}

.recovery-view__heading {
  font: 500 22px/1.2 var(--display);
  color: var(--ink);
  margin: 0;
}

.recovery-view__desc {
  font-size: 14.5px;
  line-height: 1.55;
  color: var(--ink-soft);
  margin: 0;
}

.recovery-view__hint {
  font-size: 12.5px;
  color: var(--ink-faint);
  margin: 0 0 8px;
}

.recovery-view__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
</style>
