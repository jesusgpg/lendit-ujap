import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createNotivue } from 'notivue'
import 'notivue/notification.css'
import 'notivue/notification-progress.css'
import 'notivue/animations.css'
import './style.css'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { initAccessibility } from './lib/accessibility'

initAccessibility()

const app = createApp(App)
const pinia = createPinia()

router.beforeEach(async (to) => {
  const authStore = useAuthStore(pinia)
  await authStore.initialize()

  const requiredPermission = to.meta.requiredPermission
  if (typeof requiredPermission === 'string' && !authStore.hasPermission(requiredPermission)) {
    return { name: 'admin-login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresAuth === true && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
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
