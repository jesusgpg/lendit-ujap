import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createNotivue } from 'notivue'
import 'notivue/notification.css'
import 'notivue/notification-progress.css'
import 'notivue/animations.css'
import './style.css'
import './ui-system.css'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { initAccessibility } from './lib/accessibility'

document.body.classList.add('lendit-standard')
initAccessibility()

const app = createApp(App)
const pinia = createPinia()
const adminSectionPermissions = ['roles.manage', 'users.manage', 'teachers.review', 'categories.manage', 'careers.manage', 'payments.manage']
const guestOnlyRoutes = new Set(['login', 'register', 'admin-login'])

function authenticatedDestination(to: import('vue-router').RouteLocationNormalizedLoaded, authStore: ReturnType<typeof useAuthStore>) {
  const hasAdminAccess = authStore.isAdmin || adminSectionPermissions.some(permission => authStore.hasPermission(permission))
  if (to.name === 'admin-login' && !hasAdminAccess) return { name: 'student-home' }

  const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : ''
  const redirectPath = redirect.split(/[?#]/, 1)[0] ?? ''
  const guestPaths = new Set(['/login', '/register', '/admin/login'])
  if (redirect.startsWith('/') && !redirect.startsWith('//') && !guestPaths.has(redirectPath)) {
    return redirect
  }
  return hasAdminAccess ? { name: 'admin' } : { name: 'student-home' }
}

router.beforeEach(async (to) => {
  const authStore = useAuthStore(pinia)
  await authStore.initialize()

  if (typeof to.name === 'string' && guestOnlyRoutes.has(to.name) && authStore.isAuthenticated) {
    return authenticatedDestination(to, authStore)
  }

  if (to.name === 'landing' && authStore.isAuthenticated) {
    return { name: authStore.isAdmin ? 'admin' : 'student-home' }
  }

  const adminSectionRoutes: Record<string, string> = {
    'roles.manage': 'admin-roles',
    'users.manage': 'admin-users',
    'teachers.review': 'admin-teacher-verifications',
    'categories.manage': 'admin-categories',
    'careers.manage': 'admin-careers',
    'payments.manage': 'admin-payments',
  }

  // /admin sin subruta: primera sección autorizada.
  if (to.name === 'admin-index') {
    const first = adminSectionPermissions.find((permission) => authStore.hasPermission(permission))
    if (first) return { name: adminSectionRoutes[first] }
  }

  const needed = to.matched
    .map((record) => record.meta.requiredPermission)
    .filter((permission): permission is string => typeof permission === 'string')
  const needsAnyAdmin = to.matched.some((record) => record.meta.requiresAnyAdminPermission === true)
  const missing = needed.some((permission) => !authStore.hasPermission(permission))
    || (needsAnyAdmin && !adminSectionPermissions.some((permission) => authStore.hasPermission(permission)))
  if (missing) {
    // Sin sesión: login de administración. Con sesión pero sin permiso: acceso denegado (sin bucle).
    if (!authStore.isAuthenticated) return { name: 'admin-login', query: { redirect: to.fullPath } }
    if (to.name !== 'admin-forbidden') return { name: 'admin-forbidden' }
  }

  if (to.meta.requiresAuth === true && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'account' && to.params.section === 'carnet' && (authStore.isAdmin || authStore.user?.role !== 'STUDENT' || !!authStore.user?.teacherVerification)) {
    return { name: 'account', params: { section: 'perfil' } }
  }

  if (to.name === 'publish' && authStore.isTeacherApplicant) {
    return { name: 'account', params: { section: 'acreditacion' } }
  }

  if (to.name === 'account' && to.params.section === 'acreditacion' && authStore.isAdmin) {
    return { name: 'account', params: { section: 'perfil' } }
  }

  if (to.meta.requiresAuth === true && to.meta.allowAdmin !== true && authStore.isAdmin) {
    return { name: 'admin' }
  }
})

app
  .use(pinia)
  .use(router)
  .use(
    createNotivue({
      position: 'top-right',
      limit: 3,
      enqueue: true,
      pauseOnHover: true,
      pauseOnTouch: true,
    }),
  )

app.mount('#app')
