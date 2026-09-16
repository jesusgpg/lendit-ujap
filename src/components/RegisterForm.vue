<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useForm } from 'vee-validate'
import { push } from 'notivue'
import { isInstitutionalEmail, useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import PhotoDropzone from './PhotoDropzone.vue'

const emit = defineEmits<{
  (e: 'success'): void
  (e: 'switch-to-login'): void
}>()

const auth = useAuthStore()
const catalog = useCatalogStore()

const photoPreview = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const { defineField, errors, handleSubmit, isSubmitting, setFieldValue } = useForm({
  initialValues: {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    careerId: '',
    role: 'STUDENT' as 'STUDENT' | 'PROFESSOR',
    phone: '',
  },
  validationSchema: {
    firstName: (value: string) => value.trim().length >= 2 || 'Escribe tu nombre.',
    lastName: (value: string) => value.trim().length >= 2 || 'Escribe tu apellido.',
    email: (value: string) => isInstitutionalEmail(value) || 'Usa tu correo institucional (@ujap.edu.ve).',
    password: (value: string) => value.length >= 6 || 'La contraseña debe tener al menos 6 caracteres.',
    careerId: (value: string) => !!value || 'Selecciona tu carrera.',
    role: (value: string) => ['STUDENT', 'PROFESSOR'].includes(value) || 'Selecciona cómo te registras.',
    phone: (value: string) => value.trim().length >= 7 || 'Escribe un teléfono válido.',
  },
})
const [firstName, firstNameAttrs] = defineField('firstName')
const [lastName, lastNameAttrs] = defineField('lastName')
const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')
const [careerId, careerIdAttrs] = defineField('careerId')
const [role, roleAttrs] = defineField('role')
const [phoneValue, phoneAttrs] = defineField('phone')

onMounted(async () => {
  await catalog.initialize()
  if (!careerId.value) {
    setFieldValue('careerId', catalog.careers[0]?.id ?? '')
  }
})

function handlePhotoUpdate(dataUrl: string) {
  photoPreview.value = dataUrl
  errorMessage.value = ''
}

const onSubmit = handleSubmit(async (values) => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!photoPreview.value) {
    errorMessage.value = 'Selecciona una foto de perfil.'
    return
  }

  const result = await auth.register({
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    password: values.password,
    careerId: values.careerId,
    role: values.role,
    phone: values.phone,
    photo: photoPreview.value,
  })

  if (!result.ok) {
    errorMessage.value = result.error ?? 'No se pudo completar el registro.'
    push.error({ title: 'No se completó el registro', message: errorMessage.value })
    return
  }

  if (result.requiresEmailConfirmation) {
    successMessage.value =
      'Cuenta creada. Revisa tu correo institucional y confirma la cuenta antes de iniciar sesión.'
    push.info({
      title: 'Cuenta creada',
      message: 'Revisa tu correo institucional para confirmar tu cuenta.',
    })
    return
  }

  emit('success')
})

</script>

<template>
  <form class="auth-form auth-form--register" novalidate @submit="onSubmit">
    <p class="auth-form__hint">Crea tu carnet digital LendIt con tus datos de estudiante UJAP.</p>

    <div class="auth-form__row">
      <label class="field">
        <span>Nombre</span>
        <input v-model="firstName" v-bind="firstNameAttrs" type="text" placeholder="María" autocomplete="given-name" required />
        <span v-if="errors.firstName" class="field__error">{{ errors.firstName }}</span>
      </label>

      <label class="field">
        <span>Apellido</span>
        <input v-model="lastName" v-bind="lastNameAttrs" type="text" placeholder="Pérez" autocomplete="family-name" required />
        <span v-if="errors.lastName" class="field__error">{{ errors.lastName }}</span>
      </label>
    </div>

    <label class="field">
      <span>Correo institucional</span>
      <input
        v-model="email"
        v-bind="emailAttrs"
        type="email"
        placeholder="tu.nombre@ujap.edu.ve"
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
        autocomplete="new-password"
        minlength="6"
        required
      />
      <span v-if="errors.password" class="field__error">{{ errors.password }}</span>
    </label>

    <label class="field">
      <span>Carrera</span>
      <select v-model="careerId" v-bind="careerIdAttrs" required>
        <option v-for="c in catalog.careers" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <span v-if="errors.careerId" class="field__error">{{ errors.careerId }}</span>
    </label>

    <div class="auth-form__role-field">
      <fieldset class="field field--role">
        <legend>¿Cómo te registras?</legend>
        <label class="field__radio">
          <input v-model="role" v-bind="roleAttrs" type="radio" name="role" value="STUDENT" />
          <span>Estudiante</span>
        </label>
        <label class="field__radio">
          <input v-model="role" v-bind="roleAttrs" type="radio" name="role" value="PROFESSOR" />
          <span>Profesor</span>
        </label>
      </fieldset>
      <span v-if="errors.role" class="field__error">{{ errors.role }}</span>
    </div>

    <label class="field">
      <span>Teléfono</span>
      <input v-model="phoneValue" v-bind="phoneAttrs" type="tel" placeholder="0414-1234567" autocomplete="tel" required />
      <span v-if="errors.phone" class="field__error">{{ errors.phone }}</span>
    </label>

    <div class="field field--photo">
      <span>Foto de perfil (obligatoria)</span>
      <PhotoDropzone :model-value="photoPreview" @update:model-value="handlePhotoUpdate" />
    </div>

    <p v-if="errorMessage" class="auth-form__error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="auth-form__success">{{ successMessage }}</p>

    <button class="btn btn--primary auth-form__submit" type="submit" :disabled="isSubmitting">
      {{ isSubmitting ? 'Creando cuenta…' : 'Crear mi cuenta' }}
    </button>

    <p class="auth-form__switch">
      ¿Ya tienes cuenta?
      <button type="button" class="auth-form__link" @click="emit('switch-to-login')">Inicia sesión</button>
    </p>
  </form>
</template>

<style scoped>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.auth-form--register {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
  row-gap: 14px;
}

.auth-form--register > .auth-form__hint,
.auth-form--register > .field--photo,
.auth-form--register > .auth-form__error,
.auth-form--register > .auth-form__success,
.auth-form--register > .auth-form__submit,
.auth-form--register > .auth-form__switch {
  grid-column: 1 / -1;
}

.auth-form--register .auth-form__row {
  display: contents;
}

.auth-form__role-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.auth-form__hint {
  font-size: 14px;
  color: var(--ink-faint);
}

.auth-form__row {
  display: flex;
  gap: 12px;
}

.auth-form__row .field {
  flex: 1;
  min-width: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-soft);
}

.field input,
.field select {
  font: inherit;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink);
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--crimson);
}

.field--role {
  border: 1.5px solid var(--line-strong);
  border-radius: 10px;
  padding: 10px 14px;
  display: flex;
  gap: 16px;
  align-items: center;
  height: 100%;
}

.field--role legend {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-soft);
  padding: 0 4px;
}

.field__radio {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  font-size: 14px;
  color: var(--ink);
  cursor: pointer;
}

.auth-form__error,
.auth-form__success {
  font-size: 13px;
}

.auth-form__error {
  color: var(--crimson-dark);
}

.field__error {
  color: var(--crimson-dark);
  font-size: 12px;
  font-weight: 500;
}

.auth-form__success {
  color: var(--gold);
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

@media (max-width: 420px) {
  .auth-form--register {
    grid-template-columns: 1fr;
  }
}
</style>
