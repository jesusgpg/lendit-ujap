<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { push } from 'notivue'
import type { Category } from '../types'
import { apiRequest } from '../lib/api'
import { isCatalogImageShared, saveWithCatalogImage } from '../lib/catalogImage'
import { removeCatalogImage } from '../lib/storage'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import AdminImagePicker from './AdminImagePicker.vue'
import IconPicker from './IconPicker.vue'
import ModalDialog from './ModalDialog.vue'
import LoadingState from './LoadingState.vue'

const catalog = useCatalogStore()
const auth = useAuthStore()
const canManage = () => auth.hasPermission('categories.manage')
// La búsqueda en Unsplash está alineada con categories.manage.
const canUseUnsplash = () => auth.hasPermission('categories.manage')

type Photo = Pick<Category, 'imagenUrl' | 'imagenAlt' | 'unsplashPhotoId' | 'photographerName' | 'photographerUrl' | 'unsplashUrl'>

const isLoading = ref(false)
const loadError = ref('')
const brokenImages = ref(new Set<string>())

const isModalOpen = ref(false)
const editing = ref<Category | null>(null)
const isSaving = ref(false)
const formError = ref('')
const form = reactive({ label: '', icon: '', blurb: '', imagenUrl: null as string | null, imagenAlt: '' })
const unsplashSelected = ref<Photo | null>(null)
const imageChanged = ref(false)

const photoQuery = ref('')
const photoResults = ref<Photo[]>([])
const photoError = ref('')
const isSearching = ref(false)
let searchVersion = 0

const pendingDelete = ref<Category | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')

async function load() {
  isLoading.value = true
  loadError.value = ''
  try {
    await catalog.loadCategories()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'No se pudieron cargar las categorías.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => { if (catalog.categories.length === 0) void load() })

function resetImageState(category: Category | null) {
  searchVersion++
  photoResults.value = []
  photoError.value = ''
  isSearching.value = false
  photoQuery.value = category?.label ?? ''
  imageChanged.value = false
  form.imagenUrl = category?.imagenUrl ?? null
  form.imagenAlt = category?.imagenAlt ?? ''
  unsplashSelected.value = category?.unsplashPhotoId ? { ...category } : null
}

function openCreateModal() {
  editing.value = null
  form.label = ''
  form.icon = ''
  form.blurb = ''
  resetImageState(null)
  formError.value = ''
  isModalOpen.value = true
}

function openEditModal(category: Category) {
  editing.value = category
  form.label = category.label
  form.icon = category.icon ?? ''
  form.blurb = category.blurb ?? ''
  resetImageState(category)
  formError.value = ''
  isModalOpen.value = true
}

function closeModal() {
  if (isSaving.value) return
  searchVersion++
  isModalOpen.value = false
}

// Cambio manual desde el selector general: deja de ser una foto de Unsplash.
function onPickerUrl(value: string | null) {
  form.imagenUrl = value
  unsplashSelected.value = null
  imageChanged.value = true
}

function onPickerAlt(value: string) {
  form.imagenAlt = value
  imageChanged.value = true
}

async function searchPhotos() {
  const version = ++searchVersion
  photoError.value = ''
  photoResults.value = []
  if (photoQuery.value.trim().length < 2) { photoError.value = 'Escribe al menos dos caracteres.'; return }
  isSearching.value = true
  try {
    const response = await apiRequest<{ photos: Photo[] }>(`/api/categories?action=photos&q=${encodeURIComponent(photoQuery.value.trim())}`)
    if (version === searchVersion) {
      photoResults.value = response.photos
      if (!response.photos.length) photoError.value = 'No encontramos fotos. Prueba otra búsqueda.'
    }
  } catch {
    if (version === searchVersion) photoError.value = 'No pudimos buscar en Unsplash. Revisa la configuración o intenta más tarde.'
  } finally {
    if (version === searchVersion) isSearching.value = false
  }
}

function choosePhoto(photo: Photo) {
  unsplashSelected.value = { ...photo }
  form.imagenUrl = photo.imagenUrl
  form.imagenAlt = photo.imagenAlt ?? ''
  imageChanged.value = true
}

async function submitForm() {
  if (isSaving.value) return
  const label = form.label.trim()
  if (label.length < 2) { formError.value = 'Ponle un nombre a la categoría (mínimo 2 caracteres).'; return }
  if (form.imagenUrl && form.imagenAlt.trim().length < 2) { formError.value = 'Agrega un texto alternativo para la imagen.'; return }

  isSaving.value = true
  formError.value = ''
  const current = editing.value
  const wasEditing = Boolean(current)
  const alt = form.imagenAlt.trim()
  try {
    const previousUrl = imageChanged.value ? current?.imagenUrl ?? null : form.imagenUrl
    const isShared = Boolean(
      previousUrl &&
        isCatalogImageShared(previousUrl, { type: 'category', idOrKey: current?.key ?? '' }, catalog)
    )
    const { cleanupWarning } = await saveWithCatalogImage({
      scope: 'categories',
      previousUrl,
      nextUrl: form.imagenUrl,
      isShared,
      save: (finalUrl) => {
        const image: Record<string, unknown> = {}
        if (imageChanged.value) {
          const photo = unsplashSelected.value
          if (photo && photo.unsplashPhotoId !== current?.unsplashPhotoId) {
            image.unsplashPhotoId = photo.unsplashPhotoId
            image.imagenAlt = alt
          } else if (photo) {
            image.imagenAlt = alt
          } else if (finalUrl) {
            image.imagenUrl = finalUrl
            image.imagenAlt = alt
          } else {
            image.imagenUrl = null
          }
        }
        return apiRequest(current ? `/api/categories/${current.key}` : '/api/categories', {
          method: current ? 'PATCH' : 'POST',
          body: JSON.stringify(current
            ? { label, icon: form.icon.trim() || null, blurb: form.blurb.trim() || null, ...image }
            : { key: label, label, icon: form.icon.trim() || undefined, blurb: form.blurb.trim() || undefined, ...image }),
        })
      },
    })
    await catalog.loadCategories()
    isModalOpen.value = false
    push.success(wasEditing ? { title: 'Categoría actualizada', message: `${label} quedó guardada.` } : { title: 'Categoría creada', message: `${label} ya está en el catálogo.` })
    if (cleanupWarning) push.warning({ title: 'Imagen anterior', message: 'La categoría se guardó, pero no se pudo borrar el archivo anterior.' })
  } catch (error) {
    // Se conserva el borrador abierto para reintentar.
    const message = error instanceof Error ? error.message : 'No se pudo guardar la categoría.'
    formError.value = message
    push.error({ title: 'No se guardó la categoría', message })
  } finally {
    isSaving.value = false
  }
}

function askDelete(category: Category) {
  pendingDelete.value = category
  deleteError.value = ''
}

async function confirmDelete() {
  const category = pendingDelete.value
  if (!category || isDeleting.value) return
  isDeleting.value = true
  deleteError.value = ''
  try {
    await apiRequest(`/api/categories/${category.key}`, { method: 'DELETE' })
    if (
      category.imagenUrl &&
      !isCatalogImageShared(category.imagenUrl, { type: 'category', idOrKey: category.key }, catalog)
    ) {
      await removeCatalogImage(category.imagenUrl).catch(() => undefined)
    }
    await catalog.loadCategories()
    pendingDelete.value = null
    push.success({ title: 'Categoría eliminada', message: `${category.label} se quitó del catálogo.` })
  } catch (error) {
    // CATEGORY_IN_USE (409) se muestra dentro del diálogo, que sigue abierto.
    deleteError.value = error instanceof Error ? error.message : 'No se pudo borrar la categoría.'
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="catalog-manager">
    <div class="catalog-manager__toolbar">
      <button v-if="canManage()" class="btn btn--small btn--primary" type="button" @click="openCreateModal">+ Añadir categoría</button>
    </div>

    <LoadingState v-if="isLoading" compact label="Cargando categorías…" />

    <div v-else-if="loadError" class="catalog-state" role="alert">
      <p>{{ loadError }}</p>
      <button class="btn btn--small" type="button" @click="load">Reintentar</button>
    </div>

    <ul v-else class="catalog-manager__list">
      <li v-for="category in catalog.categories" :key="category.key" class="catalog-item">
        <img v-if="category.imagenUrl && !brokenImages.has(category.key)" class="catalog-item__photo" :src="category.imagenUrl" :alt="category.imagenAlt || category.label" loading="lazy" width="72" height="48" @error="brokenImages.add(category.key)" />
        <span v-else class="catalog-item__icon">{{ category.icon ?? '▤' }}</span>
        <div class="catalog-item__body">
          <strong>{{ category.label }}</strong>
          <p v-if="category.blurb">{{ category.blurb }}</p>
          <p v-if="category.imagenUrl && category.photographerUrl && category.unsplashUrl" class="catalog-item__credit">
            Foto de <a :href="category.photographerUrl" target="_blank" rel="noopener noreferrer">{{ category.photographerName }}</a> en <a :href="category.unsplashUrl" target="_blank" rel="noopener noreferrer">Unsplash</a>
          </p>
        </div>
        <div v-if="canManage()" class="catalog-item__actions">
          <button class="catalog-item__action" type="button" :aria-label="`Editar ${category.label}`" title="Editar" @click="openEditModal(category)">✎</button>
          <button class="catalog-item__action" type="button" :aria-label="`Borrar ${category.label}`" title="Borrar" @click="askDelete(category)">✕</button>
        </div>
      </li>
    </ul>

    <ModalDialog v-if="isModalOpen" wide :title="editing ? 'Editar categoría' : 'Nueva categoría'" @close="closeModal">
      <form class="catalog-form" @submit.prevent="submitForm">
        <div class="catalog-form__row">
          <IconPicker v-model="form.icon" />
          <label class="catalog-form__field catalog-form__field--grow">
            <span>Nombre</span>
            <input v-model="form.label" type="text" maxlength="80" placeholder="Ej: Instrumentos musicales" :disabled="isSaving" />
          </label>
        </div>
        <label class="catalog-form__field">
          <span>Descripción (opcional)</span>
          <input v-model="form.blurb" type="text" maxlength="300" placeholder="Guitarras, teclados, micrófonos…" :disabled="isSaving" />
        </label>

        <AdminImagePicker
          :model-value="form.imagenUrl"
          :alt="form.imagenAlt"
          label="Imagen"
          :disabled="isSaving"
          @update:model-value="onPickerUrl"
          @update:alt="onPickerAlt"
        />

        <div v-if="canUseUnsplash()" class="catalog-form__unsplash">
          <label class="catalog-form__field">
            <span>Buscar en Unsplash (opcional)</span>
            <span class="catalog-form__search">
              <input v-model="photoQuery" type="text" placeholder="Ej: guitarra" :disabled="isSaving" @keydown.enter.prevent="searchPhotos" />
              <button type="button" class="btn btn--small" :disabled="isSaving || isSearching" @click="searchPhotos">{{ isSearching ? 'Buscando…' : 'Buscar' }}</button>
            </span>
          </label>
          <p v-if="photoError" class="catalog-form__error" role="alert">{{ photoError }}</p>
          <ul v-if="photoResults.length" class="catalog-form__photos">
            <li v-for="photo in photoResults" :key="photo.unsplashPhotoId ?? photo.imagenUrl ?? ''">
              <button type="button" class="catalog-form__photo" :class="{ 'catalog-form__photo--on': unsplashSelected?.unsplashPhotoId === photo.unsplashPhotoId }" :aria-pressed="unsplashSelected?.unsplashPhotoId === photo.unsplashPhotoId" :aria-label="`Elegir foto: ${photo.imagenAlt ?? 'sin descripción'}`" @click="choosePhoto(photo)">
                <img :src="photo.imagenUrl ?? ''" alt="" loading="lazy" />
              </button>
            </li>
          </ul>
          <p v-if="unsplashSelected && unsplashSelected.photographerUrl" class="catalog-item__credit">
            Foto de <a :href="unsplashSelected.photographerUrl" target="_blank" rel="noopener noreferrer">{{ unsplashSelected.photographerName }}</a> en <a :href="unsplashSelected.unsplashUrl ?? '#'" target="_blank" rel="noopener noreferrer">Unsplash</a>
          </p>
        </div>

        <p v-if="formError" class="catalog-form__error" role="alert">{{ formError }}</p>
        <button class="btn btn--primary catalog-form__submit" type="submit" :disabled="isSaving">
          {{ isSaving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear categoría' }}
        </button>
      </form>
    </ModalDialog>

    <ModalDialog v-if="pendingDelete" :title="`Borrar ${pendingDelete.label}`" @close="!isDeleting && (pendingDelete = null)">
      <div class="catalog-form">
        <p>Se borrará «{{ pendingDelete.label }}». Si hay objetos publicados en esta categoría no se podrá borrar: muévelos o retíralos primero. Esta acción no se puede deshacer.</p>
        <p v-if="deleteError" class="catalog-form__error" role="alert">{{ deleteError }}</p>
        <div class="catalog-confirm">
          <button class="btn btn--small" type="button" :disabled="isDeleting" @click="pendingDelete = null">Cancelar</button>
          <button class="btn btn--small btn--primary" type="button" :disabled="isDeleting" @click="confirmDelete">{{ isDeleting ? 'Borrando…' : 'Borrar categoría' }}</button>
        </div>
      </div>
    </ModalDialog>
  </div>
</template>

<style scoped>
.catalog-manager { display: flex; flex-direction: column; gap: 20px; }
.catalog-manager__toolbar { display: flex; justify-content: flex-end; }
.catalog-state { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; color: var(--ink-soft); font-size: 14px; }
.catalog-manager__list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.catalog-item { position: relative; display: flex; align-items: flex-start; gap: 14px; padding: 16px 18px; border-radius: 14px; background: var(--paper-2); border: 1px solid var(--line); min-width: 0; }
.catalog-item__icon { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 10px; background: var(--crimson-bg); color: var(--crimson-dark); font-size: 17px; }
.catalog-item__photo { flex-shrink: 0; width: 72px; height: 48px; border-radius: 8px; object-fit: cover; }
.catalog-item__body { flex: 1; min-width: 0; }
.catalog-item__body strong { display: block; font-size: 14.5px; color: var(--ink); overflow-wrap: anywhere; }
.catalog-item__body p { margin: 3px 0 0; font-size: 12.5px; color: var(--ink-faint); line-height: 1.4; }
.catalog-item__credit { margin: 3px 0 0; font-size: 12px; color: var(--ink-faint); }
.catalog-item__credit a { color: inherit; text-decoration: underline; }
.catalog-item__actions { flex-shrink: 0; display: flex; gap: 6px; }
.catalog-item__action { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--line-strong); background: var(--paper); color: var(--ink-faint); cursor: pointer; font-size: 12px; transition: all 0.15s ease; }
.catalog-item__action:hover { border-color: var(--crimson); color: var(--crimson); }
.catalog-item__action:focus-visible { outline: 2px solid var(--crimson); outline-offset: 2px; }

/* ---------- modal form ---------- */
.catalog-form { display: flex; flex-direction: column; gap: 16px; }
.catalog-form__row { display: flex; gap: 12px; align-items: flex-end; }
.catalog-form__field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--ink-soft); }
.catalog-form__field--grow { flex: 1; }
.catalog-form__field input { font: inherit; padding: 11px 14px; border-radius: 10px; border: 1.5px solid var(--line-strong); background: var(--paper); color: var(--ink); min-width: 0; }
.catalog-form__field input:focus-visible { outline: 2px solid var(--crimson); outline-offset: 2px; }
.catalog-form__error { margin: 0; font-size: 13px; color: var(--crimson-dark); }
.catalog-form__submit { width: 100%; }
.catalog-form__unsplash { display: flex; flex-direction: column; gap: 10px; }
.catalog-form__search { display: flex; gap: 8px; flex-wrap: wrap; font-weight: 400; }
.catalog-form__search input { flex: 1 1 180px; }
.catalog-form__photos { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.catalog-form__photo { display: block; width: 100%; padding: 0; border: 2px solid transparent; border-radius: 10px; background: none; cursor: pointer; overflow: hidden; }
.catalog-form__photo img { display: block; width: 100%; aspect-ratio: 3 / 2; object-fit: cover; }
.catalog-form__photo--on { border-color: var(--crimson); }
.catalog-form__photo:focus-visible { outline: 2px solid var(--crimson); outline-offset: 2px; }
.catalog-confirm { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }

@media (max-width: 560px) { .catalog-form__row { flex-direction: column; align-items: stretch; } }
@media (prefers-reduced-motion: reduce) { .catalog-item__action { transition: none; } }
</style>
