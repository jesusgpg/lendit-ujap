<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'

const router = useRouter()
const auth = useAuthStore()

function goBack() {
  void router.push({ name: auth.isAdmin ? 'admin' : auth.isAuthenticated ? 'student-home' : 'landing' })
}
</script>

<template>
  <div class="forbidden-page">
    <SiteHeader />
    <main id="main-content" class="forbidden">
      <p class="forbidden__eyebrow">Acceso denegado</p>
      <h1>No tienes permiso para esta sección.</h1>
      <p>Tu cuenta no incluye los permisos de administración necesarios. Si crees que es un error, contacta a un administrador.</p>
      <button class="btn btn--primary" type="button" @click="goBack">Volver</button>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.forbidden-page { min-height: 100svh; background: var(--paper); }
.forbidden { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; max-width: 640px; margin: 0 auto; padding: 96px 24px; }
.forbidden__eyebrow { margin: 0; font-family: var(--mono); font-size: 11px; letter-spacing: 0.075em; text-transform: uppercase; color: var(--crimson-dark); }
.forbidden h1 { font-size: clamp(30px, 5vw, 44px); line-height: 1.05; }
.forbidden p { color: var(--ink-soft); }
</style>
