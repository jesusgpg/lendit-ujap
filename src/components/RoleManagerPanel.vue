<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { push } from 'notivue'
import { apiRequest } from '../lib/api'
import { useCatalogStore } from '../stores/catalog'
import { isProtectedRole, roleLabel } from '../lib/roleLabels'
import ModalDialog from './ModalDialog.vue'
import LoadingState from './LoadingState.vue'

interface Permission {
  key: string
  description: string | null
}

const catalog = useCatalogStore()
const permissions = ref<Permission[]>([])
const isLoading = ref(false)
const loadError = ref('')
const savingRoleId = ref<string | null>(null)
const savedRoleId = ref<string | null>(null)
const deletingRoleId = ref<string | null>(null)
const deleteErrorByRole = ref<Record<string, string>>({})
const saveErrorByRole = ref<Record<string, string>>({})
const newRoleName = ref('')
const newRoleError = ref('')
const isCreatingRole = ref(false)
const isCreateModalOpen = ref(false)
const pendingDelete = ref<{ id: string; name: string } | null>(null)

// Borrador local por rol: el catálogo solo cambia después de que el servidor confirma el guardado.
interface RoleDraft { permissions: string[]; description: string }
const drafts = ref<Record<string, RoleDraft>>({})

function resetDraft(roleId: string) {
  const role = catalog.roles.find((r) => r.id === roleId)
  if (!role) return
  drafts.value = { ...drafts.value, [roleId]: { permissions: [...role.permissions], description: role.description ?? '' } }
}

function resetAllDrafts() {
  drafts.value = {}
  for (const role of catalog.roles) resetDraft(role.id)
}

function isDirty(roleId: string) {
  const role = catalog.roles.find((r) => r.id === roleId)
  const draft = drafts.value[roleId]
  if (!role || !draft) return false
  const a = [...role.permissions].sort().join('|')
  const b = [...draft.permissions].sort().join('|')
  return a !== b || draft.description.trim() !== (role.description ?? '')
}

async function load() {
  isLoading.value = true
  loadError.value = ''
  try {
    const [permissionsResponse] = await Promise.all([
      apiRequest<{ permissions: Permission[] }>('/api/permissions'),
      catalog.loadRoles(),
    ])
    permissions.value = permissionsResponse.permissions
    resetAllDrafts()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'No se pudieron cargar los roles.'
  } finally {
    isLoading.value = false
  }
}

onMounted(load)

function togglePermission(roleId: string, key: string) {
  const draft = drafts.value[roleId]
  if (!draft) return
  draft.permissions = draft.permissions.includes(key)
    ? draft.permissions.filter((p) => p !== key)
    : [...draft.permissions, key]
}

async function saveRole(roleId: string) {
  const role = catalog.roles.find((r) => r.id === roleId)
  const draft = drafts.value[roleId]
  if (!role || !draft || savingRoleId.value) return

  savingRoleId.value = roleId
  savedRoleId.value = null
  saveErrorByRole.value = { ...saveErrorByRole.value, [roleId]: '' }
  try {
    await apiRequest(`/api/roles/${roleId}`, {
      method: 'PATCH',
      body: JSON.stringify({ permissionKeys: draft.permissions, description: draft.description.trim() }),
    })
    await catalog.loadRoles()
    resetDraft(roleId)
    savedRoleId.value = roleId
    push.success({
      title: 'Rol actualizado',
      message: `El rol ${roleLabel(role.name)} quedó guardado.`,
    })
    setTimeout(() => {
      if (savedRoleId.value === roleId) savedRoleId.value = null
    }, 2000)
  } catch (error) {
    // El borrador se conserva para poder reintentar.
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el rol.'
    saveErrorByRole.value = { ...saveErrorByRole.value, [roleId]: message }
    push.error({ title: 'No se guardó el rol', message })
  } finally {
    savingRoleId.value = null
  }
}

async function createRole() {
  if (!newRoleName.value.trim()) {
    newRoleError.value = 'Ponle un nombre al rol nuevo.'
    return
  }

  isCreatingRole.value = true
  newRoleError.value = ''
  try {
    await apiRequest('/api/roles', {
      method: 'POST',
      body: JSON.stringify({ name: newRoleName.value.trim(), permissionKeys: [] }),
    })
    const createdName = newRoleName.value.trim()
    newRoleName.value = ''
    await catalog.loadRoles()
    resetAllDrafts()
    isCreateModalOpen.value = false
    push.success({
      title: 'Rol creado',
      message: `${roleLabel(createdName)} ya está disponible para asignar.`,
    })
  } catch (error) {
    newRoleError.value = error instanceof Error ? error.message : 'No se pudo crear el rol.'
    push.error({
      title: 'No se creó el rol',
      message: error instanceof Error ? error.message : 'No se pudo crear el rol.',
    })
  } finally {
    isCreatingRole.value = false
  }
}

function openCreateModal() {
  newRoleName.value = ''
  newRoleError.value = ''
  isCreateModalOpen.value = true
}

async function deleteRole(roleId: string) {
  const role = catalog.roles.find((r) => r.id === roleId)
  if (deletingRoleId.value) return
  deletingRoleId.value = roleId
  deleteErrorByRole.value = { ...deleteErrorByRole.value, [roleId]: '' }
  try {
    await apiRequest(`/api/roles/${roleId}`, { method: 'DELETE' })
    await catalog.loadRoles()
    resetAllDrafts()
    pendingDelete.value = null
    if (role) {
      push.success({
        title: 'Rol eliminado',
        message: `El rol ${roleLabel(role.name)} se borró del catálogo.`,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo borrar el rol.'
    deleteErrorByRole.value = { ...deleteErrorByRole.value, [roleId]: message }
  } finally {
    deletingRoleId.value = null
  }
}
</script>

<template>
  <div class="roles">
    <div class="roles__toolbar">
      <button class="btn btn--small btn--primary" type="button" @click="openCreateModal">+ Añadir rol</button>
    </div>

    <LoadingState v-if="isLoading" label="Cargando roles…" />

    <div v-else-if="loadError" class="roles__error" role="alert">
      <p>{{ loadError }}</p>
      <button class="btn btn--small" type="button" @click="load">Reintentar</button>
    </div>

    <div v-else class="roles__grid">
      <article v-for="role in catalog.roles" :key="role.id" class="role-card">
        <header class="role-card__header">
          <span class="role-card__seal">{{ roleLabel(role.name).slice(0, 2) }}</span>
          <div class="role-card__heading">
            <h2>{{ roleLabel(role.name) }}</h2>
          </div>
          <button
            v-if="!isProtectedRole(role.name)"
            class="role-card__delete"
            type="button"
            :aria-label="`Borrar rol ${roleLabel(role.name)}`"
            title="Borrar rol"
            :disabled="deletingRoleId === role.id"
            @click="pendingDelete = { id: role.id, name: role.name }"
          >
            ✕
          </button>
        </header>
        <label v-if="drafts[role.id]" class="role-card__description">
          <span>Descripción</span>
          <input v-model="drafts[role.id].description" type="text" maxlength="300" placeholder="Para qué sirve este rol" :disabled="savingRoleId === role.id" />
        </label>

        <ul v-if="drafts[role.id]" class="role-card__permissions">
          <li v-for="permission in permissions" :key="permission.key">
            <label class="permission-toggle" :class="{ 'permission-toggle--on': drafts[role.id].permissions.includes(permission.key) }">
              <input
                type="checkbox"
                :checked="drafts[role.id].permissions.includes(permission.key)"
                :disabled="savingRoleId === role.id"
                @change="togglePermission(role.id, permission.key)"
              />
              <span class="permission-toggle__switch" aria-hidden="true">
                <span class="permission-toggle__thumb"></span>
              </span>
              <span class="permission-toggle__label">{{ permission.description ?? permission.key }}</span>
            </label>
          </li>
        </ul>

        <p v-if="saveErrorByRole[role.id]" class="role-card__error" role="alert">{{ saveErrorByRole[role.id] }}</p>

        <footer class="role-card__footer">
          <button
            class="btn btn--small"
            :class="savedRoleId === role.id ? 'btn--paper' : 'btn--primary'"
            type="button"
            :disabled="savingRoleId === role.id || (!isDirty(role.id) && savedRoleId !== role.id)"
            @click="saveRole(role.id)"
          >
            {{ savingRoleId === role.id ? 'Guardando…' : savedRoleId === role.id ? '✓ Guardado' : 'Guardar cambios' }}
          </button>
          <button
            v-if="isDirty(role.id)"
            class="btn btn--small"
            type="button"
            :disabled="savingRoleId === role.id"
            @click="resetDraft(role.id); saveErrorByRole[role.id] = ''"
          >
            Cancelar
          </button>
        </footer>
      </article>
    </div>

    <ModalDialog v-if="pendingDelete" :title="`Borrar rol ${roleLabel(pendingDelete.name)}`" @close="deletingRoleId || (pendingDelete = null)">
      <div class="roles__new">
        <p>Se borrará el rol «{{ roleLabel(pendingDelete.name) }}». Si hay usuarios con este rol no se podrá borrar: cámbiales el rol primero. Esta acción no se puede deshacer.</p>
        <p v-if="deleteErrorByRole[pendingDelete.id]" class="roles__error" role="alert">{{ deleteErrorByRole[pendingDelete.id] }}</p>
        <div class="roles__confirm">
          <button class="btn btn--small" type="button" :disabled="!!deletingRoleId" @click="pendingDelete = null">Cancelar</button>
          <button class="btn btn--small btn--primary" type="button" :disabled="!!deletingRoleId" @click="deleteRole(pendingDelete.id)">{{ deletingRoleId ? 'Borrando…' : 'Borrar rol' }}</button>
        </div>
      </div>
    </ModalDialog>

    <ModalDialog v-if="isCreateModalOpen" title="Nuevo rol" @close="isCreateModalOpen = false">
      <form class="roles__new" @submit.prevent="createRole">
        <label class="roles__new-field">
          <span class="roles__new-label">Nombre del rol</span>
          <input v-model="newRoleName" type="text" placeholder="Ej: Bibliotecario" />
        </label>
        <p v-if="newRoleError" class="roles__error">{{ newRoleError }}</p>
        <button class="btn btn--primary roles__new-submit" type="submit" :disabled="isCreatingRole">
          {{ isCreatingRole ? 'Creando…' : 'Crear rol' }}
        </button>
      </form>
    </ModalDialog>
  </div>
</template>

<style scoped>
.role-card__description { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); }
.role-card__description input { font: inherit; font-weight: 400; padding: 9px 12px; border-radius: 10px; border: 1.5px solid var(--line-strong); background: var(--paper); color: var(--ink); }
.role-card__description input:focus-visible, .permission-toggle input:focus-visible + .permission-toggle__switch { outline: 2px solid var(--crimson); outline-offset: 2px; }
.role-card__footer { display: flex; gap: 8px; flex-wrap: wrap; }
.roles__confirm { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.roles {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.roles__toolbar {
  display: flex;
  justify-content: flex-end;
}

.roles__hint {
  font-size: 14px;
  color: var(--ink-faint);
}

.roles__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.role-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 26px;
  border-radius: 18px;
  background: var(--paper-2);
  border: 1px solid var(--line);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.role-card:hover {
  border-color: var(--gold-light);
  box-shadow: var(--shadow-soft);
}

.role-card__header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.role-card__seal {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1.5px solid var(--gold-light);
  font-family: var(--display);
  font-weight: 650;
  font-size: 14px;
  color: var(--gold);
  text-transform: uppercase;
}

.role-card__header h2 {
  font-size: 18px;
  margin: 0;
}

.role-card__header p {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--ink-faint);
}

.role-card__heading {
  flex: 1;
  min-width: 0;
}

.role-card__delete {
  flex-shrink: 0;
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

.role-card__delete:hover {
  border-color: var(--crimson);
  color: var(--crimson);
}

.role-card__error {
  font-size: 12px;
  color: var(--crimson-dark);
  margin: 0;
}

.role-card__permissions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.permission-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.permission-toggle:hover {
  background: color-mix(in srgb, var(--paper) 60%, transparent);
}

.permission-toggle--on {
  background: color-mix(in srgb, var(--crimson-bg) 60%, transparent);
}

.permission-toggle--on:hover {
  background: var(--crimson-bg);
}

.permission-toggle input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.permission-toggle__switch {
  flex-shrink: 0;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--line-strong);
  position: relative;
  transition: background 0.2s ease;
}

.permission-toggle--on .permission-toggle__switch {
  background: var(--crimson);
}

.permission-toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--paper);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.permission-toggle--on .permission-toggle__thumb {
  transform: translateX(14px);
}

.permission-toggle__label {
  font-size: 13.5px;
  color: var(--ink-soft);
  line-height: 1.4;
}

.permission-toggle--on .permission-toggle__label {
  color: var(--ink);
  font-weight: 600;
}

.role-card__footer {
  margin-top: auto;
  padding-top: 4px;
}

.roles__new {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.roles__new-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.roles__new-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-soft);
}

.roles__new-field input {
  font: inherit;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink);
}

.roles__new-field input:focus {
  outline: none;
  border-color: var(--crimson);
}

.roles__new-submit {
  width: 100%;
}

.roles__error {
  font-size: 13px;
  color: var(--crimson-dark);
}
</style>
