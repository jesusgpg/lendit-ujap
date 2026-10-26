<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { push } from 'notivue'
import { useRoute, useRouter } from 'vue-router'
import { getAppTagline } from '../data'
import { useAuthStore } from '../stores/auth'
import { useArticlesStore } from '../stores/articles'
import type { Article } from '../types'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import ItemPhotoGallery from '../components/ItemPhotoGallery.vue'
import ModalDialog from '../components/ModalDialog.vue'
import RequestLoanForm from '../components/RequestLoanForm.vue'

const tagline = getAppTagline()
const campusSrc = `${import.meta.env.BASE_URL}images/ujap_escultura.jpg`
const crestSrc = `${import.meta.env.BASE_URL}images/Logo-UJAP1.png`

const authStore = useAuthStore()
const articlesStore = useArticlesStore()
const route = useRoute()
const router = useRouter()
const search = ref('')
const selectedArticle = ref<Article | null>(null)
const matchingArticles = computed(() => {
  const query = search.value.trim().toLowerCase()
  return articlesStore.articles.filter((article) => {
    if (article.status !== 'available') return false
    return !query || [article.title, article.category, article.duration, article.description ?? '']
      .join(' ')
      .toLowerCase()
      .includes(query)
  })
})
const featuredArticles = computed(() => matchingArticles.value.slice(0, 4))
const isLoading = computed(() => articlesStore.isLoading || (!articlesStore.isInitialized && !articlesStore.error))

function openLogin(thenOpenPublish = false) {
  if (thenOpenPublish) {
    void router.push({ name: 'login', query: { redirect: '/publicar' } })
    return
  }
  void router.push({ name: 'login' })
}

function openPublish() {
  if (!authStore.isAuthenticated) {
    openLogin(true)
    return
  }
  void router.push({ name: 'publish' })
}

onMounted(() => {
  if (route.query.publish === '1' && authStore.isAuthenticated) {
    void router.replace({ name: 'publish' })
  }

  void articlesStore.initialize()
})

function handleLogout() {
  push.info({ title: 'Sesión cerrada', message: 'Puedes volver a entrar cuando lo necesites.' })
}


function goToCatalog() {
  const query = search.value.trim()
  void router.push({ name: 'catalog', query: query ? { search: query } : {} })
}

function handleRequest(articleId: string) {
  const article = articlesStore.articles.find((item) => item.id === articleId)
  if (!article) return
  if (!authStore.isAuthenticated) {
    push.info({ title: 'Inicia sesión para solicitarlo', message: 'Necesitas una cuenta UJAP para pedir este objeto.' })
    void router.push({ name: 'login' })
    return
  }
  if (article.ownerId === authStore.user?.id) {
    push.info({ title: 'Esta publicación es tuya', message: 'No puedes solicitar tu propio objeto.' })
    return
  }
  selectedArticle.value = article
}

function formatOffer(article: Article) {
  if (article.mode !== 'RENTAL' || article.price === null || !article.currency) return 'Préstamo gratuito'
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: article.currency, maximumFractionDigits: 2 }).format(article.price)
}

function closeRequestForm() {
  selectedArticle.value = null
}

</script>

<template>
  <div class="landing-layout">
    <aside class="campus-panel" aria-label="Campus de la Universidad José Antonio Páez">
      <img :src="campusSrc" alt="Escultura emblemática del campus UJAP en San Diego, Carabobo" />
      <div class="campus-panel__wash"></div>
      <div class="campus-panel__crest"><img :src="crestSrc" alt="Escudo de la Universidad José Antonio Páez" /></div>
      <div class="campus-panel__caption">
        <span class="campus-panel__rule" aria-hidden="true"></span>
        <span class="campus-panel__place">San Diego, Carabobo</span>
      </div>
    </aside>

    <div class="landing-column">
      <SiteHeader @open-login="openLogin()" @logout="handleLogout" />
      <main id="main-content">
        <section class="landing-hero" aria-labelledby="landing-title">
          <h1 id="landing-title">Encuentra lo que te falta.</h1>
          <p class="landing-intro">{{ tagline }}</p>

          <form class="landing-search" role="search" @submit.prevent="goToCatalog">
            <label for="landing-search-input">¿Qué necesitas para este semestre?</label>
            <div class="landing-search__control">
              <input id="landing-search-input" v-model="search" type="search" placeholder="Ej. calculadora, cámara, libro…" />
              <button class="landing-search__submit" type="submit" aria-label="Buscar en el catálogo">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.2 4.2" /></svg>
              </button>
            </div>
            <div class="landing-search__foot">
              <span>Busca por nombre o categoría</span>
              <router-link to="/catalogo">Ver catálogo completo <span aria-hidden="true">↗</span></router-link>
            </div>
          </form>

          <div class="landing-actions">
            <button class="btn btn--primary" type="button" @click="openPublish">Publicar un objeto</button>
            <router-link class="landing-actions__link" to="/como-funciona">Cómo funciona</router-link>
          </div>
        </section>

        <section class="listing-section" aria-labelledby="listings-title">
          <div class="section-heading">
            <h2 id="listings-title">Disponibles en el campus</h2>
          </div>

          <p v-if="search && !isLoading" class="results-note" aria-live="polite">
            {{ matchingArticles.length }} {{ matchingArticles.length === 1 ? 'resultado' : 'resultados' }} para “{{ search }}”
          </p>
          <p v-if="articlesStore.error" class="catalog-note catalog-note--error" role="status">
            El catálogo no está disponible ahora. Puedes volver a intentarlo desde Explorar.
            <router-link to="/catalogo" class="text-link">Abrir Explorar <span aria-hidden="true">↗</span></router-link>
          </p>
          <div v-else-if="isLoading" class="catalog-note" role="status">Cargando publicaciones del campus…</div>
          <TransitionGroup v-else-if="featuredArticles.length" name="listing" tag="div" class="landing-listings">
            <article v-for="article in featuredArticles" :key="article.id" class="landing-item-card">
              <ItemPhotoGallery class="landing-item-card__gallery" :photo-urls="article.photoUrls" :photo-url="article.photoUrl" :title="article.title" :category-icon="article.category.slice(0, 1)" />
              <div class="landing-item-card__body">
                <div class="landing-item-card__meta"><span>{{ article.category }}</span><span class="landing-item-card__status">Disponible</span></div>
                <h3>{{ article.title }}</h3>
                <p>{{ article.duration }} · {{ formatOffer(article) }}</p>
                <button class="landing-item-card__action" type="button" @click="handleRequest(article.id)">Consultar objeto <span aria-hidden="true">↗</span></button>
              </div>
            </article>
          </TransitionGroup>
          <div v-else class="catalog-note catalog-note--empty">
            <strong>{{ search ? 'No encontramos ese objeto.' : 'Todavía no hay objetos disponibles.' }}</strong>
            <span>{{ search ? 'Prueba otra búsqueda o explora todas las categorías.' : 'Sé la primera persona en compartir algo útil para el campus.' }}</span>
            <button v-if="search" class="text-link" type="button" @click="search = ''">Limpiar búsqueda</button>
            <button v-else class="text-link" type="button" @click="openPublish">Publicar un objeto <span aria-hidden="true">↗</span></button>
          </div>
        </section>



      </main>
      <SiteFooter />
    </div>

    <ModalDialog v-if="selectedArticle" wide title="Solicitar objeto" @close="closeRequestForm">
      <RequestLoanForm :article="selectedArticle" @submitted="closeRequestForm" />
    </ModalDialog>
  </div>
</template>

<style scoped>
.landing-layout {
  min-height: 100svh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  background: var(--paper);
  --ink-soft: #4f4b3c;
}

.campus-panel {
  position: sticky;
  top: 0;
  height: 100svh;
  min-height: 620px;
  overflow: hidden;
  isolation: isolate;
  background: var(--navy);
  color: var(--on-dark);
}

.campus-panel > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 52% center;
  filter: saturate(.82) contrast(1.04);
  animation: campus-arrive 700ms cubic-bezier(.23, 1, .32, 1) both;
}

.campus-panel__wash {
  position: absolute;
  z-index: 0;
  inset: 0;
  background: rgba(13, 23, 48, .24);
}

.campus-panel__crest {
  position: absolute;
  top: clamp(28px, 5vw, 64px);
  right: clamp(24px, 5vw, 64px);
  width: clamp(74px, 9vw, 112px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  padding: 14px;
  border: 2px solid var(--gold-light);
  border-radius: 50%;
  background: var(--paper-2);
}

.campus-panel__crest img { width: 100%; height: 100%; object-fit: contain; }

.campus-panel__caption {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: clamp(30px, 5vw, 68px);
  background: var(--navy);
}

.campus-panel__place { color: var(--on-dark-soft); font: 14px/1.4 var(--sans); }

.campus-panel__rule { display: block; width: 54px; height: 3px; margin-bottom: 14px; background: var(--gold-light); }
.landing-column { min-width: 0; background: var(--paper); }
.landing-column :deep(.site-header) { border-bottom: 0; }
.landing-column :deep(.site-header__inner) { max-width: none; padding-inline: clamp(22px, 4vw, 54px); gap: 20px; }
.landing-column :deep(.site-nav) { gap: clamp(12px, 2vw, 25px); }
.landing-column :deep(.site-nav a) { font-size: 14px; }
.landing-column :deep(.site-header .btn--primary) { box-shadow: none; }
.landing-column main { max-width: 920px; margin: 0 auto; }

.landing-hero {
  padding: clamp(40px, 6vw, 74px) clamp(24px, 5.8vw, 76px) 40px;
  animation: landing-arrive 420ms cubic-bezier(.23, 1, .32, 1) both;
}

.landing-hero h1 { max-width: 10ch; font-size: clamp(43px, 5.2vw, 68px); line-height: .99; letter-spacing: -.045em; text-wrap: balance; }
.landing-intro { max-width: 52ch; margin-top: 18px; color: var(--ink-soft); font-size: 16px; line-height: 1.65; }

.landing-search {
  margin-top: 30px;
  padding: 16px;
  border-radius: 12px;
  background: var(--paper-2);
}

.landing-search > label { display: block; margin-bottom: 8px; color: var(--ink); font-size: 13px; font-weight: 650; }
.landing-search__control { display: flex; gap: 8px; }
.landing-search__control input { min-width: 0; flex: 1; height: 48px; padding: 0 15px; border: 1px solid var(--line-strong); border-radius: 8px; background: white; color: var(--ink); font: inherit; font-size: 14px; }
.landing-search__control input:focus-visible { outline: 2px solid var(--crimson); outline-offset: 2px; }
.landing-search__submit { width: 48px; height: 48px; display: grid; flex: 0 0 auto; place-items: center; border: 0; border-radius: 8px; background: var(--crimson); color: white; cursor: pointer; transition: background 160ms ease, transform 160ms cubic-bezier(.23, 1, .32, 1); }
.landing-search__submit svg { width: 21px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
.landing-search__submit:hover { background: var(--crimson-dark); }
.landing-search__submit:active { transform: scale(.97); }
.landing-search__foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 11px; color: var(--ink-soft); font-size: 13px; }
.landing-search__foot a,.text-link { color: var(--navy); font-size: 13px; font-weight: 650; text-decoration: none; }
.landing-search__foot a:hover,.text-link:hover { color: var(--crimson-dark); text-decoration: underline; text-underline-offset: 3px; }
.landing-search__foot a span,.text-link span { margin-left: 4px; color: var(--crimson); }
.landing-actions { display: flex; align-items: center; gap: 20px; margin-top: 20px; }
.landing-actions .btn--primary { box-shadow: none; }
.landing-actions__link { color: var(--ink-soft); font-size: 13px; font-weight: 600; text-decoration-color: var(--gold); text-underline-offset: 4px; }
.landing-actions__link:hover { color: var(--crimson-dark); }

.listing-section { padding: 42px clamp(24px, 5.8vw, 76px); scroll-margin-top: 82px; }
.section-heading { display: flex; justify-content: space-between; align-items: end; gap: 18px; margin-bottom: 19px; }
.section-heading h2 { max-width: 22ch; font-family: var(--display); font-size: clamp(25px, 3vw, 36px); line-height: 1.08; letter-spacing: -.025em; }
.section-heading p { margin-top: 9px; color: var(--ink-soft); font-size: 16px; }
.text-link { white-space: nowrap; border: 0; background: transparent; font-family: var(--sans); cursor: pointer; }
.results-note { margin: -7px 0 14px; color: var(--ink-soft); font-size: 13px; }
.landing-listings { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.landing-item-card { min-width: 0; overflow: hidden; border: 0; border-radius: 10px; background: var(--paper-2); transition: transform 180ms cubic-bezier(.23, 1, .32, 1); }
.landing-item-card__gallery { height: 174px; border-radius: 0; background: var(--paper-2); }
.landing-item-card__gallery :deep(.item-gallery__fallback-icon) { font-size: 44px; }
.landing-item-card__gallery :deep(.item-gallery__image) { transition: transform 300ms cubic-bezier(.23, 1, .32, 1); }
.landing-item-card__body { padding: 13px 14px 15px; }
.landing-item-card__meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; color: var(--crimson-dark); font-size: 13px; font-weight: 650; }
.landing-item-card__status { display: inline-flex; align-items: center; gap: 5px; color: #3f6038; font-size: 13px; }
.landing-item-card__status::before { width: 6px; height: 6px; border-radius: 50%; background: #4b7a43; content: ''; }
.landing-item-card h3 { margin-top: 6px; overflow: hidden; color: var(--ink); font-family: var(--display); font-size: 18px; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.landing-item-card__body > p { margin-top: 4px; color: var(--ink-soft); font-size: 13px; }
.landing-item-card__action { display: flex; justify-content: space-between; width: 100%; margin-top: 13px; padding: 8px 0 0; border: 0; background: transparent; color: var(--navy); font: 650 13px var(--sans); text-align: left; cursor: pointer; }
.landing-item-card__action span { color: var(--crimson); transition: transform 150ms ease; }
.landing-item-card__action:hover span { transform: translate(2px,-2px); }
.catalog-note { padding: 22px 18px; border: 1px solid var(--line); background: var(--paper-2); color: var(--ink-soft); font-size: 14px; line-height: 1.5; }
.catalog-note--empty { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.catalog-note--empty strong { color: var(--ink); font-family: var(--display); font-size: 19px; }
.catalog-note--empty .text-link { padding: 8px 0 0; }
.catalog-note--error { color: var(--crimson-dark); }
.listing-enter-active,.listing-leave-active,.listing-move { transition: opacity 180ms ease, transform 180ms cubic-bezier(.23, 1, .32, 1); }
.listing-enter-from,.listing-leave-to { opacity: 0; transform: translateY(8px); }

.landing-column :deep(.site-footer) { padding: 26px clamp(24px, 5.8vw, 76px) 32px; border-top: 0; }
.landing-column :deep(.site-footer__note) { color: var(--ink-soft); font-family: var(--sans); font-size: 13px; }
.landing-column :deep(.brand--footer p) { color: var(--ink-soft); font-size: 13px; }

@keyframes landing-arrive { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes campus-arrive { from { opacity: .78; transform: scale(1.025); } to { opacity: 1; transform: scale(1); } }
@keyframes section-reveal { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

@supports (animation-timeline: view()) {
  .landing-item-card {
    animation: section-reveal linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 34%;
  }
  .landing-item-card:nth-child(2) { animation-range: entry 8% entry 42%; }
}

@media (hover: hover) and (pointer: fine) {
  .landing-item-card:hover { transform: translateY(-2px); }
  .landing-item-card:hover :deep(.item-gallery__image) { transform: scale(1.025); }
}

@media (max-width: 1100px) {
  .landing-layout { grid-template-columns: minmax(0, .82fr) minmax(0, 1.18fr); }
  .landing-column :deep(.site-header__inner) { padding-inline: 22px; gap: 12px; }
  .landing-column :deep(.site-nav) { gap: 13px; }
  .landing-column :deep(.brand__crest) { width: 38px; height: 38px; }
  .landing-column :deep(.brand__name) { font-size: 19px; }
}


@media (max-width: 760px) {
  .landing-layout { display: flex; flex-direction: column; }
  .campus-panel { position: relative; height: 52svh; min-height: 320px; max-height: 520px; order: 0; }
  .campus-panel__caption { right: 0; bottom: 0; left: 0; padding: 24px 26px; }
  .campus-panel__crest { top: 22px; right: 22px; width: 76px; }
  .landing-column { order: 1; }
  .landing-column :deep(.site-header) { position: sticky; top: 0; }
  .landing-column :deep(.site-header__inner) { padding: 10px 18px; }
  .landing-column main { max-width: none; }
  .landing-hero { padding: 34px 22px 32px; }
  .landing-hero h1 { max-width: 12ch; font-size: clamp(42px, 10vw, 60px); }
  .landing-intro { font-size: 15px; }
  .listing-section { padding: 30px 22px 34px; }
  .section-heading h2 { font-size: 29px; }
  .landing-column :deep(.site-footer) { padding: 24px 22px 30px; }
}

@media (max-width: 480px) {
  .campus-panel { height: 44svh; min-height: 280px; }
  .campus-panel__caption { padding: 20px 22px; }
  .campus-panel__place { font-size: 13px; }
  .landing-column :deep(.brand__crest) { width: 34px; height: 34px; }
  .landing-column :deep(.brand__name) { font-size: 17px; }
  .landing-column :deep(.site-header__inner) { gap: 8px; }
  .landing-column :deep(.site-header__actions) { gap: 6px; }
  .landing-column :deep(.site-header__actions .btn) { padding: 8px 13px; font-size: 12px; }
  .landing-hero { padding-inline: 18px; }
  .landing-search { padding: 13px; }
  .landing-search__foot { align-items: flex-start; flex-direction: column; }
  .landing-actions { align-items: flex-start; flex-direction: column; gap: 13px; }
  .listing-section { padding-inline: 18px; }
  .section-heading { align-items: flex-start; }
  .section-heading h2 { font-size: 26px; }
  .landing-listings { grid-template-columns: 1fr; }
  .landing-item-card__gallery { height: 210px; }
  .landing-column :deep(.site-footer) { padding-inline: 18px; }
}

@media (prefers-reduced-motion: reduce) {
  .landing-hero,.campus-panel > img { animation: none; }
  .landing-item-card { animation: none !important; }
  .landing-item-card,.landing-item-card__action span,.landing-item-card__gallery :deep(.item-gallery__image) { transition: none; }
  .listing-enter-active,.listing-leave-active,.listing-move { transition: none; }
}
</style>
