<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { push } from 'notivue'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import {
  loadTeacherVerification,
  uploadTeacherCredentialFile,
  submitTeacherVerification,
} from '../lib/teacherCredential'
import type { TeacherVerification } from '../types'
import ModalDialog from './ModalDialog.vue'

const auth = useAuthStore()
const catalog = useCatalogStore()

const loading = ref(true)
const busy = ref(false)
const error = ref('')
const message = ref('')

const verification = ref<TeacherVerification | null>(null)
const previewUrl = ref<string | null>(null)
const selectedFile = ref<File | null>(null)

const schoolId = ref(auth.user?.schoolId ?? '')
const department = ref(auth.user?.department ?? '')
const careerId = ref(auth.user?.careerId ?? '')

const fileInput = ref<HTMLInputElement | null>(null)
const confirmSubmit = ref(false)

const currentStatus = computed(() => verification.value?.status ?? 'DRAFT')
const isPending = computed(() => currentStatus.value === 'PENDING')
const isApproved = computed(() => currentStatus.value === 'APPROVED')
const canEditAndSubmit = computed(() => !isPending.value)

const availableCareers = computed(() => {
  if (!schoolId.value) return catalog.careers
  return catalog.careers.filter((c) => c.school?.id === schoolId.value)
})

const statusMeta = computed(() => {
  switch (currentStatus.value) {
    case 'APPROVED':
      return {
        label: 'Acreditación aprobada',
        class: 'status--approved',
        desc: 'Tu perfil docente está verificado por la administración.',
      }
    case 'PENDING':
      return {
        label: 'En revisión administrativa',
        class: 'status--pending',
        desc: 'Tu solicitud y credencial están congeladas y en proceso de revisión.',
      }
    case 'NEEDS_CORRECTION':
      return {
        label: 'Requiere corrección',
        class: 'status--correction',
        desc: 'La administración solicita que corrijas la información o la credencial.',
      }
    case 'REJECTED':
      return {
        label: 'Postulación rechazada',
        class: 'status--rejected',
        desc: 'La solicitud no fue admitida. Puedes actualizar los datos y reenviar.',
      }
    default:
      return {
        label: 'Falta enviar credencial',
        class: 'status--draft',
        desc: 'Completa tus datos académicos y adjunta la credencial. Al enviarla, pasará a revisión administrativa.',
      }
  }
})

async function fetchVerification() {
  loading.value = true
  error.value = ''
  try {
    await catalog.initialize()
    const data = await loadTeacherVerification()
    verification.value = data
    if (data) {
      schoolId.value = data.schoolId
      department.value = data.department ?? ''
      careerId.value = data.careerId ?? ''
      previewUrl.value = data.signedUrl ?? null
    } else {
      if (!schoolId.value && catalog.schools.length) {
        schoolId.value = catalog.schools[0].id
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo cargar la información de acreditación.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchVerification)

function onFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  error.value = ''
  message.value = ''
  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
}

async function doSubmit() {
  if (!schoolId.value) {
    error.value = 'Selecciona tu facultad o escuela.'
    return
  }

  const existingPath = verification.value?.documentPath
  if (!selectedFile.value && !existingPath) {
    error.value = 'Debes subir una fotografía legible de tu credencial docente.'
    return
  }

  busy.value = true
  error.value = ''
  message.value = ''

  try {
    let documentPath = existingPath
    if (selectedFile.value) {
      documentPath = await uploadTeacherCredentialFile(selectedFile.value)
    }

    if (!documentPath) {
      throw new Error('No se pudo procesar la ruta del documento.')
    }

    const updated = await submitTeacherVerification({
      schoolId: schoolId.value,
      department: department.value.trim() || null,
      careerId: careerId.value || null,
      documentPath,
      expectedVersion: verification.value?.version,
    })

    verification.value = updated
    selectedFile.value = null
    confirmSubmit.value = false
    message.value = 'Tu solicitud de acreditación docente fue enviada a revisión con éxito.'
    push.success({ title: 'Solicitud enviada', message: message.value })
    await auth.syncProfile()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo enviar la solicitud.'
    push.error({ title: 'Error al enviar', message: error.value })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="teacher-panel" aria-labelledby="teacher-panel-title">
    <header class="teacher-panel__header">
      <div>
        <span class="teacher-panel__tag">Cuerpo Académico UJAP</span>
        <h2 id="teacher-panel-title">Acreditación docente</h2>
        <p>Valida tu credencial institucional para acceder al catálogo exclusivo y participar como profesor.</p>
      </div>

      <div class="teacher-panel__badge" :class="statusMeta.class">
        <span class="teacher-panel__badge-dot"></span>
        <strong>{{ statusMeta.label }}</strong>
      </div>
    </header>

    <div v-if="loading" class="teacher-panel__loading" role="status">
      Cargando acreditación docente…
    </div>

    <template v-else>
      <div v-if="verification?.rejectionReason && (currentStatus === 'NEEDS_CORRECTION' || currentStatus === 'REJECTED')" class="teacher-panel__alert" role="alert">
        <strong>Nota de la administración:</strong>
        <p>{{ verification.rejectionReason }}</p>
      </div>

      <div v-if="isApproved" class="teacher-panel__approved-banner" role="status">
        <span class="teacher-panel__check-icon">✓</span>
        <div>
          <strong>Acreditación universitaria confirmada</strong>
          <p>Tu rol de Profesor está activo en LendIt. Puedes publicar, solicitar y acordar préstamos y alquileres con alumnos y colegas.</p>
        </div>
      </div>

      <form class="teacher-panel__form" @submit.prevent="confirmSubmit = true">
        <fieldset :disabled="!canEditAndSubmit || busy" class="teacher-panel__fields">
          <legend class="sr-only">Datos académicos del profesor</legend>

          <div class="teacher-panel__grid">
            <label class="field">
              <span>Facultad o Escuela</span>
              <select v-model="schoolId" required>
                <option value="" disabled>Selecciona tu facultad o escuela</option>
                <option v-for="s in catalog.schools" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </label>

            <label class="field">
              <span>Departamento o Cátedra</span>
              <input
                v-model="department"
                type="text"
                placeholder="Ej. Cátedra de Algoritmos"
                maxlength="120"
              />
            </label>
          </div>

          <label class="field">
            <span>Carrera de adscripción (opcional)</span>
            <select v-model="careerId">
              <option value="">Todas / Sin carrera fija</option>
              <option v-for="c in availableCareers" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
        </fieldset>

        <!-- Document Preview & Upload -->
        <div class="teacher-panel__doc-section">
          <h3>Credencial o carnet docente</h3>
          <p class="teacher-panel__hint">Sube una fotografía legible de tu carnet o credencial física universitaria (JPG, PNG o WebP, máx 5 MB).</p>

          <div class="teacher-panel__preview-box">
            <img
              v-if="previewUrl"
              :src="previewUrl"
              alt="Vista de credencial docente"
              class="teacher-panel__preview-img"
            />
            <div v-else class="teacher-panel__empty-preview">
              <svg class="teacher-panel__doc-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="8" cy="11" r="2" />
                <path d="M5.5 16c.6-1.2 1.4-1.8 2.5-1.8s1.9.6 2.5 1.8M13 10h5M13 14h5" />
              </svg>
              <strong>Sin documento cargado</strong>
              <p>Selecciona una imagen clara de tu acreditación institucional.</p>
            </div>
          </div>

          <div v-if="canEditAndSubmit" class="teacher-panel__upload-actions">
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="sr-only"
              :disabled="busy"
              @change="onFileSelected"
            />
            <button
              type="button"
              class="btn"
              :disabled="busy"
              @click="fileInput?.click()"
            >
              {{ previewUrl ? 'Cambiar imagen' : 'Seleccionar fotografía' }}
            </button>
            <span v-if="selectedFile" class="teacher-panel__file-selected">
              {{ selectedFile.name }} (pendiente de enviar)
            </span>
          </div>
          <div v-else-if="isPending" class="teacher-panel__frozen-note">
            Documento congelado durante la revisión administrativa.
          </div>
        </div>

        <p v-if="error" class="teacher-panel__error" role="alert">{{ error }}</p>
        <p v-if="message" class="teacher-panel__message" role="status">{{ message }}</p>

        <div v-if="canEditAndSubmit" class="teacher-panel__footer">
          <button
            type="submit"
            class="btn btn--primary"
            :disabled="busy || (!previewUrl && !selectedFile)"
          >
            {{ busy ? 'Enviando…' : currentStatus === 'DRAFT' ? 'Enviar a validación' : 'Reenviar a revisión' }}
          </button>
        </div>
      </form>

      <!-- Decision History -->
      <section v-if="verification?.decisions && verification.decisions.length > 0" class="teacher-panel__history" aria-labelledby="history-heading">
        <h3 id="history-heading">Historial de dictámenes</h3>
        <ul class="teacher-panel__history-list">
          <li v-for="d in verification.decisions" :key="d.id" class="teacher-panel__history-item">
            <div class="teacher-panel__history-header">
              <span class="teacher-panel__history-action" :class="`action--${d.action.toLowerCase()}`">
                {{ d.action === 'APPROVE' ? 'Aprobado' : d.action === 'REQUEST_CORRECTION' ? 'Corrección solicitada' : 'Rechazado' }}
              </span>
              <time class="teacher-panel__history-time">{{ new Date(d.createdAt).toLocaleDateString('es-VE', { dateStyle: 'medium' }) }}</time>
            </div>
            <p v-if="d.reason" class="teacher-panel__history-reason">{{ d.reason }}</p>
            <span class="teacher-panel__history-admin">Dictaminado por: {{ d.adminName }}</span>
          </li>
        </ul>
      </section>
    </template>

    <ModalDialog
      v-if="confirmSubmit"
      title="Confirmar envío de acreditación"
      @close="!busy && (confirmSubmit = false)"
    >
      <p>Se enviará tu postulación y credencial docente a la administración de LendIt UJAP. Mientras se revisa, la solicitud quedará en estado de revisión y no podrás modificar el archivo.</p>
      <div class="teacher-panel__modal-actions">
        <button class="btn" :disabled="busy" @click="confirmSubmit = false">Cancelar</button>
        <button class="btn btn--primary" :disabled="busy" @click="doSubmit">
          {{ busy ? 'Enviando…' : 'Confirmar y enviar' }}
        </button>
      </div>
    </ModalDialog>
  </section>
</template>

<style scoped>
.teacher-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.teacher-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.teacher-panel__tag {
  font-family: var(--mono);
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--gold);
}

.teacher-panel__header h2 {
  font-family: var(--display);
  font-size: 1.5rem;
  margin: 4px 0 6px;
  color: var(--ink);
}

.teacher-panel__header p {
  color: var(--ink-soft);
  font-size: 0.9375rem;
}

.teacher-panel__badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-family: var(--mono);
  border: 1px solid currentColor;
}

.teacher-panel__badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.status--draft { color: var(--ink-faint); background: var(--paper-2); }
.status--pending { color: var(--navy-2); background: var(--navy-bg); }
.status--correction { color: var(--crimson-dark); background: var(--crimson-bg); }
.status--rejected { color: var(--crimson-dark); background: var(--crimson-bg); }
.status--approved { color: #15803d; background: rgba(21, 128, 61, 0.08); }

.teacher-panel__alert {
  padding: 14px 18px;
  border-radius: var(--radius-md, 8px);
  background: rgba(217, 119, 6, 0.1);
  border-left: 4px solid #d97706;
  font-size: 0.875rem;
}

.teacher-panel__alert strong {
  color: #b45309;
  display: block;
  margin-bottom: 4px;
}

.teacher-panel__approved-banner {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 16px 20px;
  border-radius: var(--radius-md, 8px);
  background: rgba(21, 128, 61, 0.08);
  border: 1px solid rgba(21, 128, 61, 0.25);
  color: #166534;
}

.teacher-panel__check-icon {
  font-size: 1.5rem;
  font-weight: bold;
}

.teacher-panel__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.teacher-panel__form .field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
  margin: 0;
  color: var(--ink-soft);
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.teacher-panel__form .field input,
.teacher-panel__form .field select {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 46px;
  padding: 10px 13px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background-color: var(--paper);
  color: var(--ink);
  font: 400 15px/1.4 var(--sans);
  transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
}

.teacher-panel__form .field input:hover:not(:disabled),
.teacher-panel__form .field select:hover:not(:disabled) {
  border-color: var(--ink-faint);
}

.teacher-panel__form .field input:focus-visible,
.teacher-panel__form .field select:focus-visible {
  border-color: var(--crimson);
  outline: 2px solid var(--crimson);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--crimson-bg);
}

.teacher-panel__form .field input:disabled,
.teacher-panel__form .field select:disabled {
  background-color: var(--paper-2);
  color: var(--ink-faint);
  cursor: not-allowed;
}

.teacher-panel__fields {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.teacher-panel__doc-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.teacher-panel__doc-section h3 {
  font-size: 1.125rem;
  margin: 0 0 4px;
  color: var(--ink, #1f2937);
}

.teacher-panel__hint {
  font-size: 0.875rem;
  color: var(--color-text-muted, #6b7280);
  margin-bottom: 16px;
}

.teacher-panel__preview-box {
  width: 100%;
  max-width: 480px;
  min-height: 220px;
  border-radius: var(--radius-md, 8px);
  border: 2px dashed var(--color-border, #d1d5db);
  background: var(--color-surface, #f9fafb);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 14px;
}

.teacher-panel__preview-img {
  width: 100%;
  height: auto;
  max-height: 320px;
  object-fit: contain;
}

.teacher-panel__empty-preview {
  text-align: center;
  padding: 24px;
  color: var(--color-text-muted, #6b7280);
}

.teacher-panel__doc-icon {
  width: 38px;
  height: 38px;
  display: block;
  margin: 0 auto 10px;
  color: var(--navy-2);
}

.teacher-panel__upload-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.teacher-panel__file-selected {
  font-size: 0.8125rem;
  font-family: var(--font-mono, monospace);
  color: var(--brand-navy, #1e3a8a);
}

.teacher-panel__frozen-note {
  font-size: 0.875rem;
  font-style: italic;
  color: var(--color-text-muted, #6b7280);
}

.teacher-panel__error {
  color: var(--brand-crimson, #b91c1c);
  font-size: 0.875rem;
  margin: 12px 0 0;
}

.teacher-panel__message {
  color: #15803d;
  font-size: 0.875rem;
  margin: 12px 0 0;
}

.teacher-panel__footer {
  margin-top: 24px;
}

.teacher-panel__history {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.teacher-panel__history h3 {
  font-size: 1rem;
  margin: 0 0 16px;
  color: var(--ink, #1f2937);
}

.teacher-panel__history-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.teacher-panel__history-item {
  padding: 12px 16px;
  border-radius: var(--radius-sm, 6px);
  background: var(--color-surface-subtle, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--color-border, #e5e7eb);
  font-size: 0.875rem;
}

.teacher-panel__history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.teacher-panel__history-action {
  font-family: var(--font-mono, monospace);
  font-size: 0.75rem;
  text-transform: uppercase;
  font-weight: 600;
}

.action--approve { color: #15803d; }
.action--request_correction { color: #d97706; }
.action--reject { color: var(--brand-crimson, #991b1b); }

.teacher-panel__history-time {
  font-size: 0.75rem;
  color: var(--color-text-muted, #6b7280);
}

.teacher-panel__history-reason {
  margin: 4px 0 6px;
  color: var(--ink, #374151);
}

.teacher-panel__history-admin {
  font-size: 0.75rem;
  color: var(--color-text-muted, #9ca3af);
  display: block;
}

.teacher-panel__modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 640px) {
  .teacher-panel__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .teacher-panel__preview-box {
    min-height: 180px;
  }

  .teacher-panel__footer .btn {
    width: 100%;
  }
}
</style>
