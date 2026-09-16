<script setup lang="ts">
import { push } from 'notivue'
import { useRoute, useRouter } from 'vue-router'
import AuthPageShell from '../components/AuthPageShell.vue'
import LoginForm from '../components/LoginForm.vue'

const route = useRoute()
const router = useRouter()

function getRedirectQuery() {
  const redirect = route.query.redirect
  return typeof redirect === 'string' ? { redirect } : undefined
}

function handleLoginSuccess() {
  push.success({ title: 'Sesión iniciada', message: 'Ya puedes continuar en LendIt.' })
  const redirect = route.query.redirect
  if (typeof redirect === 'string' && redirect.startsWith('/')) {
    void router.replace(redirect)
    return
  }
  if (route.query.redirect === 'publish') {
    void router.replace({ name: 'landing', query: { publish: '1' } })
    return
  }
  void router.replace({ name: 'landing' })
}

function openRegister() {
  void router.push({ name: 'register', query: getRedirectQuery() })
}
</script>

<template>
  <AuthPageShell
    eyebrow="Acceso UJAP / LendIt"
    title="Tu red de préstamos empieza aquí."
    description="Entra con tu correo institucional para publicar objetos, pedir lo que necesitas y cuidar tu carnet digital."
    note="Estudiantes y profesores ingresan con su cuenta institucional @ujap.edu.ve."
    card-kicker="Comunidad UJAP"
    card-title="Iniciar sesión"
    card-label="Formulario de inicio de sesión institucional"
  >
    <LoginForm @success="handleLoginSuccess" @switch-to-register="openRegister" />
  </AuthPageShell>
</template>
