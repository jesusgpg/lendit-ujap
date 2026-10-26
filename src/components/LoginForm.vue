<script setup lang="ts">
import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { push } from 'notivue'
import { isInstitutionalEmail, isValidEmail, useAuthStore } from '../stores/auth'
import type { LoginMode } from '../types'

const props = withDefaults(
  defineProps<{
    mode?: LoginMode
  }>(),
  { mode: 'institutional' as LoginMode },
)

const isAdminLogin = computed(() => props.mode === 'admin')

const emit = defineEmits<{
  (e: 'success'): void
  (e: 'switch-to-register'): void
}>()

const auth = useAuthStore()

const errorMessage = ref('')
const showPassword = ref(false)

const { defineField, errors, handleSubmit, isSubmitting } = useForm({
  initialValues: { email: '', password: '' },
  validationSchema: {
    email: (value: string) =>
      (isAdminLogin.value ? isValidEmail(value) : isInstitutionalEmail(value)) ||
      (isAdminLogin.value ? 'Escribe un correo válido.' : 'Usa tu correo institucional (@ujap.edu.ve).'),
    password: (value: string) => value.length >= 6 || 'La contraseña debe tener al menos 6 caracteres.',
  },
})
const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')

const onSubmit = handleSubmit(async (values) => {
  errorMessage.value = ''

  const result = await auth.login({ email: values.email.trim(), password: values.password, mode: props.mode })
  if (!result.ok) {
    errorMessage.value = result.error ?? 'No se pudo iniciar sesión.'
    push.error({ title: 'No se pudo iniciar sesión', message: errorMessage.value })
    return
  }
  emit('success')
})
</script>

<template>
  <form class="auth-form" novalidate @submit="onSubmit">
    <p class="auth-form__hint">
      {{ isAdminLogin ? 'Usa el correo registrado del administrador, incluido Gmail.' : 'Entra con tu correo institucional para publicar y pedir objetos.' }}
    </p>

    <label class="field">
      <span>{{ isAdminLogin ? 'Correo del administrador' : 'Correo institucional' }}</span>
      <input
        v-model="email"
        v-bind="emailAttrs"
        type="email"
        :placeholder="isAdminLogin ? 'admin@gmail.com' : 'tu.nombre@ujap.edu.ve'"
        autocomplete="email"
        required
      />
      <span v-if="errors.email" class="field__error">{{ errors.email }}</span>
    </label>

    <label class="field">
      <span>Contraseña</span>
      <div class="field__password-control">
        <input
          v-model="password"
          v-bind="passwordAttrs"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Mínimo 6 caracteres"
          autocomplete="current-password"
          minlength="6"
          required
        />
        <button
          type="button"
          class="field__pw-toggle"
          :aria-label="showPassword ? 'Ocultar contraseña' : 'Ver contraseña en texto'"
          :title="showPassword ? 'Ocultar contraseña' : 'Ver contraseña'"
          @click="showPassword = !showPassword"
        >
          <!-- Eye icon when hidden -->
          <svg v-if="!showPassword" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <!-- Eye slash icon when visible -->
          <svg v-else aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" x2="22" y1="2" y2="22" />
          </svg>
        </button>
      </div>
      <span v-if="errors.password" class="field__error">{{ errors.password }}</span>
    </label>

    <p v-if="errorMessage" class="auth-form__error">{{ errorMessage }}</p>

    <button class="btn btn--primary auth-form__submit" type="submit" :disabled="isSubmitting">
      {{ isSubmitting ? 'Entrando…' : isAdminLogin ? 'Entrar al panel' : 'Entrar' }}
    </button>

    <p v-if="!isAdminLogin" class="auth-form__switch">
      ¿No tienes cuenta?
      <button type="button" class="auth-form__link" @click="emit('switch-to-register')">Regístrate</button>
    </p>

    <p v-if="!isAdminLogin" class="auth-form__switch">
      ¿Eres administrador?
      <router-link class="auth-form__link" to="/admin/login">Acceso administrativo</router-link>
    </p>
    <p v-else class="auth-form__switch">
      <router-link class="auth-form__link" to="/">Volver al acceso de la comunidad</router-link>
    </p>
  </form>
</template>

<style scoped>
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

.field__pw-toggle:focus-visible {
  outline: 2px solid var(--crimson);
  outline-offset: 1px;
}

.auth-form__error {
  font-size: 13px;
  color: var(--crimson-dark);
  background: var(--crimson-bg);
  padding: 8px 12px;
  border-radius: 8px;
  border-left: 3px solid var(--crimson-dark);
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
</style>
