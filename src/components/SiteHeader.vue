<script setup lang="ts">
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

const authStore = useAuthStore()
const crestSrc = `${import.meta.env.BASE_URL}images/Logo-UJAP1.png`
const appName = getAppName()
</script>

<template>
  <header class="site-header">
    <router-link class="brand" to="/">
      <img class="brand__crest" :src="crestSrc" alt="Escudo Universidad José Antonio Páez" />
      <span class="brand__name">{{ appName }}</span>
    </router-link>

    <nav class="site-nav">
      <template v-if="showMarketplaceNav">
        <router-link to="/catalogo">Explorar</router-link>
        <router-link v-if="authStore.isAuthenticated" to="/publicar">Publicar</router-link>
        <router-link v-if="authStore.isAuthenticated" to="/mis-publicaciones">Mis publicaciones</router-link>
        <router-link v-if="authStore.isAuthenticated" to="/solicitudes">Solicitudes</router-link>
      </template>
      <template v-if="!authStore.isAuthenticated">
        <a href="/#como-funciona">Cómo funciona</a>
        <a href="/#categorias">Categorías</a>
        <a href="/#confianza">Confianza</a>
      </template>
      <router-link v-if="authStore.hasPermission('roles.manage')" class="site-nav__admin" to="/admin">
        Administración
      </router-link>
    </nav>

    <AccountMenu v-if="authStore.isAuthenticated" @logout="emit('logout')" />
    <button v-else class="btn btn--primary btn--small" type="button" @click="emit('open-login')">Empezar</button>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px clamp(20px, 5vw, 64px);
  background: color-mix(in srgb, var(--paper-2) 92%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  margin-right: auto;
}

.brand__crest {
  width: 46px;
  height: 46px;
  object-fit: contain;
}

.brand__name {
  font-family: var(--display);
  font-weight: 650;
  font-size: 19px;
  color: var(--ink);
  letter-spacing: -0.2px;
}

.site-nav {
  display: flex;
  align-items: center;
  gap: 28px;
}

.site-nav a {
  text-decoration: none;
  font-size: 14.5px;
  font-weight: 500;
  color: var(--ink-soft);
  position: relative;
  padding-bottom: 2px;
}

.site-nav a:hover {
  color: var(--crimson);
}

.site-nav__admin {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--gold);
  background: var(--gold-bg);
  border: 1px solid color-mix(in srgb, var(--gold) 40%, transparent);
  padding: 6px 12px;
  border-radius: 999px;
}

.site-nav__admin:hover {
  color: var(--navy);
  background: var(--gold-light);
}

@media (max-width: 780px) {
  .site-nav a:not(.site-nav__admin) {
    display: none;
  }
}

@media (max-width: 380px) {
  .site-header {
    gap: 12px;
    padding: 12px 16px;
  }
  .brand__crest {
    width: 36px;
    height: 36px;
  }
  .brand__name {
    font-size: 16px;
  }
}
</style>
