<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { push } from 'notivue'
import type { School } from '../types'
import { apiRequest } from '../lib/api'
import { isCatalogImageShared, saveWithCatalogImage } from '../lib/catalogImage'
import { removeCatalogImage } from '../lib/storage'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import AdminImagePicker from './AdminImagePicker.vue'
import LoadingState from './LoadingState.vue'
import ModalDialog from './ModalDialog.vue'

const catalog = useCatalogStore()
const auth = useAuthStore()
const canManage = () => auth.hasPermission('careers.manage')

const isLoading = ref(false)
const loadError = ref('')
const brokenImages = ref(new Set<string>())

const isModalOpen = ref(false)
const editing = ref<School | null>(null)
const isSaving = ref(false)
const formError = ref('')
const form = reactive({ name: '', imagenUrl: null as string | null, imagenAlt: '' })

const pendingDelete = ref<School | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')

async function load() {
  isLoading.value = true
  loadError.value = ''
  try {
    await catalog.loadSchools()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'No se pudieron cargar las escuelas.'
  } finally {
    isLoading.value = false
  }
}

onMounted(load)

function openCreate() {
  editing.value = null
  form.name = ''
  form.imagenUrl = null
  form.imagenAlt = ''
  formError.value = ''
  isModalOpen.value = true
}

function openEdit(school: School) {
  editing.value = school
  form.name = school.name
  form.imagenUrl = school.imagenUrl ?? null
  form.imagenAlt = school.imagenAlt ?? ''
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
        isCatalogImageShared(previousUrl, { type: 'school', idOrKey: editing.value?.id ?? '' }, catalog)
    )
    const { cleanupWarning } = await saveWithCatalogImage({
      scope: 'schools',
      previousUrl,
      nextUrl: form.imagenUrl,
      isShared,
      save: (finalUrl) => apiRequest(editing.value ? `/api/schools/${editing.value.id}` : '/api/schools', {
        method: editing.value ? 'PATCH' : 'POST',
        body: JSON.stringify({ name, imagenUrl: finalUrl, imagenAlt: finalUrl ? form.imagenAlt.trim() : null }),
      }),
    })
    await catalog.loadSchools()
    isModalOpen.value = false
    push.success(wasEditing ? { title: 'Escuela actualizada', message: `${name} quedó guardada.` } : { title: 'Escuela creada', message: `${name} ya está disponible.` })
    if (cleanupWarning) push.warning({ title: 'Imagen anterior', message: 'La escuela se guardó, pero no se pudo borrar el archivo anterior.' })
  } catch (error) {
    // El borrador se conserva abierto para reintentar.
    const message = error instanceof Error ? error.message : 'No se pudo guardar la escuela.'
    formError.value = message
    push.error({ title: 'No se guardó la escuela', message })
  } finally {
    isSaving.value = false
  }
}

function askDelete(school: School) {
  pendingDelete.value = school
  deleteError.value = ''
}

async function confirmDelete() {
  const school = pendingDelete.value
  if (!school || isDeleting.value) return
  isDeleting.value = true
  deleteError.value = ''
  try {
    await apiRequest(`/api/schools/${school.id}`, { method: 'DELETE' })
    if (
      school.imagenUrl &&
      !isCatalogImageShared(school.imagenUrl, { type: 'school', idOrKey: school.id }, catalog)
    ) {
      await removeCatalogImage(school.imagenUrl).catch(() => undefined)
    }
    await catalog.loadSchools()
    pendingDelete.value = null
    push.success({ title: 'Escuela eliminada', message: `${school.name} se quitó del catálogo.` })
  } catch (error) {
    deleteError.value = error instanceof Error ? error.message : 'No se pudo borrar la escuela.'
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="catalog-manager">
    <div class="catalog-manager__toolbar">
      <button v-if="canManage()" class="btn btn--small btn--primary" type="button" @click="openCreate">+ Añadir escuela</button>
    </div>

    <LoadingState v-if="isLoading" compact label="Cargando escuelas…" />

    <div v-else-if="loadError" class="school-state" role="alert">
      <p>{{ loadError }}</p>
      <button class="btn btn--small" type="button" @click="load">Reintentar</button>
    </div>

    <p v-else-if="catalog.schools.length === 0" class="school-state">Todavía no hay escuelas. Crea la primera para organizar las carreras.</p>

    <ul v-else class="school-list">
      <li v-for="school in catalog.schools" :key="school.id" class="school-item">
        <img v-if="school.imagenUrl && !brokenImages.has(school.id)" class="school-item__photo" :src="school.imagenUrl" :alt="school.imagenAlt || school.name" loading="lazy" width="96" height="64" @error="brokenImages.add(school.id)" />
        <span v-else class="school-item__photo school-item__photo--empty" aria-hidden="true">⌂</span>
        <div class="school-item__body">
          <strong>{{ school.name }}</strong>
          <p>{{ school.careerCount ?? 0 }} {{ school.careerCount === 1 ? 'carrera' : 'carreras' }}</p>
        </div>
        <div v-if="canManage()" class="school-item__actions">
          <button class="school-item__action" type="button" :aria-label="`Editar ${school.name}`" title="Editar" @click="openEdit(school)">✎</button>
          <button class="school-item__action" type="button" :aria-label="`Borrar ${school.name}`" title="Borrar" @click="askDelete(school)">✕</button>
        </div>
      </li>
    </ul>

    <ModalDialog v-if="isModalOpen" wide :title="editing ? 'Editar escuela' : 'Nueva escuela'" @close="closeModal">
      <form class="catalog-form" @submit.prevent="submitForm">
        <label class="catalog-form__field">
          <span>Nombre de la escuela</span>
          <input v-model="form.name" type="text" maxlength="120" placeholder="Ej: Escuela de Derecho" :disabled="isSaving" />
        </label>
        <AdminImagePicker v-model="form.imagenUrl" v-model:alt="form.imagenAlt" label="Imagen" :disabled="isSaving" />
        <p v-if="formError" class="catalog-form__error" role="alert">{{ formError }}</p>
        <button class="btn btn--primary catalog-form__submit" type="submit" :disabled="isSaving">
          {{ isSaving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear escuela' }}
        </button>
      </form>
    </ModalDialog>

    <ModalDialog v-if="pendingDelete" :title="`Borrar ${pendingDelete.name}`" @close="!isDeleting && (pendingDelete = null)">
      <div class="catalog-form">
        <p v-if="(pendingDelete.careerCount ?? 0) > 0">
          Esta escuela tiene {{ pendingDelete.careerCount }} {{ pendingDelete.careerCount === 1 ? 'carrera' : 'carreras' }}.
          No se puede borrar hasta reasignarlas a otra escuela o retirarlas desde el panel de carreras.
        </p>
        <p v-else>Se borrará «{{ pendingDelete.name }}». Esta acción no se puede deshacer.</p>
        <p v-if="deleteError" class="catalog-form__error" role="alert">{{ deleteError }}</p>
        <div class="school-confirm">
          <button class="btn btn--small" type="button" :disabled="isDeleting" @click="pendingDelete = null">Cancelar</button>
          <button class="btn btn--small btn--primary" type="button" :disabled="isDeleting || (pendingDelete.careerCount ?? 0) > 0" @click="confirmDelete">
            {{ isDeleting ? 'Borrando…' : 'Borrar escuela' }}
          </button>
        </div>
      </div>
    </ModalDialog>
  </div>
</template>

<style scoped>
.catalog-manager { display: flex; flex-direction: column; gap: 20px; }
.catalog-manager__toolbar { display: flex; justify-content: flex-end; }
.school-state { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; color: var(--ink-soft); font-size: 14.5px; }
.school-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }
.school-item { display: flex; align-items: center; gap: 14px; padding: 12px 14px; background: var(--paper-2); border: 1px solid var(--line); border-radius: 12px; min-width: 0; }
.school-item__photo { flex-shrink: 0; width: 72px; height: 48px; border-radius: 8px; object-fit: cover; }
.school-item__photo--empty { display: grid; place-items: center; background: var(--gold-bg); color: var(--gold); font-size: 20px; }
.school-item__body { flex: 1; min-width: 0; }
.school-item__body strong { display: block; overflow-wrap: anywhere; color: var(--ink); }
.school-item__body p { margin: 2px 0 0; font-family: var(--mono); font-size: 12px; color: var(--ink-faint); }
.school-item__actions { flex-shrink: 0; display: flex; gap: 6px; }
.school-item__action { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--line-strong); background: var(--paper); color: var(--ink-faint); cursor: pointer; font-size: 12px; }
.school-item__action:hover { border-color: var(--crimson); color: var(--crimson); }
.school-item__action:focus-visible { outline: 2px solid var(--crimson); outline-offset: 2px; }
.school-confirm { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.catalog-form { display: flex; flex-direction: column; gap: 16px; }
.catalog-form__field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--ink-soft); }
.catalog-form__field input { font: inherit; padding: 11px 14px; border-radius: 10px; border: 1.5px solid var(--line-strong); background: var(--paper); color: var(--ink); }
.catalog-form__field input:focus-visible { outline: 2px solid var(--crimson); outline-offset: 2px; }
.catalog-form__error { font-size: 13px; color: var(--crimson-dark); margin: 0; }
.catalog-form__submit { width: 100%; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
