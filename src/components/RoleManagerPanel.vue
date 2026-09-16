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
const savingRoleId = ref<string | null>(null)
const savedRoleId = ref<string | null>(null)
const deletingRoleId = ref<string | null>(null)
const deleteErrorByRole = ref<Record<string, string>>({})
const newRoleName = ref('')
const newRoleError = ref('')
const isCreatingRole = ref(false)
const isCreateModalOpen = ref(false)

onMounted(async () => {
  isLoading.value = true
  try {
    const [permissionsResponse] = await Promise.all([
      apiRequest<{ permissions: Permission[] }>('/api/permissions'),
      catalog.loadRoles(),
    ])
    permissions.value = permissionsResponse.permissions
  } finally {
    isLoading.value = false
  }
})

function togglePermission(roleId: string, key: string) {
  const role = catalog.roles.find((r) => r.id === roleId)
  if (!role) return
  role.permissions = role.permissions.includes(key)
    ? role.permissions.filter((p) => p !== key)
    : [...role.permissions, key]
}

async function saveRole(roleId: string) {
  const role = catalog.roles.find((r) => r.id === roleId)
  if (!role) return

  savingRoleId.value = roleId
  savedRoleId.value = null
  try {
    await apiRequest(`/api/roles/${roleId}`, {
      method: 'PATCH',
      body: JSON.stringify({ permissionKeys: role.permissions }),
    })
    savedRoleId.value = roleId
    push.success({
      title: 'Permisos actualizados',
      message: `El rol ${roleLabel(role.name)} quedó guardado.`,
    })
    setTimeout(() => {
      if (savedRoleId.value === roleId) savedRoleId.value = null
    }, 2000)
  } catch (error) {
    push.error({
      title: 'No se guardaron los permisos',
      message: error instanceof Error ? error.message : 'No se pudo actualizar el rol.',
    })
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
  deletingRoleId.value = roleId
  deleteErrorByRole.value = { ...deleteErrorByRole.value, [roleId]: '' }
  try {
    await apiRequest(`/api/roles/${roleId}`, { method: 'DELETE' })
    await catalog.loadRoles()
    if (role) {
      push.success({
        title: 'Rol eliminado',
        message: `El rol ${roleLabel(role.name)} se borró del catálogo.`,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo borrar el rol.'
    deleteErrorByRole.value = { ...deleteErrorByRole.value, [roleId]: message }
    push.error({ title: 'No se pudo borrar el rol', message })
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

    <div v-else class="roles__grid">
      <article v-for="role in catalog.roles" :key="role.id" class="role-card">
        <header class="role-card__header">
          <span class="role-card__seal">{{ roleLabel(role.name).slice(0, 2) }}</span>
          <div class="role-card__heading">
            <h2>{{ roleLabel(role.name) }}</h2>
            <p v-if="role.description">{{ role.description }}</p>
          </div>
          <button
            v-if="!isProtectedRole(role.name)"
            class="role-card__delete"
            type="button"
            title="Borrar rol"
            :disabled="deletingRoleId === role.id"
            @click="deleteRole(role.id)"
          >
            {{ deletingRoleId === role.id ? '…' : '✕' }}
          </button>
        </header>
        <p v-if="deleteErrorByRole[role.id]" class="role-card__error">{{ deleteErrorByRole[role.id] }}</p>

        <ul class="role-card__permissions">
          <li v-for="permission in permissions" :key="permission.key">
            <label class="permission-toggle" :class="{ 'permission-toggle--on': role.permissions.includes(permission.key) }">
              <input
                type="checkbox"
                :checked="role.permissions.includes(permission.key)"
                @change="togglePermission(role.id, permission.key)"
              />
              <span class="permission-toggle__switch" aria-hidden="true">
                <span class="permission-toggle__thumb"></span>
              </span>
              <span class="permission-toggle__label">{{ permission.description ?? permission.key }}</span>
            </label>
          </li>
        </ul>

        <footer class="role-card__footer">
          <button
            class="btn btn--small"
            :class="savedRoleId === role.id ? 'btn--paper' : 'btn--primary'"
            type="button"
            :disabled="savingRoleId === role.id"
            @click="saveRole(role.id)"
          >
            {{ savingRoleId === role.id ? 'Guardando…' : savedRoleId === role.id ? '✓ Guardado' : 'Guardar cambios' }}
          </button>
        </footer>
      </article>
    </div>

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
  margin: -12px 0 0;
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
