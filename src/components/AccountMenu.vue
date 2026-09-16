<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { push } from 'notivue'
import { useAuthStore } from '../stores/auth'
import { apiRequest } from '../lib/api'
import { uploadItemPhoto } from '../lib/storage'
import { fontSize, theme, colorblind, type FontSize, type ThemeMode } from '../lib/accessibility'
import ModalDialog from './ModalDialog.vue'
import PhotoDropzone from './PhotoDropzone.vue'

const authStore = useAuthStore()
const router = useRouter()
const emit = defineEmits<{ (e: 'logout'): void }>()

const isMenuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)
const activeModal = ref<'profile' | 'calendar' | 'accessibility' | 'preferences' | 'languages' | null>(null)

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value
}

function openModal(modal: typeof activeModal.value) {
  activeModal.value = modal
  isMenuOpen.value = false
}

function navigateTo(path: string) {
  isMenuOpen.value = false
  void router.push(path)
}

function closeModal() {
  activeModal.value = null
}

function handleClickOutside(event: MouseEvent) {
  if (isMenuOpen.value && menuRoot.value && !menuRoot.value.contains(event.target as Node)) {
    isMenuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))

function handleLogout() {
  // El emit debe correr de forma síncrona: logout() pone user=null y Vue desmonta
  // este componente en el siguiente microtask, lo que descartaría el evento.
  isMenuOpen.value = false
  if (typeof router.currentRoute.value.meta.requiredPermission === 'string') {
    void router.replace({ name: 'landing' })
  }
  emit('logout')
  void authStore.logout().catch(() => {
    // logout() limpia la sesión local aunque el cierre remoto falle.
  })
}

// ---------- perfil ----------
const profileForm = ref({ firstName: '', lastName: '', phone: '', photoUrl: '' })
const isSavingProfile = ref(false)
const profileError = ref('')
const profileSaved = ref(false)
const photoPreview = ref('')

function openProfileModal() {
  const user = authStore.user
  profileForm.value = {
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
    photoUrl: user?.photo ?? '',
  }
  photoPreview.value = user?.photo ?? ''
  profileError.value = ''
  profileSaved.value = false
  openModal('profile')
}

function handlePhotoUpdate(dataUrl: string) {
  photoPreview.value = dataUrl
  profileForm.value.photoUrl = dataUrl
  profileError.value = ''
}

async function saveProfile() {
  isSavingProfile.value = true
  profileError.value = ''
  try {
    // Un data URL recién capturado por PhotoDropzone se sube a Storage antes de
    // guardarlo: persistir el base64 crudo en el perfil infla el registro sin necesidad.
    const photoUrl = profileForm.value.photoUrl.startsWith('data:')
      ? await uploadItemPhoto(profileForm.value.photoUrl)
      : profileForm.value.photoUrl || null

    await apiRequest('/api/me', {
      method: 'PATCH',
      body: JSON.stringify({
        firstName: profileForm.value.firstName,
        lastName: profileForm.value.lastName,
        phone: profileForm.value.phone,
        photoUrl,
      }),
    })
    await authStore.syncProfile()
    profileSaved.value = true
    push.success({ title: 'Perfil actualizado', message: 'Tus cambios se guardaron correctamente.' })
  } catch (error) {
    profileError.value = error instanceof Error ? error.message : 'No se pudo guardar el perfil.'
    push.error({ title: 'No se guardó el perfil', message: profileError.value })
  } finally {
    isSavingProfile.value = false
  }
}

// ---------- accesibilidad ----------
const fontSizeOptions: { value: FontSize; label: string }[] = [
  { value: 'normal', label: 'A' },
  { value: 'large', label: 'A' },
  { value: 'larger', label: 'A' },
]
const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
]
</script>

<template>
  <div ref="menuRoot" class="account-menu">
    <button class="account-menu__trigger" type="button" @click="toggleMenu">
      <span class="account-menu__avatar">
        <img v-if="authStore.user?.photo" :src="authStore.user.photo" alt="" />
        <span v-else>{{ authStore.user?.name?.charAt(0) }}</span>
      </span>
      <span class="account-menu__name">{{ authStore.user?.name }}</span>
      <span class="account-menu__chevron" :class="{ 'account-menu__chevron--open': isMenuOpen }">⌄</span>
    </button>

    <Transition name="account-menu-fade">
      <div v-if="isMenuOpen" class="account-menu__panel">
        <div class="account-menu__header">
          <strong>{{ authStore.user?.name }}</strong>
          <span>{{ authStore.user?.email }}</span>
        </div>

        <button class="account-menu__item" type="button" @click="navigateTo('/catalogo')">
          <span class="account-menu__icon">⌕</span> Explorar objetos
        </button>
        <button class="account-menu__item" type="button" @click="navigateTo('/publicar')">
          <span class="account-menu__icon">＋</span> Publicar objeto
        </button>
        <button class="account-menu__item" type="button" @click="navigateTo('/mis-publicaciones')">
          <span class="account-menu__icon">▤</span> Mis publicaciones
        </button>
        <button class="account-menu__item" type="button" @click="navigateTo('/solicitudes')">
          <span class="account-menu__icon">↔</span> Solicitudes
        </button>

        <div class="account-menu__divider"></div>

        <button class="account-menu__item" type="button" @click="openProfileModal">
          <span class="account-menu__icon">☺</span> Perfil
        </button>
        <button class="account-menu__item" type="button" @click="openModal('calendar')">
          <span class="account-menu__icon">▦</span> Calendario
        </button>
        <button class="account-menu__item" type="button" @click="openModal('accessibility')">
          <span class="account-menu__icon">◑</span> Accesibilidad
        </button>
        <button class="account-menu__item" type="button" @click="openModal('preferences')">
          <span class="account-menu__icon">⚙</span> Preferencias
        </button>
        <button class="account-menu__item" type="button" @click="openModal('languages')">
          <span class="account-menu__icon">🌐</span> Idiomas
        </button>

        <div class="account-menu__divider"></div>

        <button class="account-menu__item account-menu__item--danger" type="button" @click="handleLogout">
          <span class="account-menu__icon">⏻</span> Cerrar sesión
        </button>
      </div>
    </Transition>

    <!-- Perfil -->
    <ModalDialog v-if="activeModal === 'profile'" wide title="Tu perfil" @close="closeModal">
      <form class="account-form" @submit.prevent="saveProfile">
        <div class="account-form__photo">
          <PhotoDropzone :model-value="photoPreview" @update:model-value="handlePhotoUpdate" />
        </div>

        <div class="account-form__row">
          <label class="account-form__field">
            <span>Nombre</span>
            <input v-model="profileForm.firstName" type="text" required />
          </label>
          <label class="account-form__field">
            <span>Apellido</span>
            <input v-model="profileForm.lastName" type="text" required />
          </label>
        </div>
        <label class="account-form__field">
          <span>Correo</span>
          <input :value="authStore.user?.email" type="email" disabled />
        </label>
        <label class="account-form__field">
          <span>Carrera</span>
          <input :value="authStore.user?.career" type="text" disabled />
        </label>
        <label class="account-form__field">
          <span>Teléfono</span>
          <input v-model="profileForm.phone" type="tel" required />
        </label>
        <p v-if="profileError" class="account-form__error">{{ profileError }}</p>
        <button class="btn btn--primary account-form__submit" type="submit" :disabled="isSavingProfile">
          {{ isSavingProfile ? 'Guardando…' : profileSaved ? '✓ Guardado' : 'Guardar cambios' }}
        </button>
      </form>
    </ModalDialog>

    <!-- Calendario -->
    <ModalDialog v-else-if="activeModal === 'calendar'" title="Tu calendario" @close="closeModal">
      <div class="account-empty">
        <p>Aún no tienes préstamos ni solicitudes con fecha activa.</p>
        <p class="account-empty__hint">Cuando pidas o prestes un objeto, sus fechas de entrega y devolución van a aparecer aquí.</p>
      </div>
    </ModalDialog>

    <!-- Accesibilidad -->
    <ModalDialog v-else-if="activeModal === 'accessibility'" title="Accesibilidad" @close="closeModal">
      <div class="account-settings">
        <div class="account-settings__group">
          <span class="account-settings__label">Tamaño de fuente</span>
          <div class="account-settings__options">
            <button
              v-for="(option, index) in fontSizeOptions"
              :key="option.value"
              type="button"
              class="account-settings__pill"
              :class="{ 'account-settings__pill--active': fontSize === option.value }"
              :style="{ fontSize: `${14 + index * 3}px` }"
              @click="fontSize = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="account-settings__group">
          <span class="account-settings__label">Tema</span>
          <div class="account-settings__options">
            <button
              v-for="option in themeOptions"
              :key="option.value"
              type="button"
              class="account-settings__pill"
              :class="{ 'account-settings__pill--active': theme === option.value }"
              @click="theme = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <label class="account-settings__toggle">
          <span class="account-settings__toggle-text">
            Modo daltónico
            <small>Paleta azul/naranja de alto contraste</small>
          </span>
          <span class="account-settings__switch" :class="{ 'account-settings__switch--on': colorblind }">
            <input v-model="colorblind" type="checkbox" />
            <span class="account-settings__thumb"></span>
          </span>
        </label>
      </div>
    </ModalDialog>

    <!-- Preferencias -->
    <ModalDialog v-else-if="activeModal === 'preferences'" title="Preferencias" @close="closeModal">
      <div class="account-settings">
        <div class="account-settings__group">
          <span class="account-settings__label">Cuenta</span>
          <p class="account-settings__row"><strong>Rol:</strong> {{ authStore.user?.role }}</p>
          <p class="account-settings__row"><strong>Carrera:</strong> {{ authStore.user?.career }}</p>
        </div>
        <p class="account-empty__hint">
          Las opciones de accesibilidad (fuente, tema, modo daltónico) están en el menú "Accesibilidad". Más
          preferencias de cuenta llegarán más adelante.
        </p>
      </div>
    </ModalDialog>

    <!-- Idiomas -->
    <ModalDialog v-else-if="activeModal === 'languages'" title="Idioma" @close="closeModal">
      <ul class="language-list">
        <li class="language-item language-item--active">
          <span>Español</span>
          <span class="language-item__badge">Activo</span>
        </li>
        <li class="language-item">
          <span>English</span>
          <span class="language-item__badge language-item__badge--soon">Próximamente</span>
        </li>
        <li class="language-item">
          <span>Português</span>
          <span class="language-item__badge language-item__badge--soon">Próximamente</span>
        </li>
      </ul>
    </ModalDialog>
  </div>
</template>

<style scoped>
.account-menu {
  position: relative;
}

.account-menu__trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 6px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.account-menu__trigger:hover {
  border-color: var(--line);
  background: color-mix(in srgb, var(--paper) 60%, transparent);
}

.account-menu__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--navy);
  color: var(--on-dark);
  font-family: var(--display);
  font-weight: 650;
  font-size: 13px;
  text-transform: uppercase;
  flex-shrink: 0;
}

.account-menu__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.account-menu__name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-soft);
}

.account-menu__chevron {
  font-size: 12px;
  color: var(--ink-faint);
  transition: transform 0.15s ease;
}

.account-menu__chevron--open {
  transform: rotate(180deg);
}

.account-menu__panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 260px;
  border-radius: 16px;
  background: var(--paper-2);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  padding: 10px;
  z-index: 60;
}

.account-menu__header {
  display: flex;
  flex-direction: column;
  padding: 8px 12px 12px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--line);
}

.account-menu__header strong {
  font-size: 14px;
  color: var(--ink);
}

.account-menu__header span {
  font-size: 12px;
  color: var(--ink-faint);
}

.account-menu__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: none;
  background: transparent;
  border-radius: 10px;
  font: inherit;
  font-size: 13.5px;
  color: var(--ink-soft);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
}

.account-menu__item:hover {
  background: color-mix(in srgb, var(--paper) 70%, transparent);
  color: var(--ink);
}

.account-menu__icon {
  width: 18px;
  text-align: center;
  color: var(--gold);
}

.account-menu__divider {
  height: 1px;
  background: var(--line);
  margin: 6px 4px;
}

.account-menu__item--danger {
  color: var(--crimson-dark);
}

.account-menu__item--danger .account-menu__icon {
  color: var(--crimson);
}

.account-menu-fade-enter-active,
.account-menu-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.account-menu-fade-enter-from,
.account-menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ---------- shared modal form bits ---------- */
.account-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.account-form__photo {
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}

.account-form__row {
  display: flex;
  gap: 12px;
}

.account-form__field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-soft);
}

.account-form__field input {
  font: inherit;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink);
}

.account-form__field input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.account-form__field input:focus {
  outline: none;
  border-color: var(--crimson);
}

.account-form__error {
  font-size: 13px;
  color: var(--crimson-dark);
}

.account-form__submit {
  width: 100%;
}

.account-empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
}

.account-empty__hint {
  font-size: 13px;
  color: var(--ink-faint);
  line-height: 1.5;
}

.account-settings {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.account-settings__group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.account-settings__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-soft);
}

.account-settings__options {
  display: flex;
  gap: 8px;
}

.account-settings__pill {
  padding: 8px 16px;
  border-radius: 999px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink-soft);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.account-settings__pill--active {
  border-color: var(--crimson);
  background: var(--crimson-bg);
  color: var(--crimson-dark);
}

.account-settings__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
}

.account-settings__toggle-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13.5px;
  color: var(--ink-soft);
}

.account-settings__toggle-text small {
  font-size: 12px;
  color: var(--ink-faint);
  font-weight: 400;
}

.account-settings__switch {
  flex-shrink: 0;
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 999px;
  background: var(--line-strong);
  transition: background 0.2s ease;
}

.account-settings__switch input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.account-settings__switch--on {
  background: var(--crimson);
}

.account-settings__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--paper);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.account-settings__switch--on .account-settings__thumb {
  transform: translateX(20px);
}

.account-settings__switch:focus-within {
  box-shadow: 0 0 0 3px var(--crimson-bg);
}

.account-settings__row {
  font-size: 13.5px;
  color: var(--ink-soft);
  margin: 0;
}

.language-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.language-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--paper);
  border: 1px solid var(--line);
  font-size: 14px;
  color: var(--ink-faint);
}

.language-item--active {
  border-color: var(--gold-light);
  background: var(--gold-bg);
  color: var(--ink);
  font-weight: 600;
}

.language-item__badge {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--gold);
}

.language-item__badge--soon {
  color: var(--ink-faint);
}
</style>
