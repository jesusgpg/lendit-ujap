<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { push } from 'notivue'
import type { Career } from '../types'
import { apiRequest } from '../lib/api'
import { isCatalogImageShared, saveWithCatalogImage } from '../lib/catalogImage'
import { removeCatalogImage } from '../lib/storage'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import AdminImagePicker from './AdminImagePicker.vue'
import ModalDialog from './ModalDialog.vue'
import LoadingState from './LoadingState.vue'

const catalog = useCatalogStore()
const auth = useAuthStore()
const canManage = () => auth.hasPermission('careers.manage')
const isLoading = ref(false)
const loadError = ref('')

const isModalOpen = ref(false)
const editing = ref<Career | null>(null)
const isSaving = ref(false)
const formError = ref('')
const form = reactive({ name: '', schoolId: '', imagenUrl: null as string | null, imagenAlt: '' })

const pendingDelete = ref<Career | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')
const brokenImages = ref(new Set<string>())

const UNGROUPED = '__none__'

// Agrupa por ID de escuela e incluye escuelas sin carreras.
const groupedCareers = computed(() => {
  const groups = new Map<string, { name: string; careers: Career[] }>()
  for (const school of catalog.schools) groups.set(school.id, { name: school.name, careers: [] })
  for (const career of catalog.careers) {
    const key = career.school?.id ?? UNGROUPED
    if (!groups.has(key)) groups.set(key, { name: career.school?.name ?? 'Sin escuela asignada', careers: [] })
    groups.get(key)!.careers.push(career)
  }
  return [...groups.entries()].sort(([a, ga], [b, gb]) => {
    if (a === UNGROUPED) return 1
    if (b === UNGROUPED) return -1
    return ga.name.localeCompare(gb.name)
  }).filter(([key, group]) => key !== UNGROUPED || group.careers.length > 0)
})

async function load() {
  isLoading.value = true
  loadError.value = ''
  try {
    await Promise.all([catalog.loadCareers(), catalog.loadSchools()])
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'No se pudieron cargar las carreras.'
  } finally {
    isLoading.value = false
  }
}

onMounted(load)

function openCreateModal() {
  editing.value = null
  form.name = ''
  form.schoolId = ''
  form.imagenUrl = null
  form.imagenAlt = ''
  formError.value = ''
  isModalOpen.value = true
}

function openEditModal(career: Career) {
  editing.value = career
  form.name = career.name
  form.schoolId = career.school?.id ?? ''
  form.imagenUrl = career.imagenUrl ?? null
  form.imagenAlt = career.imagenAlt ?? ''
  formError.value = ''
  isModalOpen.value = true
}

function closeModal() {
  if (isSaving.value) return
  isModalOpen.value = false
}

async function submitForm() {
  if (isSaving.value) return
  const name = form.name.trim()
  if (name.length < 2) { formError.value = 'El nombre debe tener al menos 2 caracteres.'; return }
  if (form.imagenUrl && form.imagenAlt.trim().length < 2) { formError.value = 'Agrega un texto alternativo para la imagen.'; return }

  isSaving.value = true
  formError.value = ''
  const wasEditing = Boolean(editing.value)
  try {
    const previousUrl = editing.value?.imagenUrl ?? null
    const isShared = Boolean(
      previousUrl &&
        isCatalogImageShared(previousUrl, { type: 'career', idOrKey: editing.value?.id ?? '' }, catalog)
    )
    const { cleanupWarning } = await saveWithCatalogImage({
      scope: 'careers',
      previousUrl,
      nextUrl: form.imagenUrl,
      isShared,
      save: (finalUrl) => apiRequest(editing.value ? `/api/careers/${editing.value.id}` : '/api/careers', {
        method: editing.value ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name,
          schoolId: form.schoolId || null,
          imagenUrl: finalUrl,
          imagenAlt: finalUrl ? form.imagenAlt.trim() : null,
        }),
      }),
    })
    await Promise.all([catalog.loadCareers(), catalog.loadSchools()])
    isModalOpen.value = false
    push.success(
      wasEditing
        ? { title: 'Carrera actualizada', message: `${name} quedó guardada.` }
        : { title: 'Carrera creada', message: `${name} ya está disponible.` },
    )
    if (cleanupWarning) push.warning({ title: 'Imagen anterior', message: 'La carrera se guardó, pero no se pudo borrar el archivo anterior.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar la carrera.'
    formError.value = message
    push.error({ title: 'No se guardó la carrera', message })
  } finally {
    isSaving.value = false
  }
}

function askDelete(career: Career) {
  pendingDelete.value = career
  deleteError.value = ''
}

async function confirmDelete() {
  const career = pendingDelete.value
  if (!career || isDeleting.value) return
  isDeleting.value = true
  deleteError.value = ''
  try {
    await apiRequest(`/api/careers/${career.id}`, { method: 'DELETE' })
    if (
      career.imagenUrl &&
      !isCatalogImageShared(career.imagenUrl, { type: 'career', idOrKey: career.id }, catalog)
    ) {
      await removeCatalogImage(career.imagenUrl).catch(() => undefined)
    }
    await Promise.all([catalog.loadCareers(), catalog.loadSchools()])
    pendingDelete.value = null
    push.success({ title: 'Carrera eliminada', message: `${career.name} se quitó del catálogo.` })
  } catch (error) {
    // 409 CAREER_IN_USE llega aquí con su mensaje; se mantiene el diálogo abierto.
    deleteError.value = error instanceof Error ? error.message : 'No se pudo borrar la carrera.'
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="catalog-manager">
    <div class="catalog-manager__toolbar">
      <button v-if="canManage()" class="btn btn--small btn--primary" type="button" @click="openCreateModal">+ Añadir carrera</button>
    </div>

    <LoadingState v-if="isLoading" compact label="Cargando carreras…" />

    <div v-else-if="loadError" class="career-state" role="alert">
      <p>{{ loadError }}</p>
      <button class="btn btn--small" type="button" @click="load">Reintentar</button>
    </div>

    <p v-else-if="groupedCareers.length === 0" class="career-state">Todavía no hay carreras ni escuelas registradas.</p>

    <div v-else class="school-groups">
      <section v-for="[key, group] in groupedCareers" :key="key" class="school-group">
        <h3 class="school-group__title">{{ group.name }}</h3>
        <p v-if="group.careers.length === 0" class="career-state">Esta escuela aún no tiene carreras.</p>
        <ul v-else class="career-list">
          <li v-for="career in group.careers" :key="career.id" class="career-item">
            <img v-if="career.imagenUrl && !brokenImages.has(career.id)" class="career-item__photo" :src="career.imagenUrl" :alt="career.imagenAlt || career.name" loading="lazy" width="48" height="48" @error="brokenImages.add(career.id)" />
            <span class="career-item__name">{{ career.name }}</span>
            <div v-if="canManage()" class="career-item__actions">
              <button class="career-item__action" type="button" :aria-label="`Editar ${career.name}`" title="Editar" @click="openEditModal(career)">✎</button>
              <button class="career-item__action" type="button" :aria-label="`Borrar ${career.name}`" title="Borrar" @click="askDelete(career)">✕</button>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <ModalDialog v-if="isModalOpen" wide :title="editing ? 'Editar carrera' : 'Nueva carrera'" @close="closeModal">
      <form class="catalog-form" @submit.prevent="submitForm">
        <label class="catalog-form__field">
          <span>Nombre de la carrera</span>
          <input v-model="form.name" type="text" maxlength="120" placeholder="Ej: Ingeniería en Sistemas" :disabled="isSaving" />
        </label>
        <label class="catalog-form__field">
          <span>Escuela</span>
          <select v-model="form.schoolId" :disabled="isSaving">
            <option value="">Sin escuela asignada</option>
            <option v-for="school in catalog.schools" :key="school.id" :value="school.id">{{ school.name }}</option>
          </select>
          <small class="catalog-form__hint">¿Falta la escuela? Créala primero en la sección Escuelas.</small>
        </label>
        <AdminImagePicker v-model="form.imagenUrl" v-model:alt="form.imagenAlt" label="Imagen" :disabled="isSaving" />
        <p v-if="formError" class="catalog-form__error" role="alert">{{ formError }}</p>
        <button class="btn btn--primary catalog-form__submit" type="submit" :disabled="isSaving">
          {{ isSaving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear carrera' }}
        </button>
      </form>
    </ModalDialog>

    <ModalDialog v-if="pendingDelete" :title="`Borrar ${pendingDelete.name}`" @close="!isDeleting && (pendingDelete = null)">
      <div class="catalog-form">
        <p>Se borrará «{{ pendingDelete.name }}». Si hay usuarios con esta carrera, no se podrá borrar: reasígnalos primero. Esta acción no se puede deshacer.</p>
        <p v-if="deleteError" class="catalog-form__error" role="alert">{{ deleteError }}</p>
        <div class="career-confirm">
          <button class="btn btn--small" type="button" :disabled="isDeleting" @click="pendingDelete = null">Cancelar</button>
          <button class="btn btn--small btn--primary" type="button" :disabled="isDeleting" @click="confirmDelete">{{ isDeleting ? 'Borrando…' : 'Borrar carrera' }}</button>
        </div>
      </div>
    </ModalDialog>
  </div>
</template>

<style scoped>
.catalog-manager {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.catalog-manager__toolbar {
  display: flex;
  justify-content: flex-end;
}

.career-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  font-size: 14px;
  color: var(--ink-soft);
}

.school-groups {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.school-group__title {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--crimson-dark);
  margin: 0 0 10px;
}

.career-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}

.career-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  background: var(--paper-2);
  border: 1px solid var(--line);
  border-radius: 12px;
  font-size: 14.5px;
  color: var(--ink);
  min-width: 0;
}

.career-item__photo {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
}

.career-item__name {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.career-item__actions {
  flex-shrink: 0;
  display: flex;
  gap: 6px;
}

.career-item__action {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink-faint);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}

.career-item__action:hover {
  border-color: var(--crimson);
  color: var(--crimson);
}

.career-item__action:focus-visible {
  outline: 2px solid var(--crimson);
  outline-offset: 2px;
}

.career-confirm {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

/* ---------- modal form ---------- */
.catalog-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.catalog-form__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-soft);
}

.catalog-form__hint {
  font-weight: 400;
  color: var(--ink-faint);
}

.catalog-form__field input,
.catalog-form__field select {
  font: inherit;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink);
}

.catalog-form__field input:focus-visible,
.catalog-form__field select:focus-visible {
  outline: 2px solid var(--crimson);
  outline-offset: 2px;
}

.catalog-form__error {
  font-size: 13px;
  color: var(--crimson-dark);
  margin: 0;
}

.catalog-form__submit {
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .career-item__action { transition: none; }
}
</style>
