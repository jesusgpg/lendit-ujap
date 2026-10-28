<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { memberRoleLabel } from '../lib/roleLabels'
import AccountMenuIcon from './AccountMenuIcon.vue'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const emit = defineEmits<{ (e: 'logout'): void; (e: 'open'): void }>()

const isMenuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)
const menuPanel = ref<HTMLElement | null>(null)
const menuTrigger = ref<HTMLButtonElement | null>(null)
const menuId = useId()
const keyboardOpening = ref(false)
const roleLabel = computed(() => authStore.isAdmin ? 'Administración' : memberRoleLabel(authStore.user))

function closeMenu(restoreFocus = false) {
  isMenuOpen.value = false
  if (restoreFocus) menuTrigger.value?.focus({ preventScroll: true })
}
function menuActions() {
  return Array.from(menuPanel.value?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]') ?? [])
}
async function openFromKeyboard(last = false) {
  keyboardOpening.value = true
  isMenuOpen.value = true
  emit('open')
  await nextTick()
  const items = menuActions()
  ;(last ? items[items.length - 1] : items[0])?.focus()
}
function toggleMenu(event: MouseEvent) {
  if (isMenuOpen.value) { closeMenu(); return }
  if (event.detail === 0) { void openFromKeyboard(); return }
  keyboardOpening.value = false
  isMenuOpen.value = true
  emit('open')
}
function handleMenuKeydown(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const items = menuActions()
  const index = items.indexOf(document.activeElement as HTMLElement)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[next]?.focus()
}
function handleEscape(event: KeyboardEvent) {
  if (isMenuOpen.value && event.key === 'Escape') { event.preventDefault(); closeMenu(true) }
}

function openAccount() {
  closeMenu()
  void router.push('/cuenta/perfil')
}

function handleClickOutside(event: MouseEvent) {
  if (isMenuOpen.value && menuRoot.value && !menuRoot.value.contains(event.target as Node)) {
    isMenuOpen.value = false
  }
}
function handleFocusOutside(event: FocusEvent) {
  if (isMenuOpen.value && menuRoot.value && !menuRoot.value.contains(event.target as Node)) closeMenu()
}

watch(() => route.fullPath, () => closeMenu())
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('focusin', handleFocusOutside)
  document.addEventListener('keydown', handleEscape)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('focusin', handleFocusOutside)
  document.removeEventListener('keydown', handleEscape)
})

function handleLogout() {
  // El emit debe correr de forma síncrona: logout() pone user=null y Vue desmonta
  // este componente en el siguiente microtask, lo que descartaría el evento.
  isMenuOpen.value = false
  emit('logout')
  const logout = authStore.logout()
  void router.replace({ name: 'landing' })
  void logout.catch(() => {
    // logout() limpia la sesión local aunque el cierre remoto falle.
  })
}

</script>

<template>
  <div ref="menuRoot" class="account-menu" :class="{'account-menu--keyboard':keyboardOpening}">
    <button ref="menuTrigger" class="account-menu__trigger" type="button" :aria-expanded="isMenuOpen" :aria-controls="menuId" :aria-label="`${isMenuOpen ? 'Cerrar' : 'Abrir'} menú de cuenta de ${authStore.user?.name}`" @click="toggleMenu" @keydown.down.prevent="openFromKeyboard()" @keydown.up.prevent="openFromKeyboard(true)">
      <span class="account-menu__avatar">
        <img v-if="authStore.user?.photo" :src="authStore.user.photo" alt="" />
        <span v-else>{{ authStore.user?.name?.charAt(0) }}</span>
      </span>
      <span class="account-menu__name">{{ authStore.user?.name }}</span>
      <AccountMenuIcon name="down" class="account-menu__chevron" :class="{ 'account-menu__chevron--open': isMenuOpen }" />
    </button>

    <Transition name="account-menu-fade">
      <section v-if="isMenuOpen" :id="menuId" ref="menuPanel" class="account-menu__panel" aria-label="Opciones de tu cuenta" @keydown="handleMenuKeydown">
        <button class="account-menu__identity" type="button" @click="openAccount">
          <span class="account-menu__avatar account-menu__avatar--large"><img v-if="authStore.user?.photo" :src="authStore.user.photo" alt="" /><span v-else>{{ authStore.user?.name?.charAt(0) }}</span></span>
          <span class="account-menu__identity-copy"><strong>{{ authStore.user?.name }}</strong><span>{{ authStore.user?.email }}</span><small>{{ roleLabel }} · Ver perfil</small></span>
          <AccountMenuIcon name="chevron" />
        </button>
        <nav class="account-menu__shortcuts" aria-label="Accesos principales">
          <router-link :to="authStore.isAdmin ? '/admin' : '/inicio'" @click="closeMenu()"><AccountMenuIcon :name="authStore.isAdmin ? 'admin' : 'home'" /><span>{{ authStore.isAdmin ? 'Administración' : 'Mi inicio' }}</span></router-link>
          <router-link :to="authStore.isAdmin ? '/catalogo' : '/mensajes'" @click="closeMenu()"><AccountMenuIcon :name="authStore.isAdmin ? 'search' : 'messages'" /><span>{{ authStore.isAdmin ? 'Explorar' : 'Mensajes' }}</span></router-link>
        </nav>
        <nav v-if="!authStore.isAdmin" class="account-menu__activity" aria-label="Tu actividad">
          <router-link to="/catalogo" @click="closeMenu()"><AccountMenuIcon name="search" />Explorar objetos</router-link>
          <router-link to="/publicar" @click="closeMenu()"><AccountMenuIcon name="plus" />Publicar objeto</router-link>
          <router-link to="/mis-publicaciones" @click="closeMenu()"><AccountMenuIcon name="objects" />Mis publicaciones</router-link>
          <router-link to="/solicitudes" @click="closeMenu()"><AccountMenuIcon name="requests" />Solicitudes</router-link>
        </nav>
        <div class="account-menu__settings">
          <button class="account-menu__item" type="button" @click="openAccount"><AccountMenuIcon name="settings" /><span>Mi cuenta</span><AccountMenuIcon name="chevron" class="account-menu__trailing" /></button>
        </div>
        <div class="account-menu__footer"><button class="account-menu__item account-menu__item--danger" type="button" @click="handleLogout"><AccountMenuIcon name="logout" /><span>Cerrar sesión</span></button></div>
      </section>
    </Transition>

  </div>
</template>

<style scoped>
.account-menu { position:relative; font-family:var(--sans); }
.account-menu__trigger { display:flex;align-items:center;gap:9px;min-height:44px;padding:5px 10px 5px 5px;border-radius:999px;border:1px solid transparent;background:transparent;cursor:pointer;color:var(--ink);transition:background 150ms ease,border-color 150ms ease; }
.account-menu__trigger:hover,.account-menu__trigger[aria-expanded=true] { border-color:var(--line);background:var(--paper); }
.account-menu__avatar { display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;overflow:hidden;background:var(--navy);color:var(--on-dark);font:600 15px var(--sans);flex-shrink:0; }
.account-menu__avatar img { width:100%;height:100%;object-fit:cover; }
.account-menu__avatar--large { width:42px;height:42px;font-size:18px; }
.account-menu__name { max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 14px var(--sans);color:var(--ink); }
.account-menu__chevron { width:14px;height:14px;color:var(--ink-soft);transition:transform 160ms var(--ease-out); }
.account-menu__chevron--open { transform:rotate(180deg); }
.account-menu__panel { position:absolute;top:calc(100% + 12px);right:0;width:336px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 100px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;padding:8px;border:1px solid var(--line);border-radius:18px;background:var(--paper);color:var(--ink);box-shadow:0 14px 40px color-mix(in srgb,var(--ink) 12%,transparent);z-index:60;transform-origin:top right; }
.account-menu__identity { display:flex;align-items:center;gap:12px;width:100%;padding:14px 12px 18px;background:none;border:0;text-align:left;border-radius:12px;cursor:pointer;color:var(--ink); }
.account-menu__identity:hover { background:var(--surface-soft); }
.account-menu__identity>svg { flex-shrink:0;color:var(--ink-soft);width:15px;height:15px; }
.account-menu__identity-copy { display:flex;flex-direction:column;gap:4px;min-width:0;flex:1; }
.account-menu__identity-copy strong { font-size:15px;line-height:1.4;overflow-wrap:anywhere; }
.account-menu__identity-copy>span { font-size:12px;line-height:1.4;color:var(--ink-soft);overflow-wrap:anywhere; }
.account-menu__identity-copy small { font-size:11px;line-height:1.4;color:var(--crimson-dark);font-weight:500;overflow-wrap:anywhere; }
.account-menu__shortcuts { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:0 8px 14px; }
.account-menu__shortcuts a { display:flex;align-items:center;gap:9px;padding:14px 12px;min-height:52px;background:var(--surface-soft);border-radius:10px;color:var(--ink);text-decoration:none;font-size:13px;font-weight:600;transition:background 150ms ease; }
.account-menu__shortcuts svg { color:var(--navy);flex-shrink:0; }
.account-menu__activity { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px;padding:8px 4px 12px;border-top:1px solid var(--line); }
.account-menu__activity a { display:flex;align-items:center;gap:9px;padding:10px 8px;min-height:44px;color:var(--ink);text-decoration:none;font-size:12px;line-height:1.4;border-radius:8px;transition:background 150ms ease; }
.account-menu__activity svg { flex-shrink:0;color:var(--ink-soft);width:17px;height:17px; }
.account-menu__settings { border-top:1px solid var(--line);padding:10px 4px; }
.account-menu__section-label { font:500 12px/1.5 var(--sans);color:var(--ink-soft);padding:0 10px 6px;margin:0; }
.account-menu__item { display:flex;align-items:center;gap:12px;min-height:44px;padding:11px 10px;width:100%;border:0;border-radius:9px;background:none;color:var(--ink);text-align:left;cursor:pointer;font:400 14px/1.4 var(--sans);transition:background 150ms ease,color 150ms ease; }
.account-menu__item>svg { color:var(--ink-soft);flex-shrink:0; }
.account-menu__item>span { flex:1; }
.account-menu__item>small { font-size:12px;color:var(--ink-soft); }
.account-menu__item>.account-menu__trailing { width:13px;height:13px; }
.account-menu__item:hover,.account-menu__activity a:hover,.account-menu__shortcuts a:hover { background:var(--surface-soft); }
.account-menu__shortcuts a:hover { background:var(--paper-3); }
.account-menu__footer { border-top:1px solid var(--line);padding:8px 4px 2px; }
.account-menu__item--danger,.account-menu__item--danger>svg { color:var(--crimson-dark); }
.account-menu__item--danger:hover { background:var(--crimson-bg); }
.account-menu :is(button,a):focus-visible { outline:2px solid var(--crimson);outline-offset:2px; }
.account-menu-fade-enter-active { transition:opacity 160ms ease,transform 180ms var(--ease-out); }
.account-menu-fade-leave-active { transition:opacity 100ms ease,transform 100ms var(--ease-out); }
.account-menu-fade-enter-from,.account-menu-fade-leave-to { opacity:0;transform:translateY(-4px) scale(.98); }
.account-menu--keyboard .account-menu-fade-enter-active,.account-menu--keyboard .account-menu-fade-leave-active { transition:none; }
@media(max-width:640px) { .account-menu__panel { position:fixed;top:76px;left:12px;right:12px;width:auto;max-height:calc(100dvh - 92px);transform-origin:top right; } .account-menu__trigger { padding:5px;gap:5px; } .account-menu__name { max-width:86px;font-size:12px; } .account-menu__activity a { font-size:13px; } }
@media(prefers-reduced-motion:reduce) { .account-menu__chevron,.account-menu__item,.account-menu__shortcuts a,.account-menu__activity a,.account-menu-fade-enter-active,.account-menu-fade-leave-active { transition:none; } .account-menu-fade-enter-from,.account-menu-fade-leave-to { transform:none; } }

</style>
