<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { push } from 'notivue'
import { apiRequest } from '../lib/api'
import { useCatalogStore } from '../stores/catalog'
import ModalDialog from './ModalDialog.vue'
import LoadingState from './LoadingState.vue'

const catalog = useCatalogStore()
const isLoading = ref(false)
const deletingId = ref<string | null>(null)

const isModalOpen = ref(false)
const editingId = ref<string | null>(null)
const isSaving = ref(false)
const formError = ref('')
const form = reactive({ name: '', schoolId: '', newSchoolName: '' })

const UNGROUPED = 'Sin escuela asignada'

const groupedCareers = computed(() => {
  const groups = new Map<string, typeof catalog.careers>()
  for (const career of catalog.careers) {
    const key = career.school?.name ?? UNGROUPED
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(career)
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === UNGROUPED) return 1
    if (b === UNGROUPED) return -1
    return a.localeCompare(b)
  })
})

onMounted(async () => {
  isLoading.value = true
  await Promise.all([
    catalog.careers.length ? Promise.resolve() : catalog.loadCareers(),
    catalog.schools.length ? Promise.resolve() : catalog.loadSchools(),
  ])
  isLoading.value = false
})

function openCreateModal() {
  editingId.value = null
  form.name = ''
  form.schoolId = ''
  form.newSchoolName = ''
  formError.value = ''
  isModalOpen.value = true
}

function openEditModal(career: (typeof catalog.careers)[number]) {
  editingId.value = career.id
  form.name = career.name
  form.schoolId = career.school?.id ?? ''
  form.newSchoolName = ''
  formError.value = ''
  isModalOpen.value = true
}

async function submitForm() {
  if (!form.name.trim()) {
    formError.value = 'Ponle un nombre a la carrera.'
    return
  }

  isSaving.value = true
  formError.value = ''
  try {
    let schoolId: string | null = form.schoolId || null

    if (form.newSchoolName.trim()) {
      const created = await apiRequest<{ school: { id: string; name: string } }>('/api/schools', {
        method: 'POST',
        body: JSON.stringify({ name: form.newSchoolName.trim() }),
      })
      schoolId = created.school.id
      await catalog.loadSchools()
    }

    if (editingId.value) {
      await apiRequest(`/api/careers/${editingId.value}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: form.name.trim(), schoolId }),
      })
    } else {
      await apiRequest('/api/careers', {
        method: 'POST',
        body: JSON.stringify({ name: form.name.trim(), schoolId }),
      })
    }
    const savedName = form.name.trim()
    await catalog.loadCareers()
    isModalOpen.value = false
    push.success(
      editingId.value
        ? { title: 'Carrera actualizada', message: `${savedName} quedó guardada.` }
        : { title: 'Carrera creada', message: `${savedName} ya está disponible.` },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar la carrera.'
    formError.value = message
    push.error({ title: 'No se guardó la carrera', message })
  } finally {
    isSaving.value = false
  }
}

async function deleteCareer(id: string) {
  const name = catalog.careers.find((c) => c.id === id)?.name ?? 'La carrera'
  deletingId.value = id
  try {
    await apiRequest(`/api/careers/${id}`, { method: 'DELETE' })
    await catalog.loadCareers()
    push.success({ title: 'Carrera eliminada', message: `${name} se quitó del catálogo.` })
  } catch (error) {
    push.error({
      title: 'No se pudo borrar la carrera',
      message: error instanceof Error ? error.message : 'No se pudo borrar la carrera.',
    })
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="catalog-manager">
    <div class="catalog-manager__toolbar">
      <button class="btn btn--small btn--primary" type="button" @click="openCreateModal">+ Añadir carrera</button>
    </div>

    <LoadingState v-if="isLoading" compact label="Cargando carreras…" />

    <div v-else class="school-groups">
      <section v-for="[schoolName, careers] in groupedCareers" :key="schoolName" class="school-group">
        <h3 class="school-group__title">{{ schoolName }}</h3>
        <ul class="career-list">
          <li v-for="career in careers" :key="career.id" class="career-item">
            <span>{{ career.name }}</span>
            <div class="career-item__actions">
              <button class="career-item__action" type="button" title="Editar" @click="openEditModal(career)">✎</button>
              <button
                class="career-item__action"
                type="button"
                title="Borrar"
                :disabled="deletingId === career.id"
                @click="deleteCareer(career.id)"
              >
                {{ deletingId === career.id ? '…' : '✕' }}
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <ModalDialog v-if="isModalOpen" :title="editingId ? 'Editar carrera' : 'Nueva carrera'" @close="isModalOpen = false">
      <form class="catalog-form" @submit.prevent="submitForm">
        <label class="catalog-form__field">
          <span>Nombre de la carrera</span>
          <input v-model="form.name" type="text" placeholder="Ej: Ingeniería en Sistemas" />
        </label>
        <label class="catalog-form__field">
          <span>Escuela</span>
          <select v-model="form.schoolId" :disabled="!!form.newSchoolName">
            <option value="">Sin escuela asignada</option>
            <option v-for="school in catalog.schools" :key="school.id" :value="school.id">{{ school.name }}</option>
          </select>
        </label>
        <label class="catalog-form__field">
          <span>…o crea una escuela nueva</span>
          <input v-model="form.newSchoolName" type="text" placeholder="Ej: Escuela de Derecho" />
        </label>
        <p v-if="formError" class="catalog-form__error">{{ formError }}</p>
        <button class="btn btn--primary catalog-form__submit" type="submit" :disabled="isSaving">
          {{ isSaving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear carrera' }}
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
}

.career-item__actions {
  flex-shrink: 0;
  display: flex;
  gap: 6px;
}

.career-item__action {
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

.career-item__action:hover {
  border-color: var(--crimson);
  color: var(--crimson);
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

.catalog-form__field input,
.catalog-form__field select {
  font: inherit;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink);
}

.catalog-form__field input:focus,
.catalog-form__field select:focus {
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
