<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { push } from 'notivue'
import { apiRequest } from '../lib/api'
import { useCatalogStore } from '../stores/catalog'
import type { TeacherVerification } from '../types'
import ModalDialog from './ModalDialog.vue'

interface VerificationListItem {
  id: string
  userId: string
  applicant: {
    id: string
    name: string
    email: string
    phone: string
    role: string
  }
  school: { id: string; name: string }
  career: { id: string; name: string } | null
  department: string | null
  status: 'DRAFT' | 'PENDING' | 'NEEDS_CORRECTION' | 'REJECTED' | 'APPROVED'
  version: number
  documentPath: string | null
  createdAt: string
  updatedAt: string
}

interface ApiResponseList {
  ok: boolean
  data: VerificationListItem[]
  meta: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

const catalog = useCatalogStore()

const items = ref<VerificationListItem[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')
const selectedStatus = ref<'PENDING' | 'NEEDS_CORRECTION' | 'REJECTED' | 'APPROVED' | 'ALL'>('PENDING')
const selectedSchoolId = ref('')
const currentPage = ref(1)
const totalPages = ref(1)
const totalCount = ref(0)

// Review modal state
const activeReview = ref<TeacherVerification | null>(null)
const loadingDetail = ref(false)
const reviewError = ref('')
const actionReason = ref('')
const actionType = ref<'APPROVE' | 'REQUEST_CORRECTION' | 'REJECT' | null>(null)
const submittingDecision = ref(false)
const showImageZoom = ref(false)

async function fetchList() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      status: selectedStatus.value,
      page: String(currentPage.value),
      pageSize: '10',
    })
    if (search.value.trim()) params.append('search', search.value.trim())
    if (selectedSchoolId.value) params.append('schoolId', selectedSchoolId.value)

    const response = await apiRequest<ApiResponseList>(`/api/admin/teacher-verifications?${params.toString()}`)
    items.value = response.data
    totalPages.value = response.meta.totalPages
    totalCount.value = response.meta.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Error al cargar las validaciones docentes.'
  } finally {
    loading.value = false
  }
}

watch([selectedStatus, selectedSchoolId], () => {
  currentPage.value = 1
  void fetchList()
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    currentPage.value = 1
    void fetchList()
  }, 350)
}

async function openReview(id: string) {
  loadingDetail.value = true
  reviewError.value = ''
  actionType.value = null
  actionReason.value = ''
  try {
    const response = await apiRequest<{ ok: boolean; verification: TeacherVerification }>(`/api/admin/teacher-verifications/${id}`)
    activeReview.value = response.verification
  } catch (err) {
    reviewError.value = err instanceof Error ? err.message : 'No se pudo cargar el detalle de la solicitud.'
    push.error({ title: 'Error', message: reviewError.value })
  } finally {
    loadingDetail.value = false
  }
}

function closeReview() {
  if (submittingDecision.value) return
  activeReview.value = null
  actionType.value = null
  actionReason.value = ''
}

async function submitDecision() {
  if (!activeReview.value || !actionType.value) return

  if (actionType.value !== 'APPROVE' && actionReason.value.trim().length < 5) {
    reviewError.value = 'Se requiere un motivo explicativo de al menos 5 caracteres.'
    return
  }

  submittingDecision.value = true
  reviewError.value = ''

  try {
    await apiRequest(`/api/admin/teacher-verifications/${activeReview.value.id}/decision`, {
      method: 'POST',
      body: JSON.stringify({
        action: actionType.value,
        reason: actionReason.value.trim() || undefined,
        expectedVersion: activeReview.value.version,
      }),
    })

    const actionText = actionType.value === 'APPROVE' ? 'aprobada' : actionType.value === 'REQUEST_CORRECTION' ? 'marcada para corrección' : 'rechazada'
    push.success({ title: 'Dictamen registrado', message: `La solicitud fue ${actionText} exitosamente.` })
    closeReview()
    await fetchList()
  } catch (err) {
    if (err instanceof Error && err.message.includes('CONCURRENCY_CONFLICT')) {
      reviewError.value = 'Conflicto de concurrencia: la solicitud fue modificada por otro usuario o dictamen. Actualizando datos…'
      await openReview(activeReview.value.id)
    } else {
      reviewError.value = err instanceof Error ? err.message : 'Error al registrar el dictamen.'
    }
  } finally {
    submittingDecision.value = false
  }
}

onMounted(async () => {
  await catalog.initialize()
  await fetchList()
})
</script>

<template>
  <div class="teacher-admin" aria-labelledby="teacher-admin-title">
    <div class="teacher-admin__header">
      <div>
        <h2 id="teacher-admin-title" class="teacher-admin__title">Validaciones docentes</h2>
        <p class="teacher-admin__subtitle">Revisa las credenciales del cuerpo académico para habilitar su participación como profesor.</p>
      </div>

      <div class="teacher-admin__stats">
        <span class="teacher-admin__stat-count">{{ totalCount }}</span>
        <span class="teacher-admin__stat-label">solicitudes</span>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="teacher-admin__filters">
      <div class="teacher-admin__filter-group">
        <label for="status-filter" class="teacher-admin__filter-label">Estado:</label>
        <select id="status-filter" v-model="selectedStatus" class="teacher-admin__select">
          <option value="PENDING">Pendientes de revisión</option>
          <option value="NEEDS_CORRECTION">Requiere corrección</option>
          <option value="REJECTED">Rechazadas</option>
          <option value="APPROVED">Aprobadas</option>
          <option value="ALL">Todas las solicitudes</option>
        </select>
      </div>

      <div class="teacher-admin__filter-group">
        <label for="school-filter" class="teacher-admin__filter-label">Facultad:</label>
        <select id="school-filter" v-model="selectedSchoolId" class="teacher-admin__select">
          <option value="">Todas las facultades</option>
          <option v-for="s in catalog.schools" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </div>

      <div class="teacher-admin__search">
        <label for="applicant-search" class="sr-only">Buscar por nombre o correo</label>
        <input
          id="applicant-search"
          v-model="search"
          type="search"
          placeholder="Buscar docente…"
          class="teacher-admin__search-input"
          @input="onSearchInput"
        />
      </div>
    </div>

    <div v-if="loading" class="teacher-admin__loading" role="status">
      Cargando solicitudes docentes…
    </div>

    <p v-else-if="error" class="teacher-admin__error" role="alert">
      {{ error }} <button type="button" class="btn" @click="fetchList">Reintentar</button>
    </p>

    <div v-else-if="items.length === 0" class="teacher-admin__empty">
      <p>No se encontraron solicitudes con los filtros seleccionados.</p>
    </div>

    <!-- Table of verifications -->
    <div v-else class="teacher-admin__table-wrap">
      <table class="teacher-admin__table">
        <thead>
          <tr>
            <th scope="col">Docente</th>
            <th scope="col">Facultad y Cátedra</th>
            <th scope="col">Estado</th>
            <th scope="col">Versión</th>
            <th scope="col">Fecha</th>
            <th scope="col"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>
              <strong class="teacher-admin__applicant-name">{{ item.applicant.name }}</strong>
              <span class="teacher-admin__applicant-email">{{ item.applicant.email }}</span>
            </td>
            <td>
              <span class="teacher-admin__school-name">{{ item.school.name }}</span>
              <span v-if="item.department" class="teacher-admin__dept-name">{{ item.department }}</span>
            </td>
            <td>
              <span class="badge" :class="`badge--${item.status.toLowerCase()}`">
                {{ item.status === 'APPROVED' ? 'Aprobado' : item.status === 'PENDING' ? 'Pendiente' : item.status === 'NEEDS_CORRECTION' ? 'Corrección' : item.status === 'REJECTED' ? 'Rechazado' : 'Borrador' }}
              </span>
            </td>
            <td class="teacher-admin__version">v{{ item.version }}</td>
            <td class="teacher-admin__date">{{ new Date(item.updatedAt).toLocaleDateString('es-VE') }}</td>
            <td class="teacher-admin__actions">
              <button
                type="button"
                class="btn btn--secondary teacher-admin__btn-review"
                @click="openReview(item.id)"
              >
                Revisar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="teacher-admin__pagination">
      <button
        type="button"
        class="btn"
        :disabled="currentPage <= 1 || loading"
        @click="currentPage--; fetchList()"
      >
        Anterior
      </button>
      <span class="teacher-admin__page-info">Página {{ currentPage }} de {{ totalPages }}</span>
      <button
        type="button"
        class="btn"
        :disabled="currentPage >= totalPages || loading"
        @click="currentPage++; fetchList()"
      >
        Siguiente
      </button>
    </div>

    <!-- Review Modal Dialog -->
    <ModalDialog
      v-if="activeReview"
      :title="`Revisión docente — ${activeReview.user?.name ?? 'Solicitud'}`"
      @close="closeReview"
    >
      <div class="review-modal">
        <div class="review-modal__applicant-info">
          <div>
            <strong>{{ activeReview.user?.name }}</strong>
            <p>{{ activeReview.user?.email }} · {{ activeReview.user?.phone }}</p>
            <p class="review-modal__current-role">Rol actual: <span>{{ activeReview.user?.currentRole }}</span></p>
          </div>
          <div class="review-modal__meta">
            <span class="badge" :class="`badge--${activeReview.status.toLowerCase()}`">
              {{ activeReview.status }} (v{{ activeReview.version }})
            </span>
          </div>
        </div>

        <div class="review-modal__academic">
          <p><strong>Facultad:</strong> {{ activeReview.school?.name }}</p>
          <p v-if="activeReview.department"><strong>Departamento:</strong> {{ activeReview.department }}</p>
          <p v-if="activeReview.career"><strong>Carrera:</strong> {{ activeReview.career.name }}</p>
        </div>

        <!-- Document Viewer -->
        <div class="review-modal__doc-section">
          <h4>Credencial presentada:</h4>
          <div v-if="activeReview.signedUrl" class="review-modal__doc-preview">
            <img
              :src="activeReview.signedUrl"
              alt="Credencial universitaria del docente"
              class="review-modal__doc-img"
              @click="showImageZoom = true"
            />
            <p class="review-modal__doc-hint">Clic en la imagen para ampliar.</p>
          </div>
          <div v-else class="review-modal__doc-missing">
            Sin imagen disponible o enlace expirado.
          </div>
        </div>

        <!-- Decision Form -->
        <div class="review-modal__decision-box">
          <h4>Dictamen administrativo:</h4>

          <div class="review-modal__action-selector">
            <label class="review-modal__radio">
              <input v-model="actionType" type="radio" value="APPROVE" />
              <span>Aprobar acreditación (Asigna rol Profesor)</span>
            </label>
            <label class="review-modal__radio">
              <input v-model="actionType" type="radio" value="REQUEST_CORRECTION" />
              <span>Solicitar corrección (Requiere motivo)</span>
            </label>
            <label class="review-modal__radio">
              <input v-model="actionType" type="radio" value="REJECT" />
              <span>Rechazar postulación (Requiere motivo)</span>
            </label>
          </div>

          <div v-if="actionType === 'REQUEST_CORRECTION' || actionType === 'REJECT'" class="review-modal__reason-field">
            <label for="review-reason">
              <span>Motivo explicativo para el docente (obligatorio):</span>
              <textarea
                id="review-reason"
                v-model="actionReason"
                rows="3"
                placeholder="Indica con claridad el motivo del rechazo o los ajustes necesarios en el documento…"
                required
                minlength="5"
                maxlength="1000"
              ></textarea>
            </label>
          </div>

          <div v-if="actionType === 'APPROVE'" class="review-modal__approve-notice">
            Al aprobar, el usuario obtendrá de inmediato el rol <strong>PROFESSOR</strong> y se sincronizarán sus datos académicos de adscripción.
          </div>
        </div>

        <p v-if="reviewError" class="review-modal__error" role="alert">{{ reviewError }}</p>

        <!-- Actions -->
        <div class="review-modal__actions">
          <button type="button" class="btn" :disabled="submittingDecision" @click="closeReview">
            Cerrar
          </button>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="!actionType || submittingDecision"
            @click="submitDecision"
          >
            {{ submittingDecision ? 'Procesando dictamen…' : 'Registrar dictamen' }}
          </button>
        </div>

        <!-- History -->
        <div v-if="activeReview.decisions && activeReview.decisions.length > 0" class="review-modal__history">
          <h5>Historial de dictámenes previos:</h5>
          <ul>
            <li v-for="d in activeReview.decisions" :key="d.id">
              <strong>{{ d.action }}</strong> — {{ new Date(d.createdAt).toLocaleDateString('es-VE') }} por {{ d.adminName }}
              <p v-if="d.reason">«{{ d.reason }}»</p>
            </li>
          </ul>
        </div>
      </div>
    </ModalDialog>

    <!-- Zoom Image Modal -->
    <ModalDialog
      v-if="showImageZoom && activeReview?.signedUrl"
      title="Vista ampliada de credencial docente"
      @close="showImageZoom = false"
    >
      <div class="image-zoom-container">
        <img :src="activeReview.signedUrl" alt="Credencial ampliada" class="image-zoom-img" />
      </div>
    </ModalDialog>
  </div>
</template>

<style scoped>
.teacher-admin {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.teacher-admin__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.teacher-admin__title {
  font-family: var(--font-heading, serif);
  font-size: 1.625rem;
  margin: 0 0 6px;
  color: var(--ink, #111827);
}

.teacher-admin__subtitle {
  color: var(--color-text-muted, #4b5563);
  font-size: 0.9375rem;
  margin: 0;
}

.teacher-admin__stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.teacher-admin__stat-count {
  font-family: var(--font-mono, monospace);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--brand-navy, #1e3a8a);
}

.teacher-admin__stat-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted, #6b7280);
}

.teacher-admin__filters {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  padding: 14px 18px;
  background: var(--surface-raised, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-md, 8px);
}

.teacher-admin__filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.teacher-admin__filter-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted, #4b5563);
}

.teacher-admin__select,
.teacher-admin__search-input {
  padding: 6px 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  background: var(--paper, #ffffff);
  color: var(--ink, #111827);
}

.teacher-admin__search {
  margin-left: auto;
}

.teacher-admin__table-wrap {
  overflow-x: auto;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  background: var(--surface-raised, #ffffff);
}

.teacher-admin__table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.875rem;
}

.teacher-admin__table th,
.teacher-admin__table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.teacher-admin__table th {
  background: var(--color-surface, #f9fafb);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted, #6b7280);
}

.teacher-admin__applicant-name {
  display: block;
  color: var(--ink, #111827);
}

.teacher-admin__applicant-email {
  font-size: 0.8125rem;
  color: var(--color-text-muted, #6b7280);
}

.teacher-admin__school-name {
  display: block;
  font-weight: 500;
}

.teacher-admin__dept-name {
  font-size: 0.8125rem;
  color: var(--color-text-muted, #6b7280);
}

.teacher-admin__version {
  font-family: var(--font-mono, monospace);
  color: var(--color-text-muted, #6b7280);
}

.teacher-admin__date {
  font-size: 0.8125rem;
  color: var(--color-text-muted, #6b7280);
}

.teacher-admin__btn-review {
  padding: 4px 10px;
  font-size: 0.8125rem;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.badge--pending { background: rgba(30, 58, 138, 0.1); color: #1e3a8a; }
.badge--needs_correction { background: rgba(217, 119, 6, 0.1); color: #d97706; }
.badge--rejected { background: rgba(153, 27, 27, 0.1); color: #991b1b; }
.badge--approved { background: rgba(21, 128, 61, 0.1); color: #15803d; }
.badge--draft { background: rgba(107, 114, 128, 0.1); color: #6b7280; }

.teacher-admin__pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}

.teacher-admin__page-info {
  font-size: 0.875rem;
  color: var(--color-text-muted, #6b7280);
}

/* Review modal internals */
.review-modal {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 600px;
}

.review-modal__applicant-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.review-modal__current-role span {
  font-family: var(--font-mono, monospace);
  font-weight: 600;
}

.review-modal__doc-section h4 {
  margin: 0 0 8px;
  font-size: 0.9375rem;
}

.review-modal__doc-preview {
  text-align: center;
  background: var(--color-surface, #f9fafb);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-sm, 6px);
  padding: 12px;
}

.review-modal__doc-img {
  max-width: 100%;
  max-height: 240px;
  object-fit: contain;
  cursor: pointer;
  border-radius: 4px;
}

.review-modal__doc-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted, #6b7280);
  margin-top: 6px;
}

.review-modal__decision-box {
  padding: 16px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface-subtle, rgba(0, 0, 0, 0.02));
}

.review-modal__decision-box h4 {
  margin: 0 0 12px;
}

.review-modal__action-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.review-modal__radio {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  cursor: pointer;
}

.review-modal__reason-field {
  margin-top: 14px;
}

.review-modal__reason-field textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  margin-top: 4px;
}

.review-modal__approve-notice {
  margin-top: 12px;
  padding: 10px 12px;
  background: rgba(21, 128, 61, 0.08);
  border: 1px solid rgba(21, 128, 61, 0.2);
  border-radius: var(--radius-sm, 6px);
  color: #166534;
  font-size: 0.8125rem;
}

.review-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
}

.review-modal__error {
  color: var(--brand-crimson, #b91c1c);
  font-size: 0.875rem;
}

.review-modal__history {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border, #e5e7eb);
  font-size: 0.8125rem;
}

.review-modal__history ul {
  padding-left: 18px;
  margin: 6px 0 0;
}

.image-zoom-container {
  display: flex;
  justify-content: center;
  align-items: center;
  max-width: 90vw;
  max-height: 80vh;
}

.image-zoom-img {
  max-width: 100%;
  max-height: 75vh;
  object-fit: contain;
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
</style>
