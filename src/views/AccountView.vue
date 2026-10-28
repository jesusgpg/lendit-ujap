<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { apiRequest } from '../lib/api'
import { uploadItemPhoto, removeItemPhoto } from '../lib/storage'
import { fontSize, theme, colorblind, type FontSize } from '../lib/accessibility'
import { memberRoleLabel } from '../lib/roleLabels'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import PhotoDropzone from '../components/PhotoDropzone.vue'
import AccountMenuIcon from '../components/AccountMenuIcon.vue'
import StudentCardPanel from '../components/StudentCardPanel.vue'
import TeacherCredentialPanel from '../components/TeacherCredentialPanel.vue'
import AccountSecurityPanel from '../components/AccountSecurityPanel.vue'
import ModalDialog from '../components/ModalDialog.vue'

const auth = useAuthStore()
const catalog = useCatalogStore()
const route = useRoute()
const sections = computed<{ id: string; label: string; description: string; icon: 'profile' | 'objects' | 'accessibility' | 'admin' }[]>(() => [
  { id: 'perfil', label: 'Perfil', description: 'Tus datos personales y académicos', icon: 'profile' },
  ...(!auth.isAdmin && (auth.user?.role === 'PROFESSOR' || !!auth.user?.teacherVerification)
    ? [{ id: 'acreditacion', label: 'Acreditación docente', description: 'Credencial y estado de validación', icon: 'objects' as const }]
    : []),
  ...(!auth.isAdmin && auth.user?.role === 'STUDENT' && !auth.user?.teacherVerification
    ? [{ id: 'carnet', label: 'Carnet universitario', description: 'Tu documento privado del campus', icon: 'objects' as const }]
    : []),
  { id: 'seguridad', label: 'Seguridad', description: 'Contraseña y protección de acceso', icon: 'admin' as const },
  { id: 'preferencias', label: 'Apariencia y accesibilidad', description: 'Tema, lectura e idioma', icon: 'accessibility' },
])
const section = computed(() => sections.value.find(s => s.id === route.params.section) ?? sections.value[0]!)
const roleLabel = computed(() => {
  if (auth.isAdmin) return 'Administración'
  return memberRoleLabel(auth.user)
})
const form = ref({
  firstName: '',
  lastName: '',
  phone: '',
  photoUrl: '',
  schoolId: '',
  department: '',
  careerId: '',
})
const baseline = ref('')
const dirty = computed(() => JSON.stringify(form.value) !== baseline.value)
const saving = ref(false)
const error = ref('')
const saved = ref('')
const careersError = ref('')
const careersLoading = ref(false)
const pendingDestination = ref<string | null>(null)
let resolveLeave: ((proceed: boolean) => void) | null = null
function requestLeave() {
  if (saving.value) return false
  if (!dirty.value) return true
  pendingDestination.value = 'navigation'
  return new Promise<boolean>(resolve => { resolveLeave = resolve })
}
function finishLeave(proceed: boolean) {
  if (proceed) resetForm()
  pendingDestination.value = null
  resolveLeave?.(proceed)
  resolveLeave = null
}
onBeforeRouteLeave(requestLeave)
onBeforeRouteUpdate((to, from) => to.params.section !== from.params.section && section.value.id === 'perfil' ? requestLeave() : true)
function resetForm() {
  const user = auth.user
  form.value = {
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
    photoUrl: user?.photo ?? '',
    schoolId: user?.schoolId ?? '',
    department: user?.department ?? '',
    careerId: user?.careerId ?? '',
  }
  baseline.value = JSON.stringify(form.value)
  error.value = ''; saved.value = ''
}
resetForm()
watch(() => auth.user?.id, resetForm)
watch(() => route.params.section, () => { error.value = ''; saved.value = '' })
async function loadCareers() {
  careersLoading.value = true; careersError.value = ''
  try {
    await Promise.all([catalog.loadCareers(), catalog.loadSchools()])
  }
  catch { careersError.value = 'No se pudieron cargar los datos académicos. Puedes volver a intentarlo.' }
  finally { careersLoading.value = false }
}
async function saveProfile() {
  if (saving.value) return
  saving.value = true; error.value = ''; saved.value = ''
  let uploaded: string | null = null
  let persisted = false
  try {
    const photoUrl = form.value.photoUrl.startsWith('data:')
      ? (uploaded = await uploadItemPhoto(form.value.photoUrl))
      : form.value.photoUrl || null
    const response = await apiRequest<{ user: NonNullable<typeof auth.user> }>('/api/me', {
      method: 'PATCH', body: JSON.stringify({ ...form.value, photoUrl }),
    })
    persisted = true
    auth.user = response.user
    resetForm()
    saved.value = 'Tu perfil se actualizó correctamente.'
  } catch (err) {
    if (uploaded && !persisted) await removeItemPhoto(uploaded).catch(() => undefined)
    error.value = err instanceof Error ? err.message : 'No se pudo guardar el perfil. Conservamos tus cambios.'
  } finally { saving.value = false }
}
const fontOptions: { value: FontSize; label: string; sample: string }[] = [
  { value: 'normal', label: 'Normal', sample: 'Aa' }, { value: 'large', label: 'Grande', sample: 'Aa' }, { value: 'larger', label: 'Más grande', sample: 'Aa' },
]
onMounted(loadCareers)
</script>

<template>
  <div class="account-page">
    <SiteHeader />
    <main id="main-content" class="account-page__content" data-ui>
      <header class="account-page__masthead"><router-link :to="auth.isAdmin ? '/admin' : '/inicio'" class="account-page__back">← {{ auth.isAdmin ? 'Administración' : 'Mi inicio' }}</router-link><h1>Mi cuenta</h1><p>Tu identidad en LendIt y una experiencia a tu medida.</p></header>
      <!-- 1100px canvas = 250px navigation + 40px gap + 810px flexible content. -->
      <div class="account-page__layout">
        <aside class="account-page__sidebar">
          <div class="account-page__identity"><img v-if="auth.user?.photo" :src="auth.user.photo" alt="" /><span v-else class="account-page__initial">{{ auth.user?.firstName?.charAt(0) }}</span><div><strong>{{ auth.user?.name }}</strong><span>{{ roleLabel }} · UJAP</span></div></div>
          <nav aria-label="Configuración de tu cuenta"><router-link v-for="item in sections" :key="item.id" :to="`/cuenta/${item.id}`" :aria-current="section.id === item.id ? 'page' : undefined" :class="{ selected: section.id === item.id }"><AccountMenuIcon :name="item.icon" /><span>{{ item.label }}</span></router-link></nav>
          <router-link v-if="!auth.isAdmin" to="/solicitudes" class="account-page__activity"><AccountMenuIcon name="calendar" /><span>Préstamos y fechas<small>Entregas, devoluciones y solicitudes</small></span><span aria-hidden="true">↗</span></router-link>
        </aside>
        <div class="account-page__panel">
          <template v-if="section.id === 'perfil'">
            <header class="account-page__section-title"><h2>Tu perfil</h2><p>Así te identificas y te contactan en la comunidad.</p></header>
            <form class="profile-form" :aria-busy="saving" @submit.prevent="saveProfile">
              <fieldset :disabled="saving" class="profile-form__fields">
                <div class="profile-form__photo"><div><strong>Foto de perfil</strong><p>Visible para la comunidad cuando publicas o conversas.</p></div><PhotoDropzone v-model="form.photoUrl" alt="Foto de perfil" /></div>
                <div class="profile-form__row"><label>Nombre<input v-model="form.firstName" autocomplete="given-name" required maxlength="80" /></label><label>Apellido<input v-model="form.lastName" autocomplete="family-name" required maxlength="80" /></label></div>
                <label>Correo institucional<input :value="auth.user?.email" type="email" readonly aria-describedby="email-hint" /><small id="email-hint">El correo identifica tu cuenta y no se modifica aquí.</small></label>
                <!-- Campos académicos según rol -->
                <template v-if="auth.user?.role === 'PROFESSOR'">
                  <label>Facultad o Escuela
                    <select v-model="form.schoolId" required :disabled="careersLoading || !!careersError" aria-describedby="school-hint">
                      <option value="" disabled>Selecciona tu facultad o escuela</option>
                      <option v-for="school in catalog.schools" :key="school.id" :value="school.id">{{ school.name }}</option>
                    </select>
                    <small id="school-hint">Facultad de adscripción docente en la UJAP.</small>
                  </label>

                  <label>Departamento o Cátedra
                    <input v-model="form.department" type="text" placeholder="Ej. Algoritmos, Estructuras" maxlength="120" aria-describedby="dept-hint" />
                    <small id="dept-hint">Cátedra o área académica en la que impartes docencia.</small>
                  </label>

                  <label>Carrera de adscripción (opcional)
                    <select v-model="form.careerId" :disabled="careersLoading || !!careersError" aria-describedby="prof-career-hint">
                      <option value="">Todas / Sin carrera fija</option>
                      <option v-for="career in catalog.careers" :key="career.id" :value="career.id">{{ career.name }}</option>
                    </select>
                    <small id="prof-career-hint">Programa académico principal asociado a tu cátedra.</small>
                  </label>
                </template>

                <template v-else>
                  <label>Carrera<select v-model="form.careerId" required :disabled="careersLoading || !!careersError" aria-describedby="career-hint"><option v-if="!catalog.careers.some(c => c.id === form.careerId)" :value="form.careerId">{{ auth.user?.career || 'Selecciona tu carrera' }}</option><option v-for="career in catalog.careers" :key="career.id" :value="career.id">{{ career.name }}{{ career.school ? ` · ${career.school.name}` : '' }}</option></select><small id="career-hint">Mantén tu carrera actualizada si cambias de programa académico.</small></label>
                </template>
                <p v-if="careersError" role="alert" class="account-page__error">{{ careersError }} <button type="button" @click="loadCareers">Reintentar</button></p>
                <label>Teléfono<input v-model="form.phone" type="tel" autocomplete="tel" required minlength="7" maxlength="30" /></label>
              </fieldset>
              <p v-if="error" role="alert" class="account-page__error">{{ error }}</p><p v-if="saved" role="status" class="account-page__saved">{{ saved }}</p>
              <footer class="profile-form__footer"><span>{{ dirty ? 'Tienes cambios sin guardar' : 'Tus datos están actualizados' }}</span><div><button class="btn" type="button" :disabled="saving || !dirty" @click="resetForm">Cancelar</button><button class="btn btn--primary" type="submit" :disabled="saving || !dirty">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button></div></footer>
            </form>
          </template>
          <TeacherCredentialPanel v-else-if="section.id === 'acreditacion'" />
          <StudentCardPanel v-else-if="section.id === 'carnet'" />
          <AccountSecurityPanel v-else-if="section.id === 'seguridad'" />
          <section v-else class="account-preferences" aria-labelledby="preferences-title">
            <header class="account-page__section-title"><h2 id="preferences-title">Apariencia y accesibilidad</h2><p>Los cambios se aplican y guardan automáticamente en este navegador.</p></header>
            <fieldset><legend>Tamaño del texto</legend><p>Elige una lectura cómoda para todas las pantallas.</p><div class="account-preferences__choices"><button v-for="(option, index) in fontOptions" :key="option.value" type="button" :aria-pressed="fontSize === option.value" @click="fontSize = option.value"><span :style="{ fontSize: `${18 + index * 5}px` }">{{ option.sample }}</span>{{ option.label }}</button></div></fieldset>
            <fieldset><legend>Tema</legend><div class="account-preferences__choices account-preferences__themes"><button v-for="mode in (['light', 'dark'] as const)" :key="mode" type="button" :aria-pressed="theme === mode" @click="theme = mode"><span class="account-preferences__swatch" :class="`account-preferences__swatch--${mode}`" aria-hidden="true"><i></i><i></i><i></i></span>{{ mode === 'light' ? 'Claro' : 'Oscuro' }}</button></div></fieldset>
            <label class="account-preferences__switch"><span><strong>Colores accesibles</strong><small>Paleta azul y naranja para diferenciar los controles con mayor facilidad.</small></span><input v-model="colorblind" type="checkbox" role="switch" /></label>
            <div class="account-preferences__language"><div><strong>Idioma</strong><p>Español</p></div><span>Idioma disponible</span></div>
          </section>
        </div>
      </div>
    </main>
    <SiteFooter />
    <ModalDialog v-if="pendingDestination" title="Tienes cambios sin guardar" @close="finishLeave(false)"><p>Si sales del perfil, perderás los cambios que aún no guardaste.</p><div class="account-page__dialog-actions"><button class="btn" @click="finishLeave(false)">Seguir editando</button><button class="btn btn--primary" @click="finishLeave(true)">Descartar y salir</button></div></ModalDialog>
  </div>
</template>

<style scoped>
.account-page{background:var(--paper);color:var(--ink);min-height:100svh}.account-page__content{max-width:1212px;margin:auto;padding:32px clamp(20px,4vw,56px) 72px;min-height:75svh}.account-page__masthead{padding-bottom:32px}.account-page__back{display:inline-block;color:var(--ink-soft);font-size:14px;margin-bottom:20px;text-decoration:none}.account-page h1{font:500 36px/1.15 var(--display);letter-spacing:-.035em;margin:0 0 12px}.account-page__masthead p,.account-page__section-title p{color:var(--ink-soft);line-height:1.6;margin:0}.account-page__layout{display:grid;grid-template-columns:250px minmax(0,1fr);gap:40px;align-items:start}.account-page__sidebar{position:sticky;top:110px;min-width:0}.account-page__identity{display:flex;gap:12px;align-items:center;padding:0 8px 24px;border-bottom:1px solid var(--line);margin-bottom:16px}.account-page__identity img,.account-page__initial{width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0}.account-page__initial{display:grid;place-items:center;background:var(--navy);color:var(--on-dark)}.account-page__identity div{display:grid;gap:5px;min-width:0}.account-page__identity strong{font-size:14px;overflow-wrap:anywhere}.account-page__identity div>span{font-size:12px;color:var(--ink-soft)}.account-page__sidebar nav{display:grid;gap:5px}.account-page__sidebar nav a{display:flex;align-items:center;gap:12px;min-height:48px;padding:12px;border-radius:10px;text-decoration:none;color:var(--ink-soft);font-size:14px;line-height:1.4}.account-page__sidebar nav svg{width:19px;flex-shrink:0}.account-page__sidebar nav a.selected{background:var(--crimson-bg);color:var(--crimson-dark);font-weight:600}.account-page__sidebar nav a:hover{background:var(--surface-soft)}.account-page__activity{display:flex;gap:10px;align-items:center;margin:24px 8px 0;padding-top:24px;border-top:1px solid var(--line);color:var(--ink);font-size:13px;text-decoration:none}.account-page__activity>svg{flex-shrink:0}.account-page__activity small{display:block;color:var(--ink-soft);line-height:1.6;font-size:12px;margin-top:4px}.account-page__panel{min-width:0;border:1px solid var(--line);border-radius:18px;padding:28px;background:var(--paper)}.account-page__section-title{margin-bottom:28px}.account-page h2{font:500 27px/1.2 var(--display);margin:0 0 10px}.profile-form{display:grid;gap:20px}.profile-form__fields{display:grid;gap:22px;border:0;padding:0;margin:0;min-width:0}.profile-form label{display:grid;gap:8px;font-weight:600;font-size:14px;min-width:0}.profile-form :is(input,select){min-width:0;width:100%;box-sizing:border-box;border:1px solid var(--line-strong);border-radius:9px;background:var(--paper);color:var(--ink);font:400 16px var(--sans);padding:12px;min-height:46px}.profile-form input[readonly]{background:var(--surface-soft);color:var(--ink-soft)}.profile-form small{font-size:12px;font-weight:400;color:var(--ink-soft);line-height:1.6}.profile-form__row{display:grid;grid-template-columns:1fr 1fr;gap:16px}.profile-form__photo{display:grid;grid-template-columns:1fr 180px;gap:24px;align-items:center;border-bottom:1px solid var(--line);padding-bottom:24px}.profile-form__photo strong{font-size:15px}.profile-form__photo p{font-size:13px;line-height:1.65;color:var(--ink-soft)}.profile-form__footer{border-top:1px solid var(--line);padding-top:20px;display:flex;align-items:center;justify-content:space-between;gap:18px}.profile-form__footer>span{font-size:12px;color:var(--ink-soft)}.profile-form__footer>div{display:flex;gap:10px}.account-page__error{color:var(--crimson-dark);font-size:14px;line-height:1.6}.account-page__error button{font:inherit;color:inherit;border:0;background:none;text-decoration:underline;cursor:pointer;min-height:44px}.account-page__saved{font-size:14px;line-height:1.6}.account-preferences{display:grid;gap:28px}.account-preferences .account-page__section-title{margin:0}.account-preferences fieldset{border:0;border-top:1px solid var(--line);padding:22px 0 0;margin:0;min-width:0}.account-preferences legend{font-weight:600;font-size:15px;padding:0 10px 0 0}.account-preferences p{color:var(--ink-soft);font-size:14px;line-height:1.6}.account-preferences__choices{display:flex;gap:12px;margin-top:16px}.account-preferences__choices button{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:104px;padding:16px 8px;border:1px solid var(--line-strong);border-radius:12px;background:var(--paper);color:var(--ink);font:500 13px var(--sans);cursor:pointer}.account-preferences__choices button>span:first-child{display:grid;place-items:center;min-height:34px}.account-preferences__choices button[aria-pressed=true]{border-color:var(--crimson);background:var(--crimson-bg);color:var(--crimson-dark)}.account-preferences__swatch{display:flex!important;gap:5px;width:90px;height:55px;border:1px solid var(--line-strong);padding:10px;border-radius:6px}.account-preferences__swatch--light{background:var(--paper-2)}.account-preferences__swatch--dark{background:var(--navy)}.account-preferences__swatch i{display:block;width:12px;height:25px;background:var(--gold);border-radius:2px;opacity:.7}.account-preferences__swatch i:nth-child(2){width:35px;opacity:.3}.account-preferences__switch{display:flex;gap:24px;align-items:center;justify-content:space-between;border-top:1px solid var(--line);padding-top:24px}.account-preferences__switch strong,.account-preferences__language strong{font-size:15px}.account-preferences__switch small{display:block;color:var(--ink-soft);font-size:13px;line-height:1.6;margin-top:8px}.account-preferences__switch input{width:44px;height:26px;flex-shrink:0;accent-color:var(--crimson);cursor:pointer}.account-preferences__language{display:flex;justify-content:space-between;align-items:center;gap:20px;border-top:1px solid var(--line);padding-top:24px}.account-preferences__language p{margin:8px 0 0}.account-preferences__language>span{font-size:12px;color:var(--ink-soft)}.account-page__dialog-actions{display:flex;gap:12px;margin-top:24px}.account-page :is(a,button,input,select):focus-visible{outline:2px solid var(--crimson);outline-offset:3px}.account-page button:active:not(:disabled){transform:scale(.98)}@media(max-width:800px){.account-page__layout{grid-template-columns:1fr;gap:24px}.account-page__sidebar{position:static}.account-page__identity{padding-bottom:16px}.account-page__sidebar nav{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.account-page__sidebar nav a{flex-direction:column;text-align:center;gap:8px;padding:12px 6px;font-size:12px}.account-page__activity{margin-top:12px;padding-top:14px}.account-page__panel{padding:24px}.account-page__masthead{padding-bottom:24px}}@media(max-width:480px){.account-page__panel{padding:20px 16px}.profile-form__row{grid-template-columns:1fr}.profile-form__photo{grid-template-columns:1fr 130px;gap:12px}.profile-form__footer{align-items:stretch;flex-direction:column}.profile-form__footer .btn{flex:1}.account-preferences__choices{gap:8px}.account-preferences__choices button{font-size:12px}.account-page__dialog-actions{flex-direction:column}}@media(prefers-reduced-motion:reduce){.account-page button:active:not(:disabled){transform:none}}

.profile-form__photo :deep(.photo-dropzone){position:relative;box-sizing:border-box;min-height:120px;padding:12px}
.profile-form__photo :deep(.photo-dropzone__filled){flex-direction:column;align-items:center;text-align:center;gap:8px}
.profile-form__photo :deep(.photo-dropzone__filled img){width:64px;height:64px}
.profile-form__photo :deep(.photo-dropzone__details){align-items:center}
.profile-form__photo :deep(.photo-dropzone__details>span),.profile-form__photo :deep(.photo-dropzone__details>strong){display:none}
.profile-form__photo :deep(.photo-dropzone__input){width:1px!important;height:1px!important;min-height:0!important;padding:0!important;border:0!important;left:0;top:0}
</style>
