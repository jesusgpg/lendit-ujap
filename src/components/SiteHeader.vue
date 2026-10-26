<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getAppName } from '../data'
import AccountMenu from './AccountMenu.vue'

withDefaults(
  defineProps<{
    /** Navegación del producto para las pantallas de catálogo y publicaciones. */
    showMarketplaceNav?: boolean
  }>(),
  { showMarketplaceNav: false },
)

const emit = defineEmits<{
  (e: 'open-login'): void
  (e: 'logout'): void
}>()

const router = useRouter()
const authStore = useAuthStore()
const crestSrc = `${import.meta.env.BASE_URL}images/Logo-UJAP1.png`
const appName = getAppName()
const isMobileMenuOpen = ref(false)

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false
}

function handleLoginClick() {
  closeMobileMenu()
  emit('open-login')
  void router.push({ name: 'login' })
}
</script>

<template>
  <header class="site-header" :class="{'site-header--member':authStore.isAuthenticated}">
    <div class="site-header__inner">
      <router-link class="brand" :to="authStore.isAuthenticated ? authStore.isAdmin ? '/admin' : '/inicio' : '/'" @click="closeMobileMenu">
        <img class="brand__crest" :src="crestSrc" alt="Escudo Universidad José Antonio Páez" />
        <span class="brand__name">{{ appName }}</span>
      </router-link>

      <!-- Desktop Navigation -->
      <nav class="site-nav" aria-label="Navegación principal">
        <router-link v-if="authStore.isAuthenticated && !authStore.isAdmin" to="/inicio">Mi inicio</router-link>
        <router-link v-if="!showMarketplaceNav" to="/catalogo">Explorar</router-link>
        <template v-if="showMarketplaceNav">
          <router-link to="/catalogo">Explorar</router-link>
          <router-link v-if="authStore.isAuthenticated && !authStore.isAdmin" to="/publicar">Publicar</router-link>
          <router-link v-if="authStore.isAuthenticated && !authStore.isAdmin" to="/mis-publicaciones">Mis publicaciones</router-link>
          <router-link v-if="authStore.isAuthenticated && !authStore.isAdmin" to="/solicitudes">Solicitudes</router-link>
          <router-link v-if="authStore.isAuthenticated && !authStore.isAdmin" to="/mensajes">Mensajes</router-link>
        </template>
        <template v-if="!authStore.isAuthenticated">
          <router-link to="/como-funciona">Cómo funciona</router-link>
          <router-link to="/categorias">Categorías</router-link>
          <router-link to="/confianza">Confianza</router-link>
        </template>
        <router-link v-if="authStore.isAdmin" to="/admin">
          Administración
        </router-link>
      </nav>

      <div class="site-header__actions">
        <AccountMenu v-if="authStore.isAuthenticated" @logout="emit('logout')" @open="closeMobileMenu" />
        <button v-else class="btn btn--primary btn--small" type="button" @click="handleLoginClick">Empezar</button>

        <!-- Botón menú hamburguesa para pantallas móviles -->
        <button
          class="mobile-toggle"
          type="button"
          :aria-expanded="isMobileMenuOpen"
          aria-controls="mobile-nav"
          :aria-label="isMobileMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'"
          @click="toggleMobileMenu"
        >
          <span class="mobile-toggle__bar" :class="{ 'mobile-toggle__bar--top': isMobileMenuOpen }"></span>
          <span class="mobile-toggle__bar" :class="{ 'mobile-toggle__bar--mid': isMobileMenuOpen }"></span>
          <span class="mobile-toggle__bar" :class="{ 'mobile-toggle__bar--bot': isMobileMenuOpen }"></span>
        </button>
      </div>
    </div>

    <!-- Menú móvil desplegable -->
    <transition name="mobile-menu-anim">
      <div v-if="isMobileMenuOpen" id="mobile-nav" class="mobile-nav" role="region" aria-label="Navegación móvil">
        <nav class="mobile-nav__links">
          <router-link v-if="authStore.isAuthenticated && !authStore.isAdmin" to="/inicio" class="mobile-nav__link" @click="closeMobileMenu">Mi inicio</router-link>
          <router-link to="/catalogo" class="mobile-nav__link" @click="closeMobileMenu">
            Explorar catálogo
          </router-link>
          <template v-if="authStore.isAuthenticated && !authStore.isAdmin">
            <router-link v-if="!authStore.isAdmin" to="/mensajes" class="mobile-nav__link" @click="closeMobileMenu">Mensajes</router-link>
            <router-link to="/publicar" class="mobile-nav__link" @click="closeMobileMenu">
              Publicar un objeto
            </router-link>
            <router-link to="/mis-publicaciones" class="mobile-nav__link" @click="closeMobileMenu">
              Mis publicaciones
            </router-link>
            <router-link to="/solicitudes" class="mobile-nav__link" @click="closeMobileMenu">
              Solicitudes y préstamos
            </router-link>
          </template>
            <router-link v-if="!authStore.isAdmin" to="/como-funciona" class="mobile-nav__link" @click="closeMobileMenu">Cómo funciona</router-link>
            <router-link v-if="!authStore.isAdmin" to="/categorias" class="mobile-nav__link" @click="closeMobileMenu">Categorías</router-link>
            <router-link v-if="!authStore.isAdmin" to="/confianza" class="mobile-nav__link" @click="closeMobileMenu">Confianza</router-link>
          <router-link
            v-if="authStore.isAdmin"
            class="mobile-nav__link"
            to="/admin"
            @click="closeMobileMenu"
          >
            Panel de administración
          </router-link>
        </nav>
      </div>
    </transition>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 40;
  width: 100%;
  background: color-mix(in srgb, var(--paper-2) 94%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.site-header__inner {
  display: flex;
  align-items: center;
  gap: 32px;
  max-width: 1220px;
  margin: 0 auto;
  padding: 14px clamp(20px, 5vw, 64px);
  width: 100%;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  margin-right: auto;
  border-radius: 8px;
  padding: 2px 4px;
  flex-shrink: 0;
}

.brand:hover .brand__name {
  color: var(--crimson);
}

.brand__crest {
  width: 44px;
  height: 44px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
}

.brand__name {
  font-family: var(--display);
  font-weight: 650;
  font-size: 21px;
  color: var(--ink);
  letter-spacing: -0.3px;
  white-space: nowrap;
  transition: color 0.15s ease;
}

.site-nav {
  display: flex;
  align-items: center;
  gap: 32px;
}

.site-nav a {
  text-decoration: none;
  font-size: 15px;
  font-weight: 550;
  color: var(--ink-soft);
  position: relative;
  padding: 6px 0;
  transition: color 0.15s ease;
}

.site-nav a:hover,
.site-nav a.router-link-active {
  color: var(--crimson);
}

.site-nav a.router-link-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--crimson);
  border-radius: 2px;
}

.site-nav__admin {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--mono);
  font-size: 11.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--gold);
  background: var(--gold-bg);
  border: 1px solid color-mix(in srgb, var(--gold) 40%, transparent);
  padding: 6px 12px;
  border-radius: 999px;
  transition: background 0.15s ease, color 0.15s ease;
}

.site-nav__admin:hover {
  color: var(--navy);
  background: var(--gold-light);
}

.site-header__actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* Mobile Hamburger Toggle */
.mobile-toggle {
  display: none;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid var(--line-strong);
  background: var(--paper);
  cursor: pointer;
  color: var(--ink);
}

.mobile-toggle__bar {
  width: 20px;
  height: 2px;
  background: currentColor;
  border-radius: 2px;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.mobile-toggle__bar--top {
  transform: translateY(7px) rotate(45deg);
}

.mobile-toggle__bar--mid {
  opacity: 0;
}

.mobile-toggle__bar--bot {
  transform: translateY(-7px) rotate(-45deg);
}

/* Mobile Dropdown Panel */
.mobile-nav {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--paper-2);
  border-bottom: 1px solid var(--line-strong);
  box-shadow: var(--shadow);
  padding: 16px clamp(20px, 5vw, 64px) 24px;
}

.mobile-nav__links {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-nav__link {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 15px;
  font-weight: 550;
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--line);
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.mobile-nav__link:hover,
.mobile-nav__link.router-link-active {
  background: var(--crimson-bg);
  border-color: var(--crimson);
  color: var(--crimson-dark);
}

.mobile-nav__link--admin {
  color: var(--gold);
  border-color: var(--gold);
}

.mobile-menu-anim-enter-active {
  transition: opacity 0.2s ease-out, transform 0.2s ease-out;
}

.mobile-menu-anim-leave-active {
  transition: opacity 0.15s ease-in, transform 0.15s ease-in;
}

.mobile-menu-anim-enter-from,
.mobile-menu-anim-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 820px) {
  .site-nav {
    display: none;
  }

  .mobile-toggle {
    display: flex;
  }
}

@media (max-width: 520px) {
  .site-header__inner {
    gap: 8px;
    padding: 10px 14px;
  }
  .brand {
    gap: 8px;
  }
  .brand__crest {
    width: 34px;
    height: 34px;
  }
  .brand__name {
    font-size: 17px;
  }
  .site-header__actions {
    gap: 8px;
  }
}
</style>
