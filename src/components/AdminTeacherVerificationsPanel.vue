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
  status: 'PENDING' | 'NEEDS_CORRECTION' | 'REJECTED' | 'APPROVED'
  version: number
  submittedAt: string | null
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
const credentialImageFailed = ref(false)

function statusLabel(status: TeacherVerification['status']) {
  switch (status) {
    case 'PENDING': return 'Pendiente de revisión'
    case 'NEEDS_CORRECTION': return 'Requiere corrección'
    case 'REJECTED': return 'Rechazada'
    case 'APPROVED': return 'Aprobada'
    case 'DRAFT': return 'Sin enviar'
  }
  return 'Estado desconocido'
}

function decisionLabel(action: NonNullable<TeacherVerification['decisions']>[number]['action']) {
  switch (action) {
    case 'APPROVE': return 'Aprobó la acreditación'
    case 'REQUEST_CORRECTION': return 'Solicitó correcciones'
    case 'REJECT': return 'Rechazó la postulación'
  }
  return 'Dictamen registrado'
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-VE')
}

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
  showImageZoom.value = false
  credentialImageFailed.value = false
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
  showImageZoom.value = false
  credentialImageFailed.value = false
}

async function submitDecision() {
  if (!activeReview.value || activeReview.value.status !== 'PENDING' || !actionType.value) return

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
    const serverMessage = err instanceof Error ? err.message : ''
    if (activeReview.value && (serverMessage.includes('CONCURRENCY_CONFLICT') || serverMessage.includes('NOT_PENDING'))) {
      const reviewId = activeReview.value.id
      await openReview(reviewId)
      reviewError.value = serverMessage.includes('NOT_PENDING')
        ? 'Esta solicitud ya fue dictaminada por otra persona administradora. Actualizamos el detalle.'
        : 'La solicitud cambió durante la revisión. Actualizamos el detalle antes de continuar.'
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
        <h2 id="teacher-admin-title" class="teacher-admin__title">Postulaciones enviadas</h2>
        <p class="teacher-admin__subtitle">Abre cada envío para revisar los datos y registrar un dictamen.</p>
      </div>

      <div class="teacher-admin__stats">
        <span class="teacher-admin__stat-count">{{ totalCount }}</span>
        <span class="teacher-admin__stat-label">envíos</span>
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
          <option value="ALL">Todos los envíos</option>
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

    <p class="teacher-admin__queue-note">La cola solo incluye postulaciones enviadas; los formularios aún sin enviar no aparecen aquí.</p>

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
            <th scope="col">Fecha de envío</th>
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
              <span class="badge" :class="`badge--${item.status.toLowerCase()}`">{{ statusLabel(item.status) }}</span>
            </td>
            <td class="teacher-admin__date">{{ formatDate(item.submittedAt ?? item.updatedAt) }}</td>
            <td class="teacher-admin__actions">
              <button
                type="button"
                class="btn btn--secondary teacher-admin__btn-review"
                @click="openReview(item.id)"
              >
                {{ item.status === 'PENDING' ? 'Revisar' : 'Ver detalle' }}
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
      :wide="true"
      :title="'Revisión de acreditación · ' + (activeReview.user?.name ?? 'Solicitud')"
      @close="closeReview"
    >
      <div class="review-modal">
        <section class="review-modal__column review-modal__context" aria-label="Datos de la postulación">
          <div class="review-modal__applicant-info">
            <div>
              <p class="review-modal__eyebrow">Postulación docente</p>
              <h3>{{ activeReview.user?.name }}</h3>
              <p class="review-modal__contact">{{ activeReview.user?.email }} <span aria-hidden="true">·</span> {{ activeReview.user?.phone }}</p>
              <p class="review-modal__current-role">Rol actual: <strong>{{ activeReview.user?.currentRole }}</strong></p>
              <p v-if="activeReview.submittedAt" class="review-modal__submitted-at">Enviada el {{ formatDate(activeReview.submittedAt) }}</p>
            </div>
            <div class="review-modal__meta">
              <span class="badge" :class="'badge--' + activeReview.status.toLowerCase()">{{ statusLabel(activeReview.status) }}</span>
            </div>
          </div>

          <dl class="review-modal__academic">
            <div>
              <dt>Facultad</dt>
              <dd>{{ activeReview.school?.name ?? 'Sin especificar' }}</dd>
            </div>
            <div v-if="activeReview.department">
              <dt>Departamento o cátedra</dt>
              <dd>{{ activeReview.department }}</dd>
            </div>
            <div v-if="activeReview.career">
              <dt>Carrera</dt>
              <dd>{{ activeReview.career.name }}</dd>
            </div>
          </dl>

          <div class="review-modal__doc-section">
            <div class="review-modal__section-heading">
              <h3>Credencial presentada</h3>
              <span v-if="activeReview.submission?.documentBytes" class="review-modal__doc-size">
                {{ (activeReview.submission.documentBytes / 1024).toFixed(0) }} KB
              </span>
            </div>
            <div v-if="activeReview.signedUrl && !credentialImageFailed" class="review-modal__doc-preview">
              <button
                class="review-modal__doc-trigger"
                type="button"
                aria-label="Ampliar credencial universitaria"
                @click="showImageZoom = true"
              >
                <img
                  :src="activeReview.signedUrl"
                  alt="Credencial universitaria del docente"
                  class="review-modal__doc-img"
                  @error="credentialImageFailed = true"
                />
              </button>
              <p class="review-modal__doc-hint">Selecciona la imagen para verla en grande.</p>
            </div>
            <div v-else class="review-modal__doc-missing" role="status">
              No se pudo cargar la credencial. Cierra el detalle y vuelve a abrirlo para renovar el enlace.
            </div>
          </div>
        </section>

        <section class="review-modal__column review-modal__decision-column" aria-label="Dictamen administrativo">
          <div v-if="activeReview.status === 'PENDING'" class="review-modal__decision-box">
            <h3>Decisión de revisión</h3>
            <p class="review-modal__decision-intro">Revisa los datos y la credencial antes de registrar un dictamen.</p>

            <fieldset class="review-modal__action-selector">
              <legend class="sr-only">Selecciona el dictamen</legend>
              <label class="review-modal__radio">
                <input v-model="actionType" type="radio" value="APPROVE" />
                <span><strong>Aprobar acreditación</strong><small>Habilita el rol de profesor.</small></span>
              </label>
              <label class="review-modal__radio">
                <input v-model="actionType" type="radio" value="REQUEST_CORRECTION" />
                <span><strong>Solicitar correcciones</strong><small>La persona podrá corregir y volver a enviar.</small></span>
              </label>
              <label class="review-modal__radio">
                <input v-model="actionType" type="radio" value="REJECT" />
                <span><strong>Rechazar postulación</strong><small>Indica por qué no puede aprobarse.</small></span>
              </label>
            </fieldset>

            <div v-if="actionType === 'REQUEST_CORRECTION' || actionType === 'REJECT'" class="review-modal__reason-field">
              <label for="review-reason">Motivo para la persona docente
                <textarea
                  id="review-reason"
                  v-model="actionReason"
                  rows="4"
                  placeholder="Explica con claridad qué debe corregir o por qué se rechaza la postulación."
                  required
                  minlength="5"
                  maxlength="1000"
                ></textarea>
              </label>
              <p class="review-modal__field-hint">Obligatorio, mínimo 5 caracteres.</p>
            </div>

            <div v-if="actionType === 'APPROVE'" class="review-modal__approve-notice">
              Al aprobar, se asignará el rol de profesor y se guardará la adscripción académica indicada.
            </div>
          </div>
          <div v-else class="review-modal__closed-state" role="status">
            <h3>{{ statusLabel(activeReview.status) }}</h3>
            <p v-if="activeReview.status === 'APPROVED'">Esta credencial ya fue aprobada. No se puede registrar otro dictamen para el mismo envío.</p>
            <p v-else-if="activeReview.status === 'NEEDS_CORRECTION' || activeReview.status === 'REJECTED'">Este envío ya fue dictaminado. La postulación volverá a revisión cuando la persona docente envíe una nueva versión.</p>
            <p v-else>Esta postulación todavía no tiene un envío pendiente de revisión.</p>
            <p v-if="activeReview.rejectionReason" class="review-modal__closed-reason"><strong>Motivo registrado:</strong> {{ activeReview.rejectionReason }}</p>
          </div>

          <p v-if="reviewError" class="review-modal__error" role="alert">{{ reviewError }}</p>

          <div class="review-modal__actions">
            <button type="button" class="btn" :disabled="submittingDecision" @click="closeReview">
              Cerrar
            </button>
            <button
              v-if="activeReview.status === 'PENDING'"
              type="button"
              class="btn btn--primary"
              :disabled="!actionType || submittingDecision"
              @click="submitDecision"
            >
              {{ submittingDecision ? 'Guardando dictamen…' : 'Registrar dictamen' }}
            </button>
          </div>
        </section>

        <section v-if="activeReview.decisions?.length" class="review-modal__history" aria-labelledby="review-history-title">
          <h3 id="review-history-title">Historial de dictámenes</h3>
          <ol>
            <li v-for="decision in activeReview.decisions" :key="decision.id">
              <div>
                <strong>{{ decisionLabel(decision.action) }}</strong>
                <span>{{ formatDate(decision.createdAt) }} · {{ decision.adminName }}</span>
              </div>
              <p v-if="decision.reason">{{ decision.reason }}</p>
            </li>
          </ol>
        </section>
      </div>
    </ModalDialog>
    <!-- Zoom Image Modal -->
    <ModalDialog
      v-if="showImageZoom && activeReview?.signedUrl && !credentialImageFailed"
      :wide="true"
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
  font-family: var(--display);
  font-size: 1.5rem;
  margin: 0 0 6px;
  color: var(--ink);
}

.teacher-admin__subtitle {
  color: var(--ink-soft);
  font-size: 0.9375rem;
  margin: 0;
}

.teacher-admin__stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.teacher-admin__stat-count {
  font-family: var(--mono);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--navy);
}

.teacher-admin__stat-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-faint);
}

.teacher-admin__filters {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  padding: 14px 18px;
  background: var(--paper-2);
  border: 1px solid var(--line);
  border-radius: 12px;
}

.teacher-admin__queue-note {
  margin: -14px 0 0;
  color: var(--ink-faint);
  font-size: 0.8125rem;
}

.teacher-admin__filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.teacher-admin__filter-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ink-soft);
}

.teacher-admin__select,
.teacher-admin__search-input {
  padding: 6px 12px;
  min-height: 40px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  font-size: 0.875rem;
  background: var(--paper);
  color: var(--ink);
}

.teacher-admin__search {
  margin-left: auto;
}

.teacher-admin__table-wrap {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--paper);
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
  border-bottom: 1px solid var(--line);
}

.teacher-admin__table th {
  background: var(--paper-2);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-faint);
}

.teacher-admin__applicant-name {
  display: block;
  color: var(--ink);
}

.teacher-admin__applicant-email {
  font-size: 0.8125rem;
  color: var(--ink-faint);
}

.teacher-admin__school-name {
  display: block;
  font-weight: 500;
}

.teacher-admin__dept-name {
  font-size: 0.8125rem;
  color: var(--ink-soft);
}

.teacher-admin__date {
  font-size: 0.8125rem;
  color: var(--ink-faint);
}

.teacher-admin__btn-review {
  min-height: 44px;
  padding: 6px 14px;
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

.badge--pending { background: var(--navy-bg); color: var(--navy); }
.badge--needs_correction { background: var(--gold-bg); color: var(--ink); }
.badge--rejected { background: var(--crimson-bg); color: var(--crimson-dark); }
.badge--approved { background: rgba(21, 128, 61, 0.1); color: #15803d; }

.teacher-admin__pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}

.teacher-admin__page-info {
  font-size: 0.875rem;
  color: var(--ink-faint);
}

/* Review modal internals */
.review-modal {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(340px, 0.92fr);
  align-items: start;
  gap: 24px;
  max-width: 100%;
}

.review-modal__column {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.review-modal__applicant-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}

.review-modal__eyebrow,
.review-modal__current-role,
.review-modal__submitted-at,
.review-modal__contact {
  margin: 0;
}

.review-modal__eyebrow {
  margin-bottom: 8px;
  color: var(--ink-faint);
  font-size: 0.8125rem;
}

.review-modal__applicant-info h3 {
  margin: 0 0 6px;
  font-size: 1.2rem;
  line-height: 1.25;
}

.review-modal__contact {
  color: var(--ink-soft);
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}

.review-modal__current-role,
.review-modal__submitted-at {
  margin-top: 8px;
  color: var(--ink-faint);
  font-size: 0.8125rem;
}

.review-modal__current-role strong {
  color: var(--ink);
  font-family: var(--mono);
  font-size: 0.75rem;
}

.review-modal__meta {
  display: grid;
  justify-items: end;
  gap: 8px;
  flex: 0 0 auto;
}

.review-modal__academic {
  display: grid;
  gap: 14px;
  margin: 0;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}

.review-modal__academic dt {
  margin-bottom: 3px;
  color: var(--ink-faint);
  font-size: 0.75rem;
}

.review-modal__academic dd {
  margin: 0;
  color: var(--ink);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.review-modal__section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.review-modal__section-heading h3,
.review-modal__decision-box h3,
.review-modal__closed-state h3,
.review-modal__history h3 {
  margin: 0;
  font-size: 1rem;
}

.review-modal__doc-size,
.review-modal__field-hint {
  color: var(--ink-faint);
  font-size: 0.75rem;
}

.review-modal__doc-preview {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--paper);
}

.review-modal__doc-trigger {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 190px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--paper-2);
  cursor: zoom-in;
}

.review-modal__doc-trigger:focus-visible {
  outline: 2px solid var(--crimson);
  outline-offset: 3px;
}

.review-modal__doc-img {
  display: block;
  max-width: 100%;
  max-height: 420px;
  object-fit: contain;
  border-radius: 4px;
}

.review-modal__doc-hint {
  margin: 0;
  color: var(--ink-faint);
  font-size: 0.75rem;
  text-align: center;
}

.review-modal__doc-missing {
  padding: 16px;
  border: 1px dashed var(--line-strong);
  border-radius: 8px;
  color: var(--ink-soft);
  font-size: 0.875rem;
}

.review-modal__decision-box,
.review-modal__closed-state {
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--paper);
}

.review-modal__decision-intro,
.review-modal__closed-state > p {
  margin: 8px 0 16px;
  color: var(--ink-soft);
  font-size: 0.875rem;
  line-height: 1.5;
}

.review-modal__action-selector {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
}

.review-modal__radio {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--paper-2);
  cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease;
}

.review-modal__radio:has(input:checked) {
  border-color: var(--gold);
  background: var(--gold-bg);
}

.review-modal__radio:focus-within {
  outline: 2px solid var(--crimson);
  outline-offset: 2px;
}

.review-modal__radio input {
  width: 18px;
  height: 18px;
  margin: 2px 0 0;
  accent-color: var(--crimson);
}

.review-modal__radio > span {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.review-modal__radio strong {
  color: var(--ink);
  font-size: 0.875rem;
}

.review-modal__radio small {
  color: var(--ink-soft);
  font-size: 0.8rem;
  line-height: 1.4;
}

.review-modal__reason-field {
  margin-top: 16px;
}

.review-modal__reason-field label {
  display: grid;
  gap: 8px;
  color: var(--ink);
  font-size: 0.875rem;
  font-weight: 600;
}

.review-modal__reason-field textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 104px;
  padding: 10px 12px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: var(--paper);
  color: var(--ink);
  font: inherit;
  font-weight: 400;
  resize: vertical;
}

.review-modal__reason-field textarea:focus-visible {
  outline: 2px solid var(--crimson);
  outline-offset: 2px;
}

.review-modal__field-hint {
  margin: 6px 0 0;
}

.review-modal__approve-notice {
  margin-top: 14px;
  padding: 12px;
  border-left: 3px solid #15803d;
  background: rgba(21, 128, 61, 0.08);
  color: #166534;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.review-modal__closed-state {
  border-left: 3px solid var(--gold);
}

.review-modal__closed-state > p:last-child {
  margin-bottom: 0;
}

.review-modal__closed-reason {
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.review-modal__actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.review-modal__actions .btn {
  min-height: 44px;
}

.review-modal__error {
  margin: 0;
  color: var(--crimson-dark);
  font-size: 0.875rem;
}

.review-modal__history {
  grid-column: 1 / -1;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}

.review-modal__history ol {
  display: grid;
  gap: 12px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.review-modal__history li {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.review-modal__history li > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 6px 16px;
  font-size: 0.8125rem;
}

.review-modal__history li > div span,
.review-modal__history li > p {
  color: var(--ink-faint);
  font-size: 0.8125rem;
}

.review-modal__history li > p {
  margin: 6px 0 0;
  color: var(--ink-soft);
  overflow-wrap: anywhere;
}

@media (max-width: 860px) {
  .review-modal {
    grid-template-columns: minmax(0, 1fr);
  }

  .review-modal__history {
    grid-column: auto;
  }
}

@media (max-width: 520px) {
  .review-modal__applicant-info {
    display: grid;
  }

  .review-modal__meta {
    justify-items: start;
  }

  .review-modal__decision-box,
  .review-modal__closed-state {
    padding: 16px;
  }

  .review-modal__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .review-modal__actions .btn:only-child {
    grid-column: 1 / -1;
  }
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
