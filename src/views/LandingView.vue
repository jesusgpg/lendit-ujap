<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { push } from 'notivue'
import { useRoute, useRouter } from 'vue-router'
import { getAppTagline } from '../data'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import CategoryCard from '../components/CategoryCard.vue'
import StepCard from '../components/StepCard.vue'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'

const tagline = getAppTagline()
const crestSrc = `${import.meta.env.BASE_URL}images/Logo-UJAP1.png`
const campusSrc = `${import.meta.env.BASE_URL}images/ujap_escultura.jpg`

const authStore = useAuthStore()
const catalogStore = useCatalogStore()
const route = useRoute()
const router = useRouter()
const fullCategories = computed(() => catalogStore.categories)

// Los pasos leídos se conservan entre visitas sin manejar localStorage a mano.
const completedSteps = useLocalStorage<Record<string, boolean>>('lendit:completed-steps', {})

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
  void catalogStore.initialize()

  if (route.query.publish === '1' && authStore.isAuthenticated) {
    void router.replace({ name: 'publish' })
  }
})

function handleLogout() {
  push.info({ title: 'Sesión cerrada', message: 'Puedes volver a entrar cuando lo necesites.' })
}

const handleSelectCategory = (categoryKey: string) => {
  if (categoryKey === 'more') {
    push.info({ title: 'Comparte lo que tienes', message: 'Puedes publicar cualquier objeto útil para el campus.' })
  } else {
    const cat = fullCategories.value.find((c) => c.key === categoryKey)
    if (cat) {
      push.info({ title: `Categoría: ${cat.label}`, message: 'Pronto podrás filtrar los objetos de esta categoría.' })
    }
  }
}

const handleCompleteStep = (stepNum: string) => {
  completedSteps.value[stepNum] = !completedSteps.value[stepNum]
  if (completedSteps.value[stepNum]) {
    push.success({ title: 'Paso marcado', message: `El paso ${stepNum} quedó guardado como leído.` })
  }
}

const steps = [
  {
    n: '01',
    title: 'Publica o busca',
    text: 'Sube lo que puedes prestar o encuentra lo que necesitas por facultad y categoría.',
  },
  {
    n: '02',
    title: 'Acuerda el plazo',
    text: 'Definen juntos cuántas horas o días dura el préstamo, sin sorpresas.',
  },
  {
    n: '03',
    title: 'Devuelve y califica',
    text: 'Al terminar, se marca la devolución y ambos dejan una reseña en el carnet digital.',
  },
]

const trustPoints = [
  {
    title: 'Carnet verificado',
    text: 'Solo estudiantes activos de la UJAP con matrícula confirmada pueden prestar o pedir.',
  },
  {
    title: 'Plazo con hora y fecha',
    text: 'Todo préstamo tiene inicio y fin marcados; el sistema avisa antes de que venza.',
  },
  {
    title: 'Reputación visible',
    text: 'Cada devolución puntual suma a tu historial. Se nota quién cuida lo prestado.',
  },
]
</script>

<template>
  <div class="page">
    <SiteHeader show-marketplace-nav @open-login="openLogin()" @logout="handleLogout" />

    <main id="top">
      <section class="hero">
        <div class="hero__copy">
          <p class="eyebrow"><span class="eyebrow__dot"></span>Red de préstamos entre estudiantes · UJAP</p>
          <h1 class="hero__title">
            Presta lo tuyo.<br />
            Pide lo que falta.
          </h1>
          <p class="hero__tagline">{{ tagline }}</p>
          <div class="hero__actions">
            <button class="btn btn--primary" type="button" @click="openPublish">Publicar un objeto</button>
            <router-link class="btn btn--ghost" to="/catalogo">Explorar catálogo</router-link>
          </div>
          <dl class="hero__stats">
            <div>
              <dt>+120</dt>
              <dd>objetos activos en campus</dd>
            </div>
            <div>
              <dt>100%</dt>
              <dd>verificado con carnet UJAP</dd>
            </div>
            <div>
              <dt>&lt; 24h</dt>
              <dd>promedio de respuesta</dd>
            </div>
          </dl>
        </div>

        <div class="hero__art">
          <figure class="campus-card">
            <img :src="campusSrc" alt="Escultura de la UJAP frente al campus universitario" />
            <figcaption>
              <span class="campus-card__label">Campus UJAP</span>
              <span>San Diego · Carabobo</span>
            </figcaption>
          </figure>

          <div class="medallion">
            <div class="medallion__ring"></div>
            <img class="medallion__crest" :src="crestSrc" alt="" />
          </div>
        </div>
      </section>

      <div class="ticker" role="presentation">
        <div class="ticker__track">
          <span v-for="i in 2" :key="i" class="ticker__group">
            <span v-for="category in fullCategories" :key="category.key + i" class="ticker__item">
              {{ category.label }}
            </span>
          </span>
        </div>
      </div>

      <section id="como-funciona" class="section steps">
        <p class="section__eyebrow">Cómo funciona</p>
        <h2 class="section__title">Del anuncio a la devolución, en tres pasos</h2>
        <ol class="steps__list">
          <StepCard
            v-for="step in steps"
            :key="step.n"
            :step="step"
            :is-completed="!!completedSteps[step.n]"
            @complete="handleCompleteStep"
          />
        </ol>
      </section>

      <section id="categorias" class="section categories">
        <p class="section__eyebrow">Qué puedes prestar</p>
        <h2 class="section__title">Empieza por lo que ya tienes a la mano</h2>
        <ul class="categories__grid">
          <CategoryCard
            v-for="category in fullCategories"
            :key="category.key"
            :category="category"
            @select="handleSelectCategory"
          />
          <CategoryCard
            :is-placeholder="true"
            @select="handleSelectCategory"
          />
        </ul>
      </section>

      <section id="confianza" class="section trust">
        <div class="trust__intro">
          <p class="section__eyebrow">Confianza ante todo</p>
          <h2 class="section__title">Prestar entre panas, con reglas claras</h2>
          <p class="trust__text">
            Nada de perfiles anónimos ni préstamos indefinidos. Cada movimiento queda registrado como en un carnet de
            biblioteca, para que prestar algo propio se sienta tan seguro como pedirlo prestado.
          </p>
        </div>
        <ul class="trust__list">
          <li v-for="point in trustPoints" :key="point.title" class="trust-card">
            <h3>{{ point.title }}</h3>
            <p>{{ point.text }}</p>
          </li>
        </ul>
      </section>

    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.page {
  min-height: 100svh;
  background:
    radial-gradient(circle at 12% -10%, var(--gold-bg), transparent 45%),
    radial-gradient(circle at 100% 0%, var(--navy-bg), transparent 40%),
    var(--paper);
}

@media (max-width: 380px) {
  .brand__crest {
    width: 36px;
    height: 36px;
  }
  .brand__name {
    font-size: 16px;
  }
}


/* ---------- hero ---------- */
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 460px);
  gap: 48px;
  align-items: center;
  max-width: 1220px;
  margin: 0 auto;
  padding: clamp(48px, 8vw, 96px) clamp(20px, 5vw, 64px) clamp(64px, 8vw, 96px);
}

@media (max-width: 980px) {
  .hero {
    grid-template-columns: 1fr;
  }
}

.hero__copy {
  animation: rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 12.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--crimson-dark);
  background: var(--crimson-bg);
  border: 1px solid color-mix(in srgb, var(--crimson) 30%, transparent);
  padding: 6px 14px 6px 10px;
  border-radius: 999px;
  margin: 0 0 22px;
}

.eyebrow__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--crimson);
}

.hero__title {
  font-size: clamp(42px, 6vw, 68px);
  line-height: 1.02;
  letter-spacing: -1.6px;
  color: var(--ink);
}

.hero__tagline {
  display: block;
  max-width: 46ch;
  margin-top: 22px;
  font-size: 18px;
  line-height: 1.6;
  color: var(--ink-soft);
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 32px;
}

.hero__stats {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(20px, 4vw, 40px);
  margin: 48px 0 0;
  padding-top: 28px;
  border-top: 1px solid var(--line);
}

.hero__stats dt {
  font-family: var(--display);
  font-size: 26px;
  font-weight: 650;
  color: var(--ink);
}

.hero__stats dd {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--ink-faint);
  max-width: 14ch;
}

/* ---------- hero art ---------- */
.hero__art {
  position: relative;
  min-height: 505px;
  animation: rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
}

.campus-card {
  position: absolute;
  inset: 24px 0 auto;
  height: 318px;
  margin: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--gold-light) 55%, var(--line));
  border-radius: 24px 5px 24px 24px;
  background: var(--navy);
  box-shadow: var(--shadow);
  transform: rotate(1deg);
}

.campus-card::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 42%, rgba(12, 20, 43, 0.78));
  content: '';
}

.campus-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  filter: saturate(0.9) contrast(1.03);
}

.campus-card figcaption {
  position: absolute;
  right: 20px;
  bottom: 18px;
  left: 20px;
  z-index: 1;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  color: var(--on-dark-soft);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.campus-card__label {
  color: var(--on-dark);
  font-size: 13px;
  font-weight: 650;
}

.medallion {
  position: absolute;
  top: -16px;
  right: 8%;
  width: 178px;
  height: 178px;
  overflow: hidden;
  border-radius: 50%;
  animation: float 7s ease-in-out infinite;
}

.medallion__ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--paper-2);
  border: 2px solid var(--gold-light);
  box-shadow:
    var(--shadow),
    inset 0 0 0 6px var(--paper);
}

.medallion__crest {
  position: absolute;
  inset: 30px;
  width: calc(100% - 60px);
  height: calc(100% - 60px);
  object-fit: contain;
}

/* Debajo de 980px el hero pasa a una sola columna: sin ancho fijo de 460px
   para el que fue calculado el posicionamiento absoluto del escudo. */
@media (max-width: 980px) {
  .hero__art {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    min-height: 0;
  }

  .campus-card {
    position: relative;
    inset: auto;
    width: min(100%, 560px);
    height: 260px;
    transform: none;
  }

  .medallion {
    position: static;
    width: 160px;
    height: 160px;
  }
}

@media (max-width: 560px) {
  .campus-card {
    height: 220px;
  }

  .campus-card figcaption {
    flex-direction: column;
    gap: 3px;
  }
}

/* ---------- ticker ---------- */
.ticker {
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  background: var(--navy);
  overflow: hidden;
  padding: 14px 0;
}

.ticker__track {
  display: flex;
  width: max-content;
  animation: scroll 22s linear infinite;
}

.ticker__group {
  display: flex;
}

.ticker__item {
  font-family: var(--mono);
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--gold-light);
  padding: 0 28px;
  white-space: nowrap;
}

.ticker__item::after {
  content: '✦';
  margin-left: 28px;
  color: var(--crimson);
  opacity: 0.7;
}

/* ---------- sections ---------- */
.section {
  max-width: 1220px;
  margin: 0 auto;
  padding: clamp(64px, 9vw, 108px) clamp(20px, 5vw, 64px);
}

.section__eyebrow {
  font-family: var(--mono);
  font-size: 12.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--crimson-dark);
  margin: 0 0 12px;
}

.section__title {
  font-size: clamp(28px, 3.6vw, 40px);
  letter-spacing: -0.6px;
  max-width: 20ch;
  margin-bottom: 48px;
}

/* ---------- steps ---------- */
.steps__list {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  margin: 0;
  padding: 0;
  counter-reset: step;
}

@media (max-width: 860px) {
  .steps__list {
    grid-template-columns: 1fr;
  }
}



/* ---------- categories ---------- */
.categories__grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin: 0;
  padding: 0;
}

@media (max-width: 980px) {
  .categories__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .categories__grid {
    grid-template-columns: 1fr;
  }
}



/* ---------- trust ---------- */
.trust {
  display: grid;
  grid-template-columns: minmax(0, 340px) 1fr;
  gap: 56px;
}

@media (max-width: 900px) {
  .trust {
    grid-template-columns: 1fr;
  }
}

.trust__text {
  margin-top: 20px;
  font-size: 15.5px;
  color: var(--ink-soft);
  max-width: 40ch;
}

.trust__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
  border-radius: 18px;
  overflow: hidden;
  clip-path: inset(0 round 18px);
}

.trust-card {
  background: var(--paper-2);
  padding: 26px 30px;
  position: relative;
}

.trust-card:last-child {
  border-radius: 0 0 17px 17px;
}

.trust-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--gold-light);
}

.trust-card h3 {
  font-size: 17px;
  margin-bottom: 6px;
}

.trust-card p {
  font-size: 14.5px;
  color: var(--ink-faint);
  max-width: 60ch;
}

/* ---------- animations ---------- */
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes scroll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero__copy,
  .hero__art,
  .medallion,
  .ticker__track {
    animation: none !important;
  }
}

</style>
