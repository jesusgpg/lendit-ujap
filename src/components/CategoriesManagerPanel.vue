<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { push } from 'notivue'
import { apiRequest } from '../lib/api'
import { useCatalogStore } from '../stores/catalog'
import ModalDialog from './ModalDialog.vue'
import IconPicker from './IconPicker.vue'
import LoadingState from './LoadingState.vue'

const catalog = useCatalogStore()
const isLoading = ref(false)
const deletingKey = ref<string | null>(null)

const isModalOpen = ref(false)
const editingKey = ref<string | null>(null)
const isSaving = ref(false)
const formError = ref('')
const form = reactive({ label: '', icon: '', blurb: '' })

onMounted(async () => {
  if (catalog.categories.length === 0) {
    isLoading.value = true
    await catalog.loadCategories()
    isLoading.value = false
  }
})

function openCreateModal() {
  editingKey.value = null
  form.label = ''
  form.icon = ''
  form.blurb = ''
  formError.value = ''
  isModalOpen.value = true
}

function openEditModal(category: { key: string; label: string; icon: string | null; blurb: string | null }) {
  editingKey.value = category.key
  form.label = category.label
  form.icon = category.icon ?? ''
  form.blurb = category.blurb ?? ''
  formError.value = ''
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
}

async function submitForm() {
  if (!form.label.trim()) {
    formError.value = 'Ponle un nombre a la categoría.'
    return
  }

  isSaving.value = true
  formError.value = ''
  try {
    if (editingKey.value) {
      await apiRequest(`/api/categories/${editingKey.value}`, {
        method: 'PATCH',
        body: JSON.stringify({
          label: form.label.trim(),
          icon: form.icon.trim() || null,
          blurb: form.blurb.trim() || null,
        }),
      })
    } else {
      await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          key: form.label.trim(),
          label: form.label.trim(),
          icon: form.icon.trim() || undefined,
          blurb: form.blurb.trim() || undefined,
        }),
      })
    }
    const savedLabel = form.label.trim()
    await catalog.loadCategories()
    isModalOpen.value = false
    push.success(
      editingKey.value
        ? { title: 'Categoría actualizada', message: `${savedLabel} quedó guardada.` }
        : { title: 'Categoría creada', message: `${savedLabel} ya está en el catálogo.` },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar la categoría.'
    formError.value = message
    push.error({ title: 'No se guardó la categoría', message })
  } finally {
    isSaving.value = false
  }
}

async function deleteCategory(key: string) {
  const label = catalog.categories.find((c) => c.key === key)?.label ?? key
  deletingKey.value = key
  try {
    await apiRequest(`/api/categories/${key}`, { method: 'DELETE' })
    await catalog.loadCategories()
    push.success({ title: 'Categoría eliminada', message: `${label} se quitó del catálogo.` })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo borrar.'
    formError.value = message
    push.error({ title: 'No se pudo borrar la categoría', message })
  } finally {
    deletingKey.value = null
  }
}
</script>

<template>
  <div class="catalog-manager">
    <div class="catalog-manager__toolbar">
      <button class="btn btn--small btn--primary" type="button" @click="openCreateModal">+ Añadir categoría</button>
    </div>

    <LoadingState v-if="isLoading" compact label="Cargando categorías…" />

    <ul v-else class="catalog-manager__list">
      <li v-for="category in catalog.categories" :key="category.key" class="catalog-item">
        <span class="catalog-item__icon">{{ category.icon ?? '▤' }}</span>
        <div class="catalog-item__body">
          <strong>{{ category.label }}</strong>
          <p v-if="category.blurb">{{ category.blurb }}</p>
        </div>
        <div class="catalog-item__actions">
          <button class="catalog-item__action" type="button" title="Editar" @click="openEditModal(category)">✎</button>
          <button
            class="catalog-item__action"
            type="button"
            title="Borrar"
            :disabled="deletingKey === category.key"
            @click="deleteCategory(category.key)"
          >
            {{ deletingKey === category.key ? '…' : '✕' }}
          </button>
        </div>
      </li>
    </ul>

    <ModalDialog
      v-if="isModalOpen"
      wide
      :title="editingKey ? 'Editar categoría' : 'Nueva categoría'"
      @close="closeModal"
    >
      <form class="catalog-form" @submit.prevent="submitForm">
        <div class="catalog-form__row">
          <IconPicker v-model="form.icon" />
          <label class="catalog-form__field catalog-form__field--grow">
            <span>Nombre</span>
            <input v-model="form.label" type="text" placeholder="Ej: Instrumentos musicales" />
          </label>
        </div>
        <label class="catalog-form__field">
          <span>Descripción (opcional)</span>
          <input v-model="form.blurb" type="text" placeholder="Guitarras, teclados, micrófonos…" />
        </label>
        <p v-if="formError" class="catalog-form__error">{{ formError }}</p>
        <button class="btn btn--primary catalog-form__submit" type="submit" :disabled="isSaving">
          {{ isSaving ? 'Guardando…' : editingKey ? 'Guardar cambios' : 'Crear categoría' }}
        </button>
      </form>
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

.catalog-manager__hint {
  font-size: 14px;
  color: var(--ink-faint);
}

.catalog-manager__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.catalog-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 14px;
  background: var(--paper-2);
  border: 1px solid var(--line);
}

.catalog-item__icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--crimson-bg);
  color: var(--crimson-dark);
  font-size: 17px;
}

.catalog-item__body {
  flex: 1;
  min-width: 0;
}

.catalog-item__body strong {
  display: block;
  font-size: 14.5px;
  color: var(--ink);
}

.catalog-item__body p {
  margin: 3px 0 0;
  font-size: 12.5px;
  color: var(--ink-faint);
  line-height: 1.4;
}

.catalog-item__actions {
  flex-shrink: 0;
  display: flex;
  gap: 6px;
}

.catalog-item__action {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink-faint);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}

.catalog-item__action:hover {
  border-color: var(--crimson);
  color: var(--crimson);
}

/* ---------- modal form ---------- */
.catalog-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.catalog-form__row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.catalog-form__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-soft);
}

.catalog-form__field--grow {
  flex: 1;
}

.catalog-form__field input {
  font: inherit;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink);
}

.catalog-form__field input:focus {
  outline: none;
  border-color: var(--crimson);
}

.catalog-form__error {
  font-size: 13px;
  color: var(--crimson-dark);
}

.catalog-form__submit {
  width: 100%;
}
</style>
