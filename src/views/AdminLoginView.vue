<script setup lang="ts">
import { onMounted } from 'vue'
import { push } from 'notivue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import AuthPageShell from '../components/AuthPageShell.vue'
import LoginForm from '../components/LoginForm.vue'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

function getAdminDestination() {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/admin') && redirect !== '/admin/login'
    ? redirect
    : '/admin'
}

function handleLoginSuccess() {
  push.success({ title: 'Acceso autorizado', message: 'Bienvenido/a al panel de administración.' })
  void router.replace(getAdminDestination())
}

onMounted(() => {
  if (authStore.hasPermission('roles.manage')) {
    void router.replace({ name: 'admin' })
  }
})
</script>

<template>
  <AuthPageShell
    eyebrow="Zona restringida / LendIt"
    title="El campus también necesita un centro de control."
    description="Gestiona usuarios, permisos, carreras y categorías desde un espacio separado del acceso de la comunidad."
    note="El correo puede ser Gmail, pero la cuenta debe tener permisos de administrador."
    card-kicker="Administración"
    card-title="Iniciar sesión"
    card-label="Formulario de acceso administrativo"
  >
    <LoginForm mode="admin" @success="handleLoginSuccess" />
  </AuthPageShell>
</template>
