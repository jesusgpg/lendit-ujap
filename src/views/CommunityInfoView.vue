<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useCatalogStore } from '../stores/catalog'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{ section: 'how' | 'categories' | 'trust' }>()
const router = useRouter()
const catalog = useCatalogStore()
const auth = useAuthStore()
const error = ref('')
const brokenImages = ref(new Set<string>())
const content = computed(() => ({
  how: { title: 'De encontrarlo a devolverlo.', description: 'Así se coordina un préstamo o alquiler dentro de la comunidad UJAP.' },
  categories: { title: 'Encuentra tu categoría.', description: 'Equipo, materiales y objetos que pueden ayudarte en el campus. Elige una categoría para ver sus publicaciones.' },
  trust: { title: 'Compartir con acuerdos claros.', description: 'Qué revisar antes de solicitar, entregar y devolver un objeto en LendIt.' },
}[props.section]))
const steps = [
  { title: 'Encuentra el objeto', text: 'Busca en el catálogo y revisa las fotos, la descripción, la duración y si es un préstamo gratuito o un alquiler.' },
  { title: 'Envía tu solicitud', text: 'Inicia sesión y propone una fecha de inicio y devolución. Agrega un mensaje con lo que necesites aclarar.' },
  { title: 'Acuerden la entrega', text: 'La persona propietaria revisa la solicitud. Usen el chat para confirmar el lugar de encuentro y las condiciones del objeto.' },
  { title: 'Devuelve y confirma', text: 'Entrega el objeto en la fecha acordada. La persona propietaria registra la devolución para cerrar el préstamo.' },
]
const guidelines = [
  { title: 'Antes de solicitar', text: 'Revisa el estado del objeto, sus accesorios y la duración disponible. Pregunta por el chat si la publicación deja alguna duda.' },
  { title: 'Al entregar', text: 'Acuerden un lugar concurrido del campus. Revisen juntos el objeto y confirmen qué accesorios se están entregando.' },
  { title: 'Durante el préstamo', text: 'Cuida el objeto y avisa por el chat si surge un inconveniente. Cambiar una fecha requiere acordarlo con la otra persona.' },
  { title: 'Al devolver', text: 'Revisen el estado y los accesorios. La devolución debe quedar registrada en la solicitud.' },
]
async function loadCategories() {
  error.value = ''
  try { await catalog.initialize() } catch { error.value = 'No pudimos cargar las categorías. Intenta de nuevo.' }
}
watch(() => props.section, (section) => { if (section === 'categories') void loadCategories() }, { immediate: true })
</script>

<template>
  <div class="community-page">
    <SiteHeader show-marketplace-nav @open-login="router.push({ name: 'login' })" />
    <main id="main-content" class="community-content">
      <nav class="community-tabs" aria-label="Conoce LendIt">
        <router-link to="/como-funciona">Cómo funciona</router-link>
        <router-link to="/categorias">Categorías</router-link>
        <router-link to="/confianza">Confianza</router-link>
      </nav>
      <header class="community-heading"><h1>{{ content.title }}</h1><p>{{ content.description }}</p></header>

      <template v-if="section === 'how'">
        <ol class="community-steps"><li v-for="(step, index) in steps" :key="step.title"><span>{{ index + 1 }}</span><div><h2>{{ step.title }}</h2><p>{{ step.text }}</p></div></li></ol>
        <aside v-if="!auth.isAdmin" class="community-callout"><h2>¿Quieres compartir algo?</h2><p>Publica fotos del objeto, describe su estado y define su disponibilidad. Podrás revisar las solicitudes desde tu cuenta.</p><router-link class="btn btn--primary" to="/publicar">Publicar un objeto</router-link></aside>
      </template>
      <template v-else-if="section === 'categories'">
        <p v-if="error" class="community-state" role="status">{{ error }} <button class="btn btn--ghost" @click="loadCategories">Reintentar</button></p>
        <p v-else-if="!catalog.isInitialized" class="community-state" role="status">Cargando categorías…</p>
        <div v-else-if="catalog.categories.length" class="community-category-grid">
          <article v-for="category in catalog.categories" :key="category.key" class="community-category">
            <router-link class="community-category-link" :to="{ name: 'catalog', query: { category: category.key } }">
              <div class="community-category-media">
                <img v-if="category.imagenUrl && !brokenImages.has(category.key)" :src="category.imagenUrl" :alt="category.imagenAlt || category.label" width="600" height="400" loading="lazy" decoding="async" @error="brokenImages.add(category.key)" />
                <span v-else class="community-category-fallback">{{ category.label }}<small>Explora esta categoría</small></span>
              </div>
              <div class="community-category-body"><h2>{{ category.label }}</h2><p>{{ category.blurb || 'Explora los objetos publicados en esta categoría.' }}</p><span class="community-category-action">Explorar objetos <span aria-hidden="true">↗</span></span></div>
            </router-link>
          </article>
        </div>
        <p v-else class="community-state">Todavía no hay categorías publicadas.</p>
      </template>
      <template v-else>
        <div class="community-guidelines"><article v-for="guideline in guidelines" :key="guideline.title"><h2>{{ guideline.title }}</h2><p>{{ guideline.text }}</p></article></div>
        <aside class="community-callout"><h2>Sobre los alquileres</h2><p>Desde Solicitudes puedes revisar el importe, completar el pago y consultar su estado.</p><router-link class="btn btn--paper" to="/como-funciona">Ver cómo funciona</router-link></aside>
      </template>
      <div class="community-bottom"><p>Lo que necesitas puede estar en el campus.</p><router-link class="btn btn--primary" to="/catalogo">Explorar catálogo</router-link></div>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.community-content{max-width:1280px;margin:auto;padding:32px clamp(20px,4vw,56px) 72px}.community-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:44px}.community-tabs a{padding:9px 17px;border-radius:999px;text-decoration:none;color:var(--ink-soft);font-size:14px}.community-tabs a.router-link-active{background:var(--navy);color:var(--on-dark)}.community-heading{max-width:800px;margin-bottom:42px}.community-heading h1{font-size:clamp(36px,5vw,64px);line-height:1.06;letter-spacing:-.04em}.community-heading p{max-width:62ch;margin-top:18px;font-size:18px;line-height:1.6}.community-steps{list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin:0;padding:0}.community-steps li{display:flex;gap:22px;padding:28px;background:var(--surface-soft);border-radius:16px}.community-steps li>span{font:500 38px/1 var(--display);color:var(--crimson)}.community-steps h2,.community-guidelines h2{font:650 21px/1.25 var(--sans);margin-bottom:10px}.community-steps p,.community-guidelines p{font-size:16px;line-height:1.65}.community-callout{margin-top:32px;padding:34px;border-radius:18px;background:var(--navy);color:var(--on-dark)}.community-callout h2{color:var(--on-dark);font-size:30px}.community-callout p{max-width:70ch;margin:12px 0 20px;color:var(--on-dark-soft)}.community-category-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.community-category-link{display:block;background:var(--surface-soft);border-radius:16px;text-decoration:none;transition:transform 180ms var(--ease-out),background 180ms ease}.community-category-mark{display:grid;place-items:center;width:48px;height:48px;margin-bottom:25px;border-radius:12px;background:var(--paper-2);color:var(--navy);font:500 28px var(--display)}.community-category-grid h2{font:650 21px/1.25 var(--sans)}.community-category-grid p{margin:10px 0 24px;font-size:15px;min-height:48px}.community-category-action{display:flex;justify-content:space-between;font-size:14px;font-weight:650;color:var(--crimson-dark)}.community-guidelines{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}.community-guidelines article{padding:28px;background:var(--surface-soft);border-radius:16px}.community-bottom{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-top:48px}.community-bottom p{font:500 25px var(--display);color:var(--ink)}.community-state{padding:32px;background:var(--surface-soft);border-radius:12px}.community-state button{margin-left:12px}@media(hover:hover) and (pointer:fine){.community-category-link:hover{transform:translateY(-3px);background:var(--paper-2)}}@media(max-width:800px){.community-category-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.community-heading{margin-bottom:28px}}@media(max-width:600px){.community-category-grid,.community-steps,.community-guidelines{grid-template-columns:1fr}.community-tabs{margin-bottom:28px}.community-steps li,.community-guidelines article,.community-callout{padding:22px}.community-bottom{align-items:flex-start;flex-direction:column}}
.community-category { min-width: 0; background: var(--surface-soft); border-radius: 16px; overflow: hidden; display:flex; flex-direction:column; }
.community-category-link { display:flex; flex-direction:column; flex:1; }
.community-category-media { aspect-ratio: 3 / 2; overflow: hidden; background: var(--paper-2); }
.community-category-media img { display: block; width: 100%; height: 100%; object-fit: cover; }
.community-category-fallback { height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 12px; padding: 24px; box-sizing: border-box; color: var(--navy); font: 500 28px/1.2 var(--display); }
.community-category-fallback small { font: 14px/1.5 var(--sans); color: var(--ink-soft); }
.community-category-body { padding: 24px; display:flex; flex-direction:column; flex:1; }
.community-category-body h2 { min-height:2.5em; }
.community-category-action { margin-top:auto; }
.community-category-link:focus-visible { outline: 3px solid var(--crimson); outline-offset: -3px; }
@media (prefers-reduced-motion: reduce) { .community-category-link { transition: none; } .community-category-link:hover { transform: none; } }
</style>
