<script setup lang="ts">
import { push } from 'notivue'
import { useRoute, useRouter } from 'vue-router'
import AuthPageShell from '../components/AuthPageShell.vue'
import RegisterForm from '../components/RegisterForm.vue'

const route = useRoute()
const router = useRouter()

function getRedirectQuery() {
  const redirect = route.query.redirect
  return typeof redirect === 'string' ? { redirect } : undefined
}

function goToLogin() {
  void router.push({ name: 'login', query: getRedirectQuery() })
}

function handleRegisterSuccess() {
  push.success({ title: 'Cuenta creada', message: 'Tu perfil ya está listo para usar LendIt.' })
  if (route.query.redirect === 'publish') {
    void router.replace({ name: 'landing', query: { publish: '1' } })
    return
  }
  void router.replace({ name: 'landing' })
}
</script>

<template>
  <AuthPageShell
    eyebrow="Registro UJAP / LendIt"
    title="Haz visible lo que puedes compartir."
    description="Crea tu carnet digital y únete a una comunidad que presta objetos útiles entre clases, laboratorios y pasillos."
    note="Necesitas un correo institucional @ujap.edu.ve y una foto de perfil para crear tu cuenta."
    card-kicker="Nueva cuenta"
    card-title="Crear mi cuenta"
    card-label="Formulario de registro institucional"
    wide-card
  >
    <RegisterForm @success="handleRegisterSuccess" @switch-to-login="goToLogin" />
  </AuthPageShell>
</template>
