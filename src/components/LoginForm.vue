<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const emit = defineEmits<{
  (e: 'success'): void
}>()

const auth = useAuthStore()

const email = ref('')
const password = ref('')
const errorMessage = ref('')

function handleSubmit() {
  const result = auth.login({ email: email.value.trim(), password: password.value })
  if (!result.ok) {
    errorMessage.value = result.error ?? 'No se pudo iniciar sesión.'
    return
  }
  errorMessage.value = ''
  emit('success')
}
</script>

<template>
  <form class="auth-form" @submit.prevent="handleSubmit">
    <p class="auth-form__hint">Entra con tu correo institucional para publicar y pedir objetos.</p>

    <label class="field">
      <span>Correo institucional</span>
      <input
        v-model="email"
        type="email"
        placeholder="tu.nombre@ujap.edu.ve"
        autocomplete="email"
        required
      />
    </label>

    <label class="field">
      <span>Contraseña</span>
      <input
        v-model="password"
        type="password"
        placeholder="Mínimo 6 caracteres"
        autocomplete="current-password"
        minlength="6"
        required
      />
    </label>

    <p v-if="errorMessage" class="auth-form__error">{{ errorMessage }}</p>

    <button class="btn btn--primary auth-form__submit" type="submit">Entrar</button>
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

.auth-form__submit {
  margin-top: 4px;
  width: 100%;
}
</style>
