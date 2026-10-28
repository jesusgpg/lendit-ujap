<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { push } from 'notivue'
import { useRoute, useRouter } from 'vue-router'
import ArticleCard from '../components/ArticleCard.vue'
import LoadingState from '../components/LoadingState.vue'
import ModalDialog from '../components/ModalDialog.vue'
import RequestLoanForm from '../components/RequestLoanForm.vue'
import RentalCheckoutModal from '../components/RentalCheckoutModal.vue'
import SiteFooter from '../components/SiteFooter.vue'
import SiteHeader from '../components/SiteHeader.vue'
import { useArticlesStore } from '../stores/articles'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import type { Article, LoanRequest } from '../types'

const router = useRouter()
const route = useRoute()
const articlesStore = useArticlesStore()
const authStore = useAuthStore()
const catalogStore = useCatalogStore()

const search = ref(typeof route.query.search === 'string' ? route.query.search : '')
const selectedCategory = ref(typeof route.query.category === 'string' ? route.query.category : 'all')
const selectedArticle = ref<Article | null>(null)
const offerMode = ref('all')
const sortBy = ref('recent')
const catalogError = ref('')
const selectedCheckoutRequest = ref<LoanRequest | null>(null)

const filteredArticles = computed(() => {
  const query = search.value.trim().toLowerCase()
  const articles = articlesStore.articles.filter((article) => {
    return (selectedCategory.value === 'all' || article.categoryKey === selectedCategory.value)
      && (offerMode.value === 'all' || article.mode === offerMode.value)
      && (!query || [article.title, article.category, article.duration, article.description ?? ''].join(' ').toLowerCase().includes(query))
  })
  return articles.sort((a, b) => sortBy.value === 'title'
    ? a.title.localeCompare(b.title, 'es')
    : (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0))
})
function categoryCount(key: string) { return articlesStore.articles.filter((article) => article.categoryKey === key).length }
watch(() => route.query, (query) => {
  search.value = typeof query.search === 'string' ? query.search : ''
  selectedCategory.value = typeof query.category === 'string' ? query.category : 'all'
})

const isLoading = computed(() => articlesStore.isLoading || (!catalogStore.isInitialized && !catalogError.value))

const loadError = computed(() => catalogError.value || articlesStore.error)

async function loadCatalog() {
  catalogError.value = ''
  try {
    await Promise.all([articlesStore.load(), catalogStore.initialize()])
  } catch (error) {
    catalogError.value = error instanceof Error ? error.message : 'No se pudo cargar el catálogo.'
  }
}

onMounted(() => {
  void loadCatalog()
})

function handleRequest(articleId: string) {
  if (authStore.isAdmin) return
  if (authStore.isTeacherApplicant) {
    push.warning({
      title: 'Acreditación en curso',
      message: 'Las operaciones de marketplace están suspendidas hasta que tu acreditación docente sea aprobada.',
    })
    return
  }
  const article = articlesStore.articles.find((item) => item.id === articleId)
  if (!article) return

  if (!authStore.isAuthenticated) {
    push.info({ title: 'Inicia sesión para pedirlo', message: 'Necesitas una cuenta UJAP para solicitar un objeto.' })
    void router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }

  if (article.ownerId === authStore.user?.id) {
    push.info({ title: 'Es tuyo', message: 'No puedes pedir o alquilar tu propia publicación.' })
    return
  }

  selectedArticle.value = article
}

function closeRequestForm() {
  selectedArticle.value = null
}

function askOwner(articleId: string) {
  if (authStore.isAdmin) return
  const destination = router.resolve({ name: 'messages', query: { item: articleId } })
  void router.push(authStore.isAuthenticated ? destination.fullPath : { name: 'login', query: { redirect: destination.fullPath } })
}

function handleRequestSubmitted(request: LoanRequest) {
  closeRequestForm()
  if (request?.item.mode === 'RENTAL') selectedCheckoutRequest.value = request
}

function closeCheckout() {
  selectedCheckoutRequest.value = null
}

function clearFilters() {
  search.value = ''
  selectedCategory.value = 'all'
  offerMode.value = 'all'
  void router.replace({ name: 'catalog' })
}
</script>

<template>
  <div class="catalog-page">
    <SiteHeader show-marketplace-nav @open-login="router.push({ name: 'login' })" />
    <main id="main-content" class="catalog-content">
      <header class="catalog-heading"><div><h1>Encuentra algo para tu próximo proyecto.</h1><p>Objetos que la comunidad UJAP comparte para estudiar, crear y resolver el día.</p></div><router-link v-if="!authStore.isAdmin" class="btn btn--primary" to="/publicar">Publicar un objeto</router-link></header>
      <div class="catalog-browser">
        <aside class="catalog-sidebar" aria-label="Filtros del catálogo">
          <h2>Categorías</h2>
          <div class="catalog-category-list">
            <button type="button" :class="{ 'is-selected': selectedCategory === 'all' }" :aria-pressed="selectedCategory === 'all'" @click="selectedCategory = 'all'">Todos los objetos <span>{{ articlesStore.articles.length }}</span></button>
            <button v-for="category in catalogStore.categories" :key="category.key" type="button" :class="{ 'is-selected': selectedCategory === category.key }" :aria-pressed="selectedCategory === category.key" @click="selectedCategory = category.key">{{ category.label }} <span>{{ categoryCount(category.key) }}</span></button>
          </div>
          <div class="catalog-sidebar-note"><span>Entre estudiantes UJAP</span><p>Revisa las condiciones y acuerda la entrega con quien publica.</p><router-link to="/como-funciona">Cómo funciona ↗</router-link></div>
        </aside>
        <section class="catalog-results" aria-labelledby="catalog-title">
          <div class="catalog-search-row">
            <label class="catalog-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><span class="sr-only">Buscar objetos</span><input v-model="search" type="search" placeholder="Busca un objeto, categoría o duración" /><button v-if="search" type="button" aria-label="Limpiar búsqueda" @click="search = ''" >×</button></label>
            <label class="catalog-mode"><span class="sr-only">Tipo de publicación</span><select v-model="offerMode"><option value="all">Préstamos y alquileres</option><option value="LOAN">Préstamos gratuitos</option><option value="RENTAL">Alquileres</option></select></label>
          </div>
          <div class="catalog-result-heading"><div><h2 id="catalog-title">{{ selectedCategory === 'all' ? 'Todos los objetos' : catalogStore.categories.find(c => c.key === selectedCategory)?.label || 'Resultados' }}</h2><p aria-live="polite">{{ isLoading ? 'Cargando publicaciones…' : `${filteredArticles.length} ${filteredArticles.length === 1 ? 'objeto para explorar' : 'objetos para explorar'}` }}</p></div><label class="catalog-sort"><span>Ordenar por</span><select v-model="sortBy"><option value="recent">Más recientes</option><option value="title">Nombre</option></select></label></div>
          <div v-if="search || selectedCategory !== 'all' || offerMode !== 'all'" class="catalog-active-filters"><span>{{ search ? `Búsqueda: ${search}` : 'Filtros activos' }}</span><button type="button" @click="clearFilters">Limpiar filtros ×</button></div>
          <LoadingState v-if="isLoading" label="Cargando objetos del campus…" />
          <div v-else-if="loadError" class="catalog-message" role="status"><h3>No pudimos cargar el catálogo.</h3><p>{{ loadError }}</p><button class="btn btn--ghost" @click="loadCatalog">Intentar de nuevo</button></div>
          <div v-else-if="!filteredArticles.length" class="catalog-message"><h3>No hay coincidencias todavía.</h3><p>Prueba otra búsqueda o cambia los filtros para encontrar lo que necesitas.</p><button class="btn btn--ghost" @click="clearFilters">Ver todos los objetos</button></div>
          <div v-else class="catalog-grid"><ArticleCard v-for="article in filteredArticles" :key="article.id" :article="article" :is-own="article.ownerId === authStore.user?.id" :read-only="authStore.isAdmin" @request="handleRequest" @question="askOwner" /></div>
        </section>
      </div>
    </main>
    <SiteFooter />
    <ModalDialog v-if="selectedArticle" wide title="Solicitar objeto" @close="closeRequestForm"><RequestLoanForm :article="selectedArticle" @submitted="handleRequestSubmitted" /></ModalDialog>
    <RentalCheckoutModal v-if="selectedCheckoutRequest" :request="selectedCheckoutRequest" @close="closeCheckout" />
  </div>
</template>

<style scoped>
.catalog-page{min-height:100svh;background:var(--paper)}.catalog-content{max-width:1440px;margin:auto;padding:42px clamp(20px,4vw,56px) 80px;min-height:75svh}.catalog-heading{display:flex;align-items:center;justify-content:space-between;gap:28px;margin-bottom:38px}.catalog-heading h1{max-width:23ch;font-size:clamp(30px,3.6vw,48px);line-height:1.08;letter-spacing:-.035em}.catalog-heading p{max-width:65ch;margin-top:12px;font-size:16px}.catalog-heading .btn{flex:0 0 auto}.catalog-browser{display:grid;grid-template-columns:226px minmax(0,1fr);gap:38px}.catalog-sidebar{padding-right:22px;border-right:1px solid var(--line)}.catalog-sidebar h2{font:650 16px var(--sans);margin:10px 0 18px}.catalog-category-list{display:flex;flex-direction:column;gap:5px}.catalog-category-list button{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:43px;padding:10px 12px;border:0;border-radius:9px;background:transparent;color:var(--ink-soft);font:500 14px/1.4 var(--sans);text-align:left;cursor:pointer}.catalog-category-list button span{font-size:12px;color:var(--ink-faint)}.catalog-category-list button:hover{background:var(--surface-soft)}.catalog-category-list button.is-selected{background:var(--navy);color:var(--on-dark)}.catalog-category-list button.is-selected span{color:var(--on-dark-soft)}.catalog-sidebar-note{padding:20px 14px;margin-top:30px;background:var(--paper-2);border-radius:12px}.catalog-sidebar-note>span{font-size:13px;font-weight:650;color:var(--navy)}.catalog-sidebar-note p{margin:8px 0 13px;font-size:13px;line-height:1.6}.catalog-sidebar-note a{font-size:13px;font-weight:650;color:var(--crimson-dark);text-decoration:none}.catalog-search-row{display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:12px}.catalog-search{display:flex;gap:12px;align-items:center;padding:0 16px;min-height:52px;background:var(--surface-soft);border:1px solid transparent;border-radius:12px}.catalog-search:focus-within{border-color:var(--crimson)}.catalog-search svg{width:20px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.7}.catalog-search input{width:100%;min-width:0;border:0;outline:none;background:transparent;font:400 15px var(--sans);color:var(--ink)}.catalog-search button{border:0;background:transparent;font-size:24px;color:var(--ink-soft);cursor:pointer}.catalog-mode select{width:100%;height:52px;border:1px solid var(--line);border-radius:12px;padding:0 12px;background:var(--paper);font:400 14px var(--sans);color:var(--ink)}.catalog-result-heading{display:flex;justify-content:space-between;align-items:center;gap:20px;margin:28px 0 22px}.catalog-result-heading h2{font:650 20px var(--sans)}.catalog-result-heading p{margin-top:5px;font-size:14px;color:var(--ink-soft)}.catalog-sort{display:flex;align-items:center;gap:7px;font-size:13px}.catalog-sort select{max-width:150px;padding:8px;border:0;background:var(--paper);color:var(--ink);font:600 13px var(--sans)}.catalog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:30px 22px;align-items:start}.catalog-active-filters{display:flex;align-items:center;gap:14px;margin-bottom:20px;font-size:13px}.catalog-active-filters button{padding:7px 12px;border:0;border-radius:999px;background:var(--paper-2);color:var(--crimson-dark);font:600 13px var(--sans);cursor:pointer}.catalog-message{padding:48px 28px;text-align:center;background:var(--surface-soft);border-radius:16px}.catalog-message h3{font-size:26px}.catalog-message p{margin:12px 0 22px;font-size:16px}.catalog-search input:focus-visible{outline:2px solid var(--crimson);outline-offset:4px}@media(max-width:1000px){.catalog-browser{grid-template-columns:190px minmax(0,1fr);gap:24px}.catalog-search-row{grid-template-columns:1fr}.catalog-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.catalog-content{padding-top:28px}.catalog-heading{align-items:flex-start;flex-direction:column;margin-bottom:26px}.catalog-heading h1{font-size:34px}.catalog-browser{grid-template-columns:minmax(0,1fr);gap:22px}.catalog-sidebar{padding:0;border:0}.catalog-sidebar h2,.catalog-sidebar-note{display:none}.catalog-category-list{flex-direction:row;overflow-x:auto;padding-bottom:6px}.catalog-category-list button{white-space:nowrap;flex:0 0 auto;background:var(--surface-soft)}.catalog-category-list button span{display:none}.catalog-result-heading{align-items:flex-start}.catalog-sort{flex-direction:column;gap:0;align-items:flex-end}.catalog-grid{gap:24px 14px}}@media(max-width:450px){.catalog-grid{grid-template-columns:1fr}.catalog-heading h1{font-size:32px}.catalog-result-heading h2{font-size:19px}}
</style>
