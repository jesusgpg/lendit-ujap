<script setup lang="ts">
import { isEligibleCampusEmail } from '../lib/emailEligibility'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { push } from 'notivue'
import { useAuthStore } from '../stores/auth'
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
const requiresConfirmation = ref(false)
const registeredEmail = ref('')
const errorSummary = ref<HTMLElement | null>(null)
const emailValidationFailed = ref(false)
const invalidFieldLinks = ref<Array<{ label: string; id: string }>>([])

const registerFieldTargets: Record<string, { label: string; id: string }> = {
  firstName: { label: 'Nombre', id: 'register-first-name' },
  lastName: { label: 'Apellido', id: 'register-last-name' },
  email: { label: 'Correo institucional', id: 'register-email' },
  password: { label: 'Contraseña', id: 'register-password' },
  role: { label: 'Tipo de cuenta', id: 'register-role' },
  schoolId: { label: 'Facultad o escuela', id: 'register-school' },
  careerId: { label: 'Carrera', id: 'register-career' },
  department: { label: 'Departamento o cátedra', id: 'register-department' },
  phone: { label: 'Teléfono', id: 'register-phone' },
}

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
    email: (value: string) => isEligibleCampusEmail(value) || 'Usa tu correo institucional (@ujap.edu.ve).',
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
  requiresConfirmation.value = false
  emailValidationFailed.value = false
  invalidFieldLinks.value = []

  if (!photoPreview.value) {
    errorMessage.value = 'Selecciona una foto de perfil.'
    push.error({ title: 'Falta tu foto de perfil', message: errorMessage.value })
    await nextTick()
    errorSummary.value?.focus()
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
    await nextTick()
    errorSummary.value?.focus()
    return
  }

  if (result.requiresEmailConfirmation) {
    requiresConfirmation.value = true
    registeredEmail.value = formValues.email
    successMessage.value =
      'Cuenta creada. Revisa tu correo institucional y confirma la cuenta antes de iniciar sesión.'
    push.info({
      title: 'Cuenta creada',
      message: 'Revisa tu correo institucional para confirmar tu cuenta.',
    })
    return
  }

  emit('success')
}, async ({ errors }) => {
  const invalidNames = Object.keys(errors)
  emailValidationFailed.value = invalidNames.includes('email') && Boolean(email.value.trim()) && !isEligibleCampusEmail(email.value)
  invalidFieldLinks.value = invalidNames
    .map((name) => registerFieldTargets[name])
    .filter((field): field is { label: string; id: string } => Boolean(field))

  errorMessage.value = emailValidationFailed.value
    ? 'Para crear una cuenta debes usar un correo institucional @ujap.edu.ve. Los correos personales, como Gmail, no están habilitados.'
    : 'Completa los campos señalados antes de crear tu cuenta.'

  push.error({
    title: emailValidationFailed.value ? 'Correo no permitido' : 'Revisa el formulario',
    message: errorMessage.value,
  })
  await nextTick()
  errorSummary.value?.focus()
})

</script>

<template>
  <form class="auth-form auth-form--register" novalidate @submit="onSubmit">
    <p class="auth-form__hint">Crea tu carnet digital LendIt con tus datos de estudiante o profesor UJAP.</p>

    <div
      v-if="errorMessage"
      ref="errorSummary"
      class="auth-form__error"
      role="alert"
      tabindex="-1"
      aria-labelledby="register-error-title"
    >
      <strong id="register-error-title">
        {{ emailValidationFailed ? 'No se permite este correo' : 'No se pudo crear la cuenta' }}
      </strong>
      <p>{{ errorMessage }}</p>
      <ul v-if="invalidFieldLinks.length" class="auth-form__error-links">
        <li v-for="field in invalidFieldLinks" :key="field.id">
          <a :href="`#${field.id}`">Revisar {{ field.label.toLowerCase() }}</a>
        </li>
      </ul>
    </div>

    <div class="auth-form__row">
      <label class="field">
        <span>Nombre</span>
        <input id="register-first-name" v-model="firstName" v-bind="firstNameAttrs" type="text" placeholder="María" autocomplete="given-name" required />
        <span v-if="errors.firstName" class="field__error">{{ errors.firstName }}</span>
      </label>

      <label class="field">
        <span>Apellido</span>
        <input id="register-last-name" v-model="lastName" v-bind="lastNameAttrs" type="text" placeholder="Pérez" autocomplete="family-name" required />
        <span v-if="errors.lastName" class="field__error">{{ errors.lastName }}</span>
      </label>
    </div>

    <label class="field">
      <span>Correo institucional</span>
      <input
        id="register-email"
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
          id="register-password"
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
      <fieldset id="register-role" class="field field--role" tabindex="-1">
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
        <select id="register-career" v-model="careerId" v-bind="careerIdAttrs" required :disabled="!catalog.careers.length">
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
        <select id="register-school" v-model="schoolId" v-bind="schoolIdAttrs" required :disabled="!catalog.schools.length">
          <option value="" disabled>Selecciona tu facultad o escuela</option>
          <option v-for="s in catalog.schools" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <span v-if="errors.schoolId" class="field__error">{{ errors.schoolId }}</span>
      </label>

      <label class="field">
        <span>Departamento o Cátedra (opcional)</span>
        <input
          v-model="department"
          id="register-department"
          v-bind="departmentAttrs"
          type="text"
          placeholder="Ej. Algoritmos, Estructuras"
          maxlength="120"
        />
        <span v-if="errors.department" class="field__error">{{ errors.department }}</span>
      </label>

      <label class="field">
        <span>Carrera de adscripción (opcional)</span>
        <select id="register-career" v-model="careerId" v-bind="careerIdAttrs">
          <option value="">Todas / Sin carrera fija</option>
          <option v-for="c in availableCareers" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <span v-if="errors.careerId" class="field__error">{{ errors.careerId }}</span>
      </label>

      <div class="auth-form__teacher-notice">
        <strong>Acreditación docente requerida.</strong>
        Tu registro inicia una postulación. Sube el carnet docente desde «Mi cuenta» para que administración revise tu acreditación. Mientras se aprueba, tu cuenta conserva los permisos de estudiante; al aprobarla se activa el rol de profesor.
      </div>
    </template>

    <p v-if="catalogError" class="field__error auth-form__catalog-error">
      {{ catalogError }}
      <button class="auth-form__retry" type="button" @click="loadCatalog">Reintentar</button>
    </p>

    <label class="field">
      <span>Teléfono de contacto</span>
      <input id="register-phone" v-model="phoneValue" v-bind="phoneAttrs" type="tel" placeholder="0414-1234567" autocomplete="tel" required />
      <span v-if="errors.phone" class="field__error">{{ errors.phone }}</span>
    </label>

    <div class="field field--photo">
      <span id="register-photo-label">Foto de perfil (obligatoria para el carnet)</span>
      <PhotoDropzone
        :model-value="photoPreview"
        alt="Foto de perfil"
        :aria-label="photoPreview ? 'Cambiar foto de perfil para el carnet' : 'Subir foto de perfil para el carnet'"
        hint="JPG o PNG, hasta 5 MB. Se optimiza para el carnet institucional."
        @update:model-value="handlePhotoUpdate"
      />
      <p id="photo-persistence-help" class="auth-form__photo-help">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <span>
          Tu foto se conservará temporalmente en este navegador mientras confirmas tu correo institucional para vincularla a tu carnet automáticamente.
        </span>
      </p>
    </div>

    <!-- Estado accesible tras solicitar confirmación de correo -->
    <div v-if="requiresConfirmation" class="auth-form__confirmation" role="status" aria-live="polite">
      <div class="auth-form__confirmation-header">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <strong>¡Cuenta creada! Revisa tu correo institucional</strong>
      </div>
      <p class="auth-form__confirmation-text">
        Hemos registrado tu cuenta con el correo <strong>{{ registeredEmail }}</strong>. Ingresa el código que enviamos para activarla.
      </p>
      <p class="auth-form__confirmation-subtext">
        Tu foto de perfil está resguardada de forma segura en este navegador. Al confirmar e iniciar sesión se asociará a tu carnet digital LendIt.
      </p>
      <div class="auth-form__confirmation-links">
        <router-link :to="{ path: '/auth/confirmacion', query: { email: registeredEmail } }" class="auth-form__link auth-form__link--resend">
          Confirmar con el código o solicitar otro
        </router-link>
      </div>
    </div>

    <p v-else-if="successMessage" class="auth-form__success">{{ successMessage }}</p>

    <button
      v-if="!requiresConfirmation"
      class="btn btn--primary auth-form__submit"
      type="submit"
      :disabled="isSubmitting"
    >
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

.auth-form__photo-help {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--ink-soft);
}

.auth-form__photo-help svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--navy);
}

.auth-form__confirmation {
  background: var(--navy-bg);
  border-left: 3px solid var(--navy-2);
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--ink);
  font-size: 13.5px;
}

.auth-form__confirmation-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--navy);
}

.auth-form__confirmation-header strong {
  font-size: 14px;
  font-weight: 650;
}

.auth-form__confirmation-text,
.auth-form__confirmation-subtext {
  margin: 0;
  line-height: 1.45;
}

.auth-form__confirmation-subtext {
  font-size: 12.5px;
  color: var(--ink-soft);
}

.auth-form__confirmation-links {
  margin-top: 4px;
}

.auth-form__link--resend {
  display: inline-block;
  font-size: 13px;
}

.auth-form__error {
  color: var(--crimson-dark);
  background: var(--crimson-bg);
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

.auth-form__error-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: 6px 0 0;
  padding-left: 18px;
}

.auth-form__error-links a {
  color: var(--crimson-dark);
  font-weight: 650;
  text-underline-offset: 2px;
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
