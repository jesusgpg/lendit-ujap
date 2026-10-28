import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '../views/LandingView.vue'
import StudentHomeView from '../views/StudentHomeView.vue'
import MessagesView from '../views/MessagesView.vue'
import CommunityInfoView from '../views/CommunityInfoView.vue'
import AdminLoginView from '../views/AdminLoginView.vue'
import AdminView from '../views/AdminView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import RoleManagerPanel from '../components/RoleManagerPanel.vue'
import UsersManagerPanel from '../components/UsersManagerPanel.vue'
import CategoriesManagerPanel from '../components/CategoriesManagerPanel.vue'
import CareersManagerPanel from '../components/CareersManagerPanel.vue'
import SchoolsManagerPanel from '../components/SchoolsManagerPanel.vue'
import AdminTeacherVerificationsPanel from '../components/AdminTeacherVerificationsPanel.vue'
import PaymentSettingsPanel from '../components/PaymentSettingsPanel.vue'
import AdminForbiddenView from '../views/AdminForbiddenView.vue'
import CatalogView from '../views/CatalogView.vue'
import PublishView from '../views/PublishView.vue'
import MyPublicationsView from '../views/MyPublicationsView.vue'
import RequestsView from '../views/RequestsView.vue'
import AccountView from '../views/AccountView.vue'
import RecoveryRequestView from '../views/RecoveryRequestView.vue'
import ResetPasswordView from '../views/ResetPasswordView.vue'
import EmailConfirmationView from '../views/EmailConfirmationView.vue'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(_to, _from, savedPosition) { return savedPosition ?? { top: 0 } },
  routes: [
    { path: '/', name: 'landing', component: LandingView },
    { path: '/inicio', name: 'student-home', component: StudentHomeView, meta: { requiresAuth: true } },
    { path: '/cuenta', redirect: '/cuenta/perfil' },
    { path: '/cuenta/:section(perfil|carnet|acreditacion|preferencias|seguridad|pagos)', name: 'account', component: AccountView, meta: { requiresAuth: true, allowAdmin: true } },
    { path: '/mensajes', name: 'messages', component: MessagesView, meta: { requiresAuth: true } },
    { path: '/como-funciona', alias: '/comofunciona', name: 'how-it-works', component: CommunityInfoView, props: { section: 'how' } },
    { path: '/categorias', name: 'categories', component: CommunityInfoView, props: { section: 'categories' } },
    { path: '/confianza', name: 'trust', component: CommunityInfoView, props: { section: 'trust' } },
    { path: '/catalogo', name: 'catalog', component: CatalogView },
    { path: '/publicar', name: 'publish', component: PublishView, meta: { requiresAuth: true } },
    {
      path: '/mis-publicaciones',
      name: 'my-publications',
      component: MyPublicationsView,
      meta: { requiresAuth: true },
    },
    { path: '/solicitudes', name: 'requests', component: RequestsView, meta: { requiresAuth: true } },
    { path: '/login', name: 'login', component: LoginView, meta: { guestOnly: true } },
    { path: '/register', name: 'register', component: RegisterView, meta: { guestOnly: true } },
    { path: '/recuperar-contrasena', name: 'recovery-request', component: RecoveryRequestView },
    { path: '/auth/reset-password', name: 'reset-password', component: ResetPasswordView },
    { path: '/auth/confirmacion', name: 'email-confirmation', component: EmailConfirmationView },
    { path: '/admin/login', name: 'admin-login', component: AdminLoginView, meta: { guestOnly: true } },
    { path: '/admin/acceso-denegado', name: 'admin-forbidden', component: AdminForbiddenView },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { requiresAnyAdminPermission: true },
      children: [
        { path: '', name: 'admin-index', redirect: { name: 'admin-roles' } },
        { path: 'roles', name: 'admin-roles', component: RoleManagerPanel, meta: { requiredPermission: 'roles.manage' } },
        { path: 'users', name: 'admin-users', component: UsersManagerPanel, meta: { requiredPermission: 'users.manage' } },
        { path: 'categories', name: 'admin-categories', component: CategoriesManagerPanel, meta: { requiredPermission: 'categories.manage' } },
        { path: 'careers', name: 'admin-careers', component: CareersManagerPanel, meta: { requiredPermission: 'careers.manage' } },
        { path: 'schools', name: 'admin-schools', component: SchoolsManagerPanel, meta: { requiredPermission: 'careers.manage' } },
        { path: 'verificaciones-docentes', name: 'admin-teacher-verifications', component: AdminTeacherVerificationsPanel, meta: { requiredPermission: 'teachers.review' } },
        { path: 'pagos', name: 'admin-payments', component: PaymentSettingsPanel, meta: { requiredPermission: 'payments.manage' } },
      ],
    },
  ],
})

export default router
