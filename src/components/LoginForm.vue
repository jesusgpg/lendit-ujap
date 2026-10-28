<script setup lang="ts">
import { isEligibleCampusEmail } from '../lib/emailEligibility'
import { computed, nextTick, ref } from 'vue'
import { useForm } from 'vee-validate'
import { push } from 'notivue'
import { isValidEmail, useAuthStore } from '../stores/auth'
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
const errorSummary = ref<HTMLElement | null>(null)
const personalEmailOnStudentLogin = ref(false)
const invalidFieldLinks = ref<Array<{ label: string; id: string }>>([])

const { defineField, errors, handleSubmit, isSubmitting } = useForm({
  initialValues: { email: '', password: '' },
  validationSchema: {
    email: (value: string) =>
      (isAdminLogin.value ? isValidEmail(value) : isEligibleCampusEmail(value)) ||
      (isAdminLogin.value ? 'Escribe un correo válido.' : 'Usa tu correo institucional (@ujap.edu.ve).'),
    password: (value: string) => value.length >= 6 || 'La contraseña debe tener al menos 6 caracteres.',
  },
})
const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')

const onSubmit = handleSubmit(async (values) => {
  errorMessage.value = ''
  personalEmailOnStudentLogin.value = false
  invalidFieldLinks.value = []

  const result = await auth.login({ email: values.email.trim(), password: values.password, mode: props.mode })
  if (!result.ok) {
    errorMessage.value = result.error ?? 'No se pudo iniciar sesión.'
    push.error({ title: 'No se pudo iniciar sesión', message: errorMessage.value })
    await nextTick()
    errorSummary.value?.focus()
    return
  }
  emit('success')
}, async ({ errors }) => {
  const typedEmail = email.value.trim()
  personalEmailOnStudentLogin.value = !isAdminLogin.value && Boolean(typedEmail) && !isEligibleCampusEmail(typedEmail)
  invalidFieldLinks.value = [
    ...(errors.email ? [{ label: isAdminLogin.value ? 'Correo del administrador' : 'Correo institucional', id: 'login-email' }] : []),
    ...(errors.password ? [{ label: 'Contraseña', id: 'login-password' }] : []),
  ]

  errorMessage.value = personalEmailOnStudentLogin.value
    ? 'El acceso de estudiante solo admite correos @ujap.edu.ve. Si este es tu correo de administrador, entra por «Acceso administrativo».'
    : 'Revisa los campos indicados antes de iniciar sesión.'

  push.error({
    title: personalEmailOnStudentLogin.value ? 'Correo no institucional' : 'Revisa el formulario',
    message: errorMessage.value,
  })
  await nextTick()
  errorSummary.value?.focus()
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
        id="login-email"
        v-model="email"
        v-bind="emailAttrs"
        type="email"
        :placeholder="isAdminLogin ? 'admin@gmail.com' : 'tu.nombre@ujap.edu.ve'"
        autocomplete="email"
        required
        :aria-invalid="Boolean(errors.email)"
        :aria-describedby="errors.email ? 'login-email-error' : undefined"
      />
      <span v-if="errors.email" id="login-email-error" class="field__error">{{ errors.email }}</span>
    </label>

    <label class="field">
      <span>Contraseña</span>
      <div class="field__password-control">
        <input
          id="login-password"
          v-model="password"
          v-bind="passwordAttrs"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Mínimo 6 caracteres"
          autocomplete="current-password"
          minlength="6"
          required
          :aria-invalid="Boolean(errors.password)"
          :aria-describedby="errors.password ? 'login-password-error' : undefined"
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
      <span v-if="errors.password" id="login-password-error" class="field__error">{{ errors.password }}</span>
    </label>

    <div class="auth-form__aux-row">
      <router-link
        class="auth-form__forgot-link"
        :to="{ path: '/recuperar-contrasena', query: isAdminLogin ? { mode: 'admin' } : undefined }"
      >
        ¿Olvidaste tu contraseña?
      </router-link>
    </div>

    <div
      v-if="errorMessage"
      ref="errorSummary"
      class="auth-form__error"
      role="alert"
      tabindex="-1"
      aria-labelledby="login-error-title"
    >
      <strong id="login-error-title">
        {{ personalEmailOnStudentLogin ? 'Este correo no sirve para el acceso de estudiante' : 'No se pudo iniciar sesión' }}
      </strong>
      <p>{{ errorMessage }}</p>
      <ul v-if="invalidFieldLinks.length" class="auth-form__error-links">
        <li v-for="field in invalidFieldLinks" :key="field.id">
          <a :href="`#${field.id}`">Revisar {{ field.label.toLowerCase() }}</a>
        </li>
      </ul>
      <router-link v-if="personalEmailOnStudentLogin" class="auth-form__admin-link" to="/admin/login">
        Ir al acceso administrativo
      </router-link>
    </div>

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

.auth-form__error:focus {
  outline: 2px solid var(--crimson);
  outline-offset: 2px;
}

.auth-form__error strong {
  display: block;
  margin-bottom: 3px;
}

.auth-form__error p {
  margin: 0;
}

.auth-form__error-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: 6px 0 0;
  padding-left: 18px;
}

.auth-form__error-links a,
.auth-form__admin-link {
  color: var(--crimson-dark);
  font-weight: 650;
  text-underline-offset: 2px;
}

.auth-form__admin-link {
  display: inline-block;
  margin-top: 8px;
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

.auth-form__aux-row {
  display: flex;
  justify-content: flex-end;
  margin-top: -6px;
  margin-bottom: 2px;
}

.auth-form__forgot-link {
  font-size: 13px;
  font-weight: 550;
  color: var(--crimson-dark);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.15s ease;
}

.auth-form__forgot-link:hover {
  color: var(--crimson);
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
