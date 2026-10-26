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
    void router.replace({ name: 'publish' })
    return
  }
  void router.replace({ name: 'student-home' })
}

function openRegister() {
  void router.push({ name: 'register', query: getRedirectQuery() })
}
</script>

<template>
  <AuthPageShell
    eyebrow="Acceso UJAP / LendIt"
    title="Vuelve a tu comunidad."
    description="Entra con tu correo institucional para publicar objetos, enviar solicitudes y conversar con otros miembros de la UJAP."
    note="Estudiantes y profesores ingresan con su cuenta institucional @ujap.edu.ve."
    card-kicker="Comunidad UJAP"
    card-title="Iniciar sesión"
    card-label="Formulario de inicio de sesión institucional"
  >
    <LoginForm @success="handleLoginSuccess" @switch-to-register="openRegister" />
  </AuthPageShell>
</template>
