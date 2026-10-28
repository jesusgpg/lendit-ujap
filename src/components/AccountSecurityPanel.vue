<script setup lang="ts">
import { ref } from 'vue'
import { createPasswordChangeController } from '../lib/accountPassword'

const controller = createPasswordChangeController()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const showCurrent = ref(false)
const showNew = ref(false)
const showConfirm = ref(false)

const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

function resetForm() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  errorMessage.value = ''
}

async function handleSubmit() {
  if (isSubmitting.value) return

  errorMessage.value = ''
  successMessage.value = ''
  isSubmitting.value = true

  try {
    const result = await controller.submit(
      {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
        confirmPassword: confirmPassword.value,
      },
      {
        onSuccess: () => {
          resetForm()
          successMessage.value = 'Tu contraseña se actualizó correctamente.'
        },
        onError: (err) => {
          errorMessage.value = err
        },
      },
    )

    if (!result.ok && !errorMessage.value) {
      errorMessage.value = result.error || 'No se pudo actualizar la contraseña.'
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Error inesperado al actualizar la contraseña.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="security-panel" aria-labelledby="security-heading" :aria-busy="isSubmitting">
    <header class="security-panel__header">
      <span class="security-panel__tag">Seguridad y acceso</span>
      <h2 id="security-heading">Contraseña y credenciales</h2>
      <p>Actualiza la contraseña de tu cuenta LendIt UJAP. Se verificará tu contraseña actual antes de aplicar el cambio.</p>
    </header>

    <div class="security-panel__notice" role="note">
      <div class="security-panel__notice-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      </div>
      <div class="security-panel__notice-body">
        <strong>Protección de sesión activa</strong>
        <p>Tu sesión actual se mantendrá abierta. Para mayor seguridad, te recomendamos no compartir tu clave institucional ni reutilizar contraseñas de otros servicios.</p>
      </div>
    </div>

    <form class="security-form" :aria-busy="isSubmitting" novalidate @submit.prevent="handleSubmit">
      <fieldset :disabled="isSubmitting" class="security-form__fields">
        <!-- Contraseña actual -->
        <div class="security-form__group">
          <label for="current-password" class="security-form__label">
            Contraseña actual
          </label>
          <div class="security-form__input-wrapper">
            <input
              id="current-password"
              v-model="currentPassword"
              :type="showCurrent ? 'text' : 'password'"
              autocomplete="current-password"
              required
              class="security-form__input"
              aria-describedby="current-password-hint"
              placeholder="Ingresa tu clave actual"
            />
            <button
              type="button"
              class="security-form__toggle"
              :aria-label="showCurrent ? 'Ocultar contraseña actual' : 'Mostrar contraseña actual'"
              :aria-pressed="showCurrent"
              :title="showCurrent ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              tabindex="0"
              @click="showCurrent = !showCurrent"
            >
              <svg v-if="!showCurrent" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            </button>
          </div>
          <small id="current-password-hint" class="security-form__hint">
            Requerida para comprobar tu identidad antes de cambiarla.
          </small>
        </div>

        <!-- Nueva contraseña -->
        <div class="security-form__group">
          <label for="new-password" class="security-form__label">
            Nueva contraseña
          </label>
          <div class="security-form__input-wrapper">
            <input
              id="new-password"
              v-model="newPassword"
              :type="showNew ? 'text' : 'password'"
              autocomplete="new-password"
              required
              minlength="6"
              class="security-form__input"
              aria-describedby="new-password-hint"
              placeholder="Mínimo 6 caracteres"
            />
            <button
              type="button"
              class="security-form__toggle"
              :aria-label="showNew ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'"
              :aria-pressed="showNew"
              :title="showNew ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              tabindex="0"
              @click="showNew = !showNew"
            >
              <svg v-if="!showNew" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            </button>
          </div>
          <small id="new-password-hint" class="security-form__hint">
            Debe tener al menos 6 caracteres y ser distinta a tu clave actual.
          </small>
        </div>

        <!-- Confirmar nueva contraseña -->
        <div class="security-form__group">
          <label for="confirm-password" class="security-form__label">
            Confirmar nueva contraseña
          </label>
          <div class="security-form__input-wrapper">
            <input
              id="confirm-password"
              v-model="confirmPassword"
              :type="showConfirm ? 'text' : 'password'"
              autocomplete="new-password"
              required
              minlength="6"
              class="security-form__input"
              aria-describedby="confirm-password-hint"
              placeholder="Vuelve a escribir la nueva contraseña"
            />
            <button
              type="button"
              class="security-form__toggle"
              :aria-label="showConfirm ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'"
              :aria-pressed="showConfirm"
              :title="showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              tabindex="0"
              @click="showConfirm = !showConfirm"
            >
              <svg v-if="!showConfirm" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            </button>
          </div>
          <small id="confirm-password-hint" class="security-form__hint">
            Escribe exactamente la misma contraseña que ingresaste arriba.
          </small>
        </div>
      </fieldset>

      <!-- Mensajes accesibles -->
      <p v-if="errorMessage" role="alert" class="security-form__error">
        {{ errorMessage }}
      </p>

      <p v-if="successMessage" role="status" class="security-form__saved">
        {{ successMessage }}
      </p>

      <footer class="security-form__footer">
        <span class="security-form__status">
          {{ isSubmitting ? 'Verificando y actualizando…' : 'Tus credenciales están seguras' }}
        </span>
        <div class="security-form__actions">
          <button
            type="button"
            class="btn btn--ghost"
            :disabled="isSubmitting || (!currentPassword && !newPassword && !confirmPassword)"
            @click="resetForm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="btn btn--primary"
            :disabled="isSubmitting || !currentPassword || !newPassword || !confirmPassword"
          >
            {{ isSubmitting ? 'Guardando contraseña…' : 'Cambiar contraseña' }}
          </button>
        </div>
      </footer>
    </form>
  </section>
</template>

<style scoped>
.security-panel {
  display: grid;
  gap: 24px;
}

.security-panel__header {
  display: grid;
  gap: 8px;
}

.security-panel__tag {
  font: 500 12px var(--sans);
  color: var(--crimson-dark);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.security-panel h2 {
  font: 500 27px/1.2 var(--display);
  color: var(--ink);
  letter-spacing: -0.02em;
  margin: 0;
}

.security-panel__header p {
  color: var(--ink-soft);
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
}

.security-panel__notice {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 16px 18px;
  background: var(--navy-bg);
  border: 1px solid var(--line);
  border-radius: 12px;
}

.security-panel__notice-icon {
  color: var(--navy-2);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  margin-top: 2px;
}

:root[data-theme='dark'] .security-panel__notice-icon {
  color: var(--gold);
}

.security-panel__notice-body strong {
  display: block;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 2px;
}

.security-panel__notice-body p {
  font-size: 13px;
  line-height: 1.55;
  color: var(--ink-soft);
  margin: 0;
}

.security-form {
  display: grid;
  gap: 22px;
}

.security-form__fields {
  display: grid;
  gap: 20px;
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}

.security-form__group {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.security-form__label {
  font-weight: 600;
  font-size: 14px;
  color: var(--ink);
}

.security-form__input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.security-form__input {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--line-strong);
  border-radius: 9px;
  background: var(--paper);
  color: var(--ink);
  font: 400 16px var(--sans);
  padding: 12px 48px 12px 14px;
  min-height: 46px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.security-form__input:focus {
  border-color: var(--crimson);
  outline: none;
}

.security-form__toggle {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  min-height: 36px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.security-form__toggle:hover {
  color: var(--ink);
  background: var(--paper-2);
}

.security-form__toggle:focus-visible {
  outline: 2px solid var(--crimson);
  outline-offset: 2px;
}

.security-form__hint {
  font-size: 12px;
  color: var(--ink-soft);
  line-height: 1.5;
}

.security-form__error {
  color: var(--crimson-dark);
  font-size: 14px;
  line-height: 1.6;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--crimson-bg);
  border: 1px solid var(--crimson);
  margin: 0;
}

.security-form__saved {
  color: var(--ink);
  font-size: 14px;
  line-height: 1.6;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--gold-bg);
  border: 1px solid var(--gold);
  margin: 0;
}

.security-form__footer {
  border-top: 1px solid var(--line);
  padding-top: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.security-form__status {
  font-size: 13px;
  color: var(--ink-soft);
}

.security-form__actions {
  display: flex;
  gap: 12px;
}

.security-panel :is(a, button, input):focus-visible {
  outline: 2px solid var(--crimson);
  outline-offset: 3px;
}

@media (max-width: 600px) {
  .security-form__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .security-form__actions {
    flex-direction: column;
    width: 100%;
  }

  .security-form__actions .btn {
    width: 100%;
    min-height: 46px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .security-form__input,
  .security-form__toggle,
  .btn {
    transition: none !important;
    transform: none !important;
  }
}
</style>
