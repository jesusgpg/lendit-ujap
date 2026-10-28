<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { push } from 'notivue'
import { apiRequest } from '../lib/api'
import { useCatalogStore } from '../stores/catalog'
import { roleLabel } from '../lib/roleLabels'
import LoadingState from './LoadingState.vue'
import ModalDialog from './ModalDialog.vue'

interface AdminUser {
  id: string
  name: string
  email: string
  career: string
  role: { id: string; name: string }
  isActive: boolean
}

const catalog = useCatalogStore()
const users = ref<AdminUser[]>([])
const isLoading = ref(false)
const loadError = ref('')
const query = ref('')
const page = ref(1)
const total = ref(0)
const pageSize = ref(25)
const savingUserId = ref<string | null>(null)
const savedUserId = ref<string | null>(null)
const resettingUserId = ref<string | null>(null)
const resetMessageByUser = ref<Record<string, string>>({})
const rowErrorByUser = ref<Record<string, string>>({})
const pendingDisable = ref<AdminUser | null>(null)
let loadVersion = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

async function loadUsers() {
  const version = ++loadVersion
  isLoading.value = true
  loadError.value = ''
  try {
    const params = new URLSearchParams({ page: String(page.value) })
    if (query.value.trim()) params.set('q', query.value.trim())
    const [usersResponse] = await Promise.all([
      apiRequest<{ users: AdminUser[]; total: number; pageSize: number }>(`/api/users?${params}`),
      catalog.roles.length ? Promise.resolve() : catalog.loadRoles(),
    ])
    if (version !== loadVersion) return
    users.value = usersResponse.users
    total.value = usersResponse.total
    pageSize.value = usersResponse.pageSize
  } catch (error) {
    if (version === loadVersion) loadError.value = error instanceof Error ? error.message : 'No se pudieron cargar los usuarios.'
  } finally {
    if (version === loadVersion) isLoading.value = false
  }
}

function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; void loadUsers() }, 300)
}

function goToPage(next: number) {
  page.value = Math.min(pageCount.value, Math.max(1, next))
  void loadUsers()
}

onMounted(loadUsers)
onBeforeUnmount(() => clearTimeout(searchTimer))

function flashSaved(userId: string) {
  savedUserId.value = userId
  setTimeout(() => {
    if (savedUserId.value === userId) savedUserId.value = null
  }, 2000)
}

async function changeRole(user: AdminUser, roleId: string, selectEl?: HTMLSelectElement) {
  if (roleId === user.role.id || savingUserId.value) return

  savingUserId.value = user.id
  savedUserId.value = null
  rowErrorByUser.value = { ...rowErrorByUser.value, [user.id]: '' }
  try {
    await apiRequest(`/api/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ roleId }),
    })
    const role = catalog.roles.find((r) => r.id === roleId)
    if (role) {
      user.role = { id: role.id, name: role.name }
    }
    flashSaved(user.id)
    push.success({
      title: 'Rol actualizado',
      message: `${user.name} ahora es ${roleLabel(user.role.name)}.`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el rol.'
    // El servidor rechazó el cambio: se restaura el valor mostrado.
    if (selectEl) selectEl.value = user.role.id
    rowErrorByUser.value = { ...rowErrorByUser.value, [user.id]: message }
    push.error({ title: 'No se pudo cambiar el rol', message })
  } finally {
    savingUserId.value = null
  }
}

function requestToggle(user: AdminUser) {
  if (user.isActive) pendingDisable.value = user
  else void toggleActive(user)
}

async function toggleActive(user: AdminUser) {
  if (savingUserId.value) return
  savingUserId.value = user.id
  rowErrorByUser.value = { ...rowErrorByUser.value, [user.id]: '' }
  try {
    await apiRequest(`/api/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    user.isActive = !user.isActive
    pendingDisable.value = null
    flashSaved(user.id)
    push.success(
      user.isActive
        ? { title: 'Cuenta habilitada', message: `${user.name} puede volver a entrar.` }
        : { title: 'Cuenta deshabilitada', message: `${user.name} ya no puede iniciar sesión.` },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cambiar el estado.'
    rowErrorByUser.value = { ...rowErrorByUser.value, [user.id]: message }
    pendingDisable.value = null
    push.error({ title: 'No se pudo actualizar la cuenta', message })
  } finally {
    savingUserId.value = null
  }
}

async function sendPasswordReset(user: AdminUser) {
  resettingUserId.value = user.id
  resetMessageByUser.value = { ...resetMessageByUser.value, [user.id]: '' }
  try {
    await apiRequest(`/api/users/${user.id}/reset-password`, { method: 'POST' })
    resetMessageByUser.value = { ...resetMessageByUser.value, [user.id]: 'Correo de reinicio enviado.' }
    push.success({
      title: 'Correo enviado',
      message: `Enviamos el enlace de reinicio a ${user.email}.`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo enviar el correo.'
    resetMessageByUser.value = { ...resetMessageByUser.value, [user.id]: message }
    push.error({ title: 'No se envió el correo', message })
  } finally {
    resettingUserId.value = null
    setTimeout(() => {
      resetMessageByUser.value = { ...resetMessageByUser.value, [user.id]: '' }
    }, 4000)
  }
}
</script>

<template>
  <div class="users">
    <label class="users__search">
      <span>Buscar usuario</span>
      <input v-model="query" type="search" maxlength="100" placeholder="Nombre o correo" @input="onSearchInput" />
    </label>

    <LoadingState v-if="isLoading" label="Cargando usuarios…" />
    <div v-else-if="loadError" class="users__hint" role="alert">
      <p>{{ loadError }}</p>
      <button class="btn btn--small" type="button" @click="loadUsers">Reintentar</button>
    </div>
    <p v-else-if="users.length === 0" class="users__hint">{{ query ? 'Ningún usuario coincide con la búsqueda.' : 'No hay usuarios registrados todavía.' }}</p>

    <ul v-else class="users__list">
      <li v-for="user in users" :key="user.id" class="user-row" :class="{ 'user-row--disabled': !user.isActive }">
        <div class="user-row__identity">
          <span class="user-row__avatar">{{ user.name.charAt(0) }}</span>
          <div class="user-row__names">
            <strong>{{ user.name }}</strong>
            <span class="user-row__email">{{ user.email }}</span>
            <span class="user-row__career">{{ user.career }}</span>
          </div>
        </div>

        <div class="user-row__controls">
          <select
            class="user-row__role-select"
            :value="user.role.id"
            :disabled="savingUserId === user.id"
            @change="changeRole(user, ($event.target as HTMLSelectElement).value, $event.target as HTMLSelectElement)"
          >
            <option v-for="role in catalog.roles" :key="role.id" :value="role.id">{{ roleLabel(role.name) }}</option>
          </select>

          <button
            class="btn btn--small btn--ghost"
            type="button"
            :disabled="resettingUserId === user.id"
            @click="sendPasswordReset(user)"
          >
            {{ resettingUserId === user.id ? 'Enviando…' : 'Reiniciar clave' }}
          </button>

          <button
            class="btn btn--small"
            :class="user.isActive ? 'user-row__disable-btn' : 'btn--primary'"
            type="button"
            :disabled="savingUserId === user.id"
            @click="requestToggle(user)"
          >
            {{ user.isActive ? 'Deshabilitar' : 'Habilitar' }}
          </button>
        </div>

        <p v-if="rowErrorByUser[user.id]" class="user-row__status user-row__status--error" role="alert">{{ rowErrorByUser[user.id] }}</p>
        <p v-if="savedUserId === user.id" class="user-row__status user-row__status--ok">✓ Guardado</p>
        <p v-if="resetMessageByUser[user.id]" class="user-row__status">{{ resetMessageByUser[user.id] }}</p>
        <span v-if="!user.isActive" class="user-row__badge">Deshabilitado</span>
      </li>
    </ul>

    <nav v-if="!isLoading && !loadError && total > pageSize" class="users__pager" aria-label="Paginación de usuarios">
      <button class="btn btn--small" type="button" :disabled="page <= 1" @click="goToPage(page - 1)">Anterior</button>
      <span>Página {{ page }} de {{ pageCount }} · {{ total }} usuarios</span>
      <button class="btn btn--small" type="button" :disabled="page >= pageCount" @click="goToPage(page + 1)">Siguiente</button>
    </nav>

    <ModalDialog v-if="pendingDisable" :title="`Deshabilitar a ${pendingDisable.name}`" @close="savingUserId || (pendingDisable = null)">
      <div class="users__confirm">
        <p>{{ pendingDisable.name }} ya no podrá iniciar sesión. Su historial de préstamos, conversaciones y pagos se conserva y puedes habilitarla de nuevo.</p>
        <div class="users__confirm-actions">
          <button class="btn btn--small" type="button" :disabled="!!savingUserId" @click="pendingDisable = null">Cancelar</button>
          <button class="btn btn--small btn--primary" type="button" :disabled="!!savingUserId" @click="toggleActive(pendingDisable)">{{ savingUserId ? 'Deshabilitando…' : 'Deshabilitar' }}</button>
        </div>
      </div>
    </ModalDialog>
  </div>
</template>

<style scoped>
.users__search { display: flex; flex-direction: column; gap: 6px; max-width: 360px; font-size: 13px; font-weight: 600; color: var(--ink-soft); }
.users__search input { font: inherit; padding: 11px 14px; border-radius: 10px; border: 1.5px solid var(--line-strong); background: var(--paper); color: var(--ink); }
.users__search input:focus-visible { outline: 2px solid var(--crimson); outline-offset: 2px; }
.users__pager { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; font-size: 13px; color: var(--ink-soft); }
.users__confirm { display: flex; flex-direction: column; gap: 16px; }
.users__confirm-actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.user-row__status--error { color: var(--crimson-dark); flex-basis: 100%; margin: 0; }
.users {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.users__hint {
  font-size: 14px;
  color: var(--ink-faint);
}

.users__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  padding: 18px 22px;
  border-radius: 16px;
  background: var(--paper-2);
  border: 1px solid var(--line);
  transition: opacity 0.2s ease;
}

.user-row--disabled {
  opacity: 0.6;
}

.user-row__identity {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 220px;
}

.user-row__avatar {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--navy);
  color: var(--on-dark);
  font-family: var(--display);
  font-weight: 650;
  text-transform: uppercase;
}

.user-row__names {
  display: flex;
  flex-direction: column;
}

.user-row__names strong {
  font-size: 14.5px;
  color: var(--ink);
}

.user-row__email,
.user-row__career {
  font-size: 12px;
  color: var(--ink-faint);
}

.user-row__controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.user-row__role-select {
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink);
}

.user-row__role-select:focus {
  outline: none;
  border-color: var(--crimson);
}

.user-row__disable-btn {
  background: transparent;
  color: var(--crimson-dark);
  border: 1px solid color-mix(in srgb, var(--crimson) 35%, transparent);
}

.user-row__disable-btn:hover {
  background: var(--crimson);
  color: white;
}

.user-row__status {
  position: absolute;
  bottom: -6px;
  right: 22px;
  font-size: 11.5px;
  color: var(--ink-faint);
}

.user-row__status--ok {
  color: var(--gold);
  font-weight: 600;
}

.user-row__badge {
  position: absolute;
  top: -8px;
  left: 22px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--crimson-dark);
  background: var(--paper);
  border: 1px solid var(--crimson);
  padding: 2px 8px;
  border-radius: 999px;
}
</style>
