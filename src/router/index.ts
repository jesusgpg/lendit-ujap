import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '../views/LandingView.vue'
import AdminLoginView from '../views/AdminLoginView.vue'
import AdminView from '../views/AdminView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import RoleManagerPanel from '../components/RoleManagerPanel.vue'
import UsersManagerPanel from '../components/UsersManagerPanel.vue'
import CategoriesManagerPanel from '../components/CategoriesManagerPanel.vue'
import CareersManagerPanel from '../components/CareersManagerPanel.vue'
import CatalogView from '../views/CatalogView.vue'
import PublishView from '../views/PublishView.vue'
import MyPublicationsView from '../views/MyPublicationsView.vue'
import RequestsView from '../views/RequestsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'landing', component: LandingView },
    { path: '/catalogo', name: 'catalog', component: CatalogView },
    { path: '/publicar', name: 'publish', component: PublishView, meta: { requiresAuth: true } },
    {
      path: '/mis-publicaciones',
      name: 'my-publications',
      component: MyPublicationsView,
      meta: { requiresAuth: true },
    },
    { path: '/solicitudes', name: 'requests', component: RequestsView, meta: { requiresAuth: true } },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/register', name: 'register', component: RegisterView },
    { path: '/admin/login', name: 'admin-login', component: AdminLoginView },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { requiredPermission: 'roles.manage' },
      children: [
        { path: '', redirect: { name: 'admin-roles' } },
        { path: 'roles', name: 'admin-roles', component: RoleManagerPanel },
        { path: 'users', name: 'admin-users', component: UsersManagerPanel },
        { path: 'categories', name: 'admin-categories', component: CategoriesManagerPanel },
        { path: 'careers', name: 'admin-careers', component: CareersManagerPanel },
      ],
    },
  ],
})

export default router
