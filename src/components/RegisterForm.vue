<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
const catalogError = ref('')
const showPassword = ref(false)

async function loadCatalog() {
  catalogError.value = ''
  try {
    await catalog.initialize()
    if (!careerId.value && catalog.careers.length) {
      setFieldValue('careerId', catalog.careers[0].id)
    }
    if (!schoolId.value && catalog.schools.length) {
      setFieldValue('schoolId', catalog.schools[0].id)
    }
  } catch (error) {
    catalogError.value = error instanceof Error ? error.message : 'No se pudieron cargar los datos académicos.'
  }
}

const { defineField, errors, handleSubmit, isSubmitting, setFieldValue, values } = useForm({
  initialValues: {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'STUDENT' as 'STUDENT' | 'PROFESSOR',
    schoolId: '',
    department: '',
    careerId: '',
    phone: '',
  },
  validationSchema: {
    firstName: (value: string) => value.trim().length >= 2 || 'Escribe tu nombre.',
    lastName: (value: string) => value.trim().length >= 2 || 'Escribe tu apellido.',
    email: (value: string) => isInstitutionalEmail(value) || 'Usa tu correo institucional (@ujap.edu.ve).',
    password: (value: string) => value.length >= 6 || 'La contraseña debe tener al menos 6 caracteres.',
    role: (value: string) => ['STUDENT', 'PROFESSOR'].includes(value) || 'Selecciona cómo te registras.',
    schoolId: (value: string) => values.role === 'STUDENT' || !!value || 'Selecciona tu facultad o escuela.',
    department: (value: string) => !value || value.length <= 120 || 'Máximo 120 caracteres.',
    careerId: (value: string) => values.role === 'PROFESSOR' || !!value || 'Selecciona tu carrera.',
    phone: (value: string) => value.trim().length >= 7 || 'Escribe un teléfono válido.',
  },
})

const [firstName, firstNameAttrs] = defineField('firstName')
const [lastName, lastNameAttrs] = defineField('lastName')
const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')
const [role] = defineField('role')
const [schoolId, schoolIdAttrs] = defineField('schoolId')
const [department, departmentAttrs] = defineField('department')
const [careerId, careerIdAttrs] = defineField('careerId')
const [phoneValue, phoneAttrs] = defineField('phone')

const availableCareers = computed(() => {
  if (role.value === 'STUDENT') {
    return catalog.careers
  }
  if (!schoolId.value) {
    return catalog.careers
  }
  return catalog.careers.filter((c) => c.school?.id === schoolId.value)
})

watch(schoolId, (newSchool) => {
  if (role.value === 'PROFESSOR' && careerId.value) {
    const belongs = catalog.careers.some((c) => c.id === careerId.value && c.school?.id === newSchool)
    if (!belongs) {
      setFieldValue('careerId', '')
    }
  }
})

onMounted(() => {
  void loadCatalog()
})

function handlePhotoUpdate(dataUrl: string) {
  photoPreview.value = dataUrl
  errorMessage.value = ''
}

const onSubmit = handleSubmit(async (formValues) => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!photoPreview.value) {
    errorMessage.value = 'Selecciona una foto de perfil.'
    return
  }

  const result = await auth.register({
    firstName: formValues.firstName,
    lastName: formValues.lastName,
    email: formValues.email,
    password: formValues.password,
    role: formValues.role,
    schoolId: formValues.role === 'PROFESSOR' ? formValues.schoolId || undefined : undefined,
    department: formValues.role === 'PROFESSOR' ? formValues.department || undefined : undefined,
    careerId: formValues.role === 'STUDENT' ? formValues.careerId : (formValues.careerId || undefined),
    phone: formValues.phone,
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
    <p class="auth-form__hint">Crea tu carnet digital LendIt con tus datos de estudiante o profesor UJAP.</p>

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
      <div class="field__password-control">
        <input
          v-model="password"
          v-bind="passwordAttrs"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Mínimo 6 caracteres"
          autocomplete="new-password"
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
          <svg v-if="!showPassword" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
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

    <div class="auth-form__role-field">
      <fieldset class="field field--role">
        <legend>¿Cómo te registras?</legend>
        <label class="field__radio">
          <input v-model="role" type="radio" name="role" value="STUDENT" />
          <span>Estudiante</span>
        </label>
        <label class="field__radio">
          <input v-model="role" type="radio" name="role" value="PROFESSOR" />
          <span>Profesor</span>
        </label>
      </fieldset>
      <span v-if="errors.role" class="field__error">{{ errors.role }}</span>
    </div>

    <!-- Campos para Estudiante -->
    <template v-if="role === 'STUDENT'">
      <label class="field">
        <span>Carrera</span>
        <select v-model="careerId" v-bind="careerIdAttrs" required :disabled="!catalog.careers.length">
          <option value="" disabled>Selecciona tu carrera</option>
          <option v-for="c in catalog.careers" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <span v-if="errors.careerId" class="field__error">{{ errors.careerId }}</span>
      </label>
    </template>

    <!-- Campos para Docente -->
    <template v-else>
      <label class="field">
        <span>Facultad o Escuela</span>
        <select v-model="schoolId" v-bind="schoolIdAttrs" required :disabled="!catalog.schools.length">
          <option value="" disabled>Selecciona tu facultad o escuela</option>
          <option v-for="s in catalog.schools" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <span v-if="errors.schoolId" class="field__error">{{ errors.schoolId }}</span>
      </label>

      <label class="field">
        <span>Departamento o Cátedra (opcional)</span>
        <input
          v-model="department"
          v-bind="departmentAttrs"
          type="text"
          placeholder="Ej. Algoritmos, Estructuras"
          maxlength="120"
        />
        <span v-if="errors.department" class="field__error">{{ errors.department }}</span>
      </label>

      <label class="field">
        <span>Carrera de adscripción (opcional)</span>
        <select v-model="careerId" v-bind="careerIdAttrs">
          <option value="">Todas / Sin carrera fija</option>
          <option v-for="c in availableCareers" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <span v-if="errors.careerId" class="field__error">{{ errors.careerId }}</span>
      </label>

      <div class="auth-form__teacher-notice">
        <strong>Acreditación docente requerida:</strong>
        Registrarte como profesor expresa tu solicitud. Tu cuenta se creará de forma segura y podrás subir tu carnet docente desde «Mi cuenta» para que la administración valide tu acreditación.
      </div>
    </template>

    <p v-if="catalogError" class="field__error auth-form__catalog-error">
      {{ catalogError }}
      <button class="auth-form__retry" type="button" @click="loadCatalog">Reintentar</button>
    </p>

    <label class="field">
      <span>Teléfono de contacto</span>
      <input v-model="phoneValue" v-bind="phoneAttrs" type="tel" placeholder="0414-1234567" autocomplete="tel" required />
      <span v-if="errors.phone" class="field__error">{{ errors.phone }}</span>
    </label>

    <div class="field field--photo">
      <span>Foto de perfil (obligatoria para el carnet)</span>
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
  row-gap: 16px;
}

.auth-form--register > .auth-form__hint,
.auth-form--register > .field--photo,
.auth-form--register > .auth-form__error,
.auth-form--register > .auth-form__success,
.auth-form--register > .auth-form__submit,
.auth-form--register > .auth-form__switch,
.auth-form--register > .auth-form__teacher-notice,
.auth-form--register > .auth-form__catalog-error {
  grid-column: 1 / -1;
}

.auth-form__teacher-notice {
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--color-text-muted);
  background: var(--color-surface-subtle, rgba(0, 0, 0, 0.03));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 6px);
  padding: 10px 12px;
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
  line-height: 1.5;
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
  padding: 12px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field input:focus,
.field select:focus {
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

.field--role {
  border: 1.5px solid var(--line-strong);
  border-radius: 10px;
  padding: 11px 14px;
  display: flex;
  gap: 20px;
  align-items: center;
  height: 100%;
  background: var(--paper);
}

.field--role legend {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-soft);
  padding: 0 6px;
}

.field__radio {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 550;
  font-size: 14px;
  color: var(--ink);
  cursor: pointer;
}

.field__radio input[type="radio"] {
  accent-color: var(--crimson);
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.auth-form__error,
.auth-form__success {
  font-size: 13px;
  padding: 10px 14px;
  border-radius: 8px;
}

.auth-form__error {
  color: var(--crimson-dark);
  background: var(--crimson-bg);
  border-left: 3px solid var(--crimson-dark);
}

.field__error {
  color: var(--crimson-dark);
  font-size: 12px;
  font-weight: 500;
}

.auth-form__retry {
  margin-left: 6px;
  border: none;
  background: none;
  color: var(--crimson-dark);
  font-size: 12px;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
}

.auth-form__success {
  color: var(--navy);
  background: var(--navy-bg);
  border-left: 3px solid var(--navy-2);
}

.auth-form__submit {
  margin-top: 6px;
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
  color: var(--crimson-dark);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  transition: color 0.15s ease;
}

.auth-form__link:hover {
  color: var(--crimson);
}

@media (max-width: 640px) {
  .auth-form--register {
    grid-template-columns: 1fr;
  }
}
</style>
