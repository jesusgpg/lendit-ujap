<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { push } from 'notivue'
import { useRouter } from 'vue-router'
import ArticleCard from '../components/ArticleCard.vue'
import LoadingState from '../components/LoadingState.vue'
import ModalDialog from '../components/ModalDialog.vue'
import RequestLoanForm from '../components/RequestLoanForm.vue'
import SiteFooter from '../components/SiteFooter.vue'
import SiteHeader from '../components/SiteHeader.vue'
import { useArticlesStore } from '../stores/articles'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import type { Article } from '../types'

const router = useRouter()
const articlesStore = useArticlesStore()
const authStore = useAuthStore()
const catalogStore = useCatalogStore()

const search = ref('')
const selectedCategory = ref('all')
const selectedArticle = ref<Article | null>(null)
const catalogError = ref('')

const filteredArticles = computed(() => {
  const query = search.value.trim().toLowerCase()

  return articlesStore.articles.filter((article) => {
    const matchesCategory = selectedCategory.value === 'all' || article.categoryKey === selectedCategory.value
    const matchesSearch =
      !query ||
      [article.title, article.category, article.duration, article.description ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query)

    return matchesCategory && matchesSearch
  })
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
  const article = articlesStore.articles.find((item) => item.id === articleId)
  if (!article) return

  if (!authStore.isAuthenticated) {
    push.info({ title: 'Inicia sesión para pedirlo', message: 'Necesitas una cuenta UJAP para solicitar un objeto.' })
    void router.push({ name: 'login' })
    return
  }

  selectedArticle.value = article
}

function closeRequestForm() {
  selectedArticle.value = null
}

function handleRequestSubmitted() {
  closeRequestForm()
}
</script>

<template>
  <div class="catalog-page">
    <SiteHeader show-marketplace-nav @open-login="router.push({ name: 'login' })" />

    <main>
      <section class="catalog-hero">
        <div class="catalog-hero__copy">
          <router-link class="back-link" to="/">← Volver al inicio</router-link>
          <p class="catalog-hero__eyebrow">Inventario vivo · Campus UJAP</p>
          <h1>Encuentra algo que te resuelva el día.</h1>
          <p>
            Explora objetos que otra persona puso a circular. Filtra por categoría y encuentra una solución antes de
            comprar algo nuevo.
          </p>
        </div>
        <div class="catalog-hero__stamp" aria-label="Objetos disponibles">
          <span class="catalog-hero__stamp-number">{{ articlesStore.articles.length }}</span>
          <span class="catalog-hero__stamp-label">objetos<br />disponibles</span>
        </div>
      </section>

      <section class="catalog-workspace" aria-labelledby="catalog-title">
        <div class="catalog-toolbar">
          <div>
            <p class="section-kicker">Catálogo</p>
            <h2 id="catalog-title">Lo que está disponible ahora</h2>
          </div>
          <router-link class="btn btn--primary" to="/publicar">+ Publicar un objeto</router-link>
        </div>

        <div class="catalog-filters">
          <label class="catalog-search">
            <span class="sr-only">Buscar en el catálogo</span>
            <span aria-hidden="true">⌕</span>
            <input v-model="search" type="search" placeholder="Busca por nombre, categoría o duración" />
          </label>

          <label class="catalog-category">
            <span class="sr-only">Filtrar por categoría</span>
            <select v-model="selectedCategory">
              <option value="all">Todas las categorías</option>
              <option v-for="category in catalogStore.categories" :key="category.key" :value="category.key">
                {{ category.label }}
              </option>
            </select>
          </label>
        </div>

        <LoadingState v-if="isLoading" label="Cargando objetos del campus…" />

        <div v-else-if="loadError" class="catalog-message catalog-message--error">
          <strong>No pudimos abrir el catálogo.</strong>
          <p>{{ loadError }}</p>
          <button class="btn btn--ghost" type="button" @click="loadCatalog">Intentar de nuevo</button>
        </div>

        <div v-else-if="!filteredArticles.length" class="catalog-message">
          <span class="catalog-message__mark" aria-hidden="true">∅</span>
          <strong>No encontramos ese objeto.</strong>
          <p>Prueba con otra búsqueda o publica lo que tengas disponible.</p>
          <router-link class="btn btn--ghost" to="/publicar">Publicar un objeto</router-link>
        </div>

        <div v-else class="catalog-grid">
          <ArticleCard
            v-for="article in filteredArticles"
            :key="article.id"
            :article="article"
            @request="handleRequest"
          />
        </div>
      </section>
    </main>

    <SiteFooter />

    <ModalDialog v-if="selectedArticle" wide title="Solicitar objeto" @close="closeRequestForm">
      <RequestLoanForm :article="selectedArticle" @submitted="handleRequestSubmitted" />
    </ModalDialog>
  </div>
</template>

<style scoped>
.catalog-page {
  min-height: 100svh;
  background:
    radial-gradient(circle at 88% 10%, var(--gold-bg), transparent 27%),
    var(--paper);
}

.catalog-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 40px;
  max-width: 1220px;
  margin: 0 auto;
  padding: clamp(48px, 8vw, 92px) clamp(20px, 5vw, 64px) 58px;
}

.catalog-hero__copy {
  max-width: 730px;
}

.back-link {
  display: inline-block;
  margin-bottom: 38px;
  color: var(--crimson-dark);
  font-family: var(--mono);
  font-size: 12px;
  text-decoration: none;
  letter-spacing: 0.04em;
}

.back-link:hover {
  color: var(--crimson);
}

.catalog-hero__eyebrow,
.section-kicker {
  margin: 0 0 14px;
  color: var(--crimson-dark);
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.catalog-hero h1 {
  max-width: 12ch;
  font-size: clamp(44px, 7vw, 78px);
  line-height: 0.98;
  letter-spacing: -2px;
}

.catalog-hero__copy > p:last-child {
  max-width: 52ch;
  margin-top: 26px;
  color: var(--ink-soft);
  font-size: 18px;
  line-height: 1.55;
}

.catalog-hero__stamp {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
  min-width: 158px;
  padding: 16px 18px;
  border: 1px solid var(--gold);
  border-radius: 50% 50% 50% 8px;
  background: var(--gold-bg);
  transform: rotate(4deg);
}

.catalog-hero__stamp-number {
  color: var(--crimson-dark);
  font-family: var(--display);
  font-size: 36px;
  line-height: 1;
}

.catalog-hero__stamp-label {
  color: var(--ink-soft);
  font-family: var(--mono);
  font-size: 10px;
  line-height: 1.35;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.catalog-workspace {
  max-width: 1220px;
  margin: 0 auto;
  padding: 0 clamp(20px, 5vw, 64px) 96px;
}

.catalog-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding: 26px 0 22px;
  border-top: 1px solid var(--line-strong);
}

.catalog-toolbar h2 {
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1;
}

.catalog-toolbar .section-kicker {
  margin-bottom: 8px;
}

.catalog-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(210px, 280px);
  gap: 12px;
  margin-bottom: 28px;
}

.catalog-search,
.catalog-category {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 49px;
  padding: 0 15px;
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  background: var(--paper-2);
  color: var(--ink-faint);
}

.catalog-search:focus-within,
.catalog-category:focus-within {
  border-color: var(--crimson);
}

.catalog-search input,
.catalog-category select {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 14px;
}

.catalog-category select {
  cursor: pointer;
}

.catalog-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.catalog-grid :deep(.loan-card) {
  width: 100%;
  min-height: 234px;
}

.catalog-message {
  display: grid;
  justify-items: start;
  gap: 10px;
  min-height: 240px;
  padding: 30px;
  border: 1px dashed var(--line-strong);
  border-radius: 16px;
  background: color-mix(in srgb, var(--paper-2) 72%, transparent);
}

.catalog-message strong {
  color: var(--ink);
  font-family: var(--display);
  font-size: 25px;
}

.catalog-message p {
  color: var(--ink-faint);
}

.catalog-message--error strong {
  color: var(--crimson-dark);
}

.catalog-message__mark {
  color: var(--gold);
  font-family: var(--display);
  font-size: 42px;
  line-height: 1;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 820px) {
  .catalog-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .catalog-hero__stamp {
    align-self: flex-end;
  }

  .catalog-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .catalog-hero h1 {
    font-size: 48px;
  }

  .catalog-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .catalog-toolbar .btn {
    width: 100%;
  }

  .catalog-filters {
    grid-template-columns: 1fr;
  }

  .catalog-grid {
    grid-template-columns: 1fr;
  }
}
</style>
