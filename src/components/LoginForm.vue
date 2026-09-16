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
      <input
        v-model="password"
        v-bind="passwordAttrs"
        type="password"
        placeholder="Mínimo 6 caracteres"
        autocomplete="current-password"
        minlength="6"
        required
      />
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
  gap: 16px;
}

.auth-form__hint {
  font-size: 14px;
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
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink);
}

.field input:focus {
  outline: none;
  border-color: var(--crimson);
}

.auth-form__error {
  font-size: 13px;
  color: var(--crimson-dark);
}

.field__error {
  color: var(--crimson-dark);
  font-size: 12px;
  font-weight: 500;
}

.auth-form__submit {
  margin-top: 4px;
  width: 100%;
}

.auth-form__submit:disabled {
  cursor: wait;
  opacity: 0.7;
}

.auth-form__switch {
  text-align: center;
  font-size: 13.5px;
  color: var(--ink-faint);
}

.auth-form__link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: var(--crimson);
  cursor: pointer;
}
</style>
