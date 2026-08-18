<script setup lang="ts">
import { computed, ref } from 'vue'
import { getAppName, getAppTagline, getCategories } from '../data'
import { useAuthStore } from '../stores/auth'
import { useArticlesStore } from '../stores/articles'
import ArticleCard from '../components/ArticleCard.vue'
import CategoryCard from '../components/CategoryCard.vue'
import StepCard from '../components/StepCard.vue'
import ModalDialog from '../components/ModalDialog.vue'
import LoginForm from '../components/LoginForm.vue'
import PublishArticleForm from '../components/PublishArticleForm.vue'

const appName = getAppName()
const tagline = getAppTagline()
const fullCategories = ref(getCategories())
const crestSrc = `${import.meta.env.BASE_URL}images/Logo-UJAP1.png`

const authStore = useAuthStore()
const articlesStore = useArticlesStore()
const articles = computed(() => articlesStore.articles)

// Estado reactivo para notificaciones y pasos
const notification = ref<{ message: string; type: 'success' | 'info' } | null>(null)
const completedSteps = ref<Record<string, boolean>>({})

// Estado reactivo de los modales de autenticación / publicación
const activeModal = ref<'login' | 'publish' | null>(null)
const pendingPublishAfterLogin = ref(false)

function openLogin(thenOpenPublish = false) {
  pendingPublishAfterLogin.value = thenOpenPublish
  activeModal.value = 'login'
}

function openPublish() {
  if (!authStore.isAuthenticated) {
    openLogin(true)
    return
  }
  activeModal.value = 'publish'
}

function closeModal() {
  activeModal.value = null
  pendingPublishAfterLogin.value = false
}

function handleLoginSuccess() {
  notification.value = { message: `¡Bienvenido/a, ${authStore.user?.name}!`, type: 'success' }
  if (pendingPublishAfterLogin.value) {
    pendingPublishAfterLogin.value = false
    activeModal.value = 'publish'
  } else {
    closeModal()
  }
}

function handleArticlePublished() {
  notification.value = { message: '¡Tu objeto ya está publicado en LendIt!', type: 'success' }
  closeModal()
}

function handleLogout() {
  authStore.logout()
  notification.value = { message: 'Sesión cerrada.', type: 'info' }
}

// Manejo de eventos (Emits)
const handleRequest = (articleId: string) => {
  const article = articles.value.find((a) => a.id === articleId)
  if (article) {
    if (article.status === 'available') {
      notification.value = {
        message: `¡Has solicitado el préstamo de: ${article.title}! Revisa tu buzón UJAP.`,
        type: 'success',
      }
    } else {
      notification.value = {
        message: `Has preguntado por la disponibilidad de: ${article.title}. Te avisaremos si se libera.`,
        type: 'info',
      }
    }
    // Auto-ocultar notificación
    setTimeout(() => {
      if (notification.value?.message.includes(article.title)) {
        notification.value = null
      }
    }, 5000)
  }
}

const handleSelectCategory = (categoryId: string) => {
  if (categoryId === 'more') {
    notification.value = {
      message: '¿Tienes algo diferente que prestar? ¡Regístralo en LendIt!',
      type: 'info',
    }
  } else {
    const cat = fullCategories.value.find((c) => c.id === categoryId)
    if (cat) {
      notification.value = {
        message: `Explorando la categoría: ${cat.label}`,
        type: 'info',
      }
    }
  }
}

const handleCompleteStep = (stepNum: string) => {
  completedSteps.value[stepNum] = !completedSteps.value[stepNum]
  if (completedSteps.value[stepNum]) {
    notification.value = {
      message: `¡Paso ${stepNum} marcado como leído!`,
      type: 'success',
    }
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
    <!-- Banner de notificaciones premium -->
    <Transition name="slide-down">
      <div v-if="notification" class="notification-banner" :class="`notification-banner--${notification.type}`">
        <span class="notification-banner__icon">
          {{ notification.type === 'success' ? '✓' : 'ℹ' }}
        </span>
        <span class="notification-banner__text">{{ notification.message }}</span>
        <button class="notification-banner__close" @click="notification = null">×</button>
      </div>
    </Transition>

    <header class="site-header">
      <a class="brand" href="#top">
        <img class="brand__crest" :src="crestSrc" alt="Escudo Universidad José Antonio Páez" />
        <span class="brand__name">{{ appName }}</span>
      </a>
      <nav class="site-nav">
        <a href="#como-funciona">Cómo funciona</a>
        <a href="#categorias">Categorías</a>
        <a href="#confianza">Confianza</a>
      </nav>
      <div v-if="authStore.isAuthenticated" class="site-header__user">
        <span>Hola, {{ authStore.user?.name }}</span>
        <button class="btn btn--ghost btn--small" type="button" @click="handleLogout">Salir</button>
      </div>
      <button v-else class="btn btn--primary btn--small" type="button" @click="openLogin()">Empezar</button>
    </header>

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
            <a class="btn btn--ghost" href="#categorias">Ver categorías</a>
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

        <div class="hero__art" aria-hidden="true">
          <div class="medallion">
            <div class="medallion__ring"></div>
            <img class="medallion__crest" :src="crestSrc" alt="" />
          </div>

          <ArticleCard
            v-if="articles[0]"
            :article="articles[0]"
            class="loan-card--front"
            @request="handleRequest"
          />

          <ArticleCard
            v-if="articles[1]"
            :article="articles[1]"
            class="loan-card--back"
            @request="handleRequest"
          />
        </div>
      </section>

      <div class="ticker" role="presentation">
        <div class="ticker__track">
          <span v-for="i in 2" :key="i" class="ticker__group">
            <span v-for="category in fullCategories" :key="category.id + i" class="ticker__item">
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
            :key="category.id"
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

      <section id="unirme" class="cta">
        <div class="cta__seal">LU</div>
        <h2>Tu próximo favor está a un préstamo de distancia</h2>
        <p>Únete con tu correo institucional y ten tu primer objeto publicado en menos de cinco minutos.</p>
        <button v-if="!authStore.isAuthenticated" class="btn btn--paper" type="button" @click="openLogin()">
          Crear mi cuenta UJAP
        </button>
      </section>
    </main>

    <footer class="site-footer">
      <div class="brand brand--footer">
        <img class="brand__crest" :src="crestSrc" alt="Escudo Universidad José Antonio Páez" />
        <div>
          <span class="brand__name">{{ appName }}</span>
          <p>Hecho por estudiantes, para estudiantes de la UJAP.</p>
        </div>
      </div>
      <p class="site-footer__note">© {{ new Date().getFullYear() }} {{ appName }} · San Diego, Carabobo</p>
    </footer>

    <ModalDialog v-if="activeModal === 'login'" title="Inicia sesión" @close="closeModal">
      <LoginForm @success="handleLoginSuccess" />
    </ModalDialog>

    <ModalDialog v-if="activeModal === 'publish'" title="Publicar un objeto" @close="closeModal">
      <PublishArticleForm @published="handleArticlePublished" />
    </ModalDialog>
  </div>
</template>

<style scoped>
.page {
  min-height: 100svh;
  background:
    radial-gradient(circle at 12% -10%, var(--gold-bg), transparent 45%),
    radial-gradient(circle at 100% 0%, var(--crimson-bg), transparent 40%),
    var(--paper);
}

/* ---------- header ---------- */
.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px clamp(20px, 5vw, 64px);
  background: color-mix(in srgb, var(--paper) 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  margin-right: auto;
}

.brand__crest {
  width: 46px;
  height: 46px;
  object-fit: contain;
}

.brand__name {
  font-family: var(--display);
  font-weight: 650;
  font-size: 19px;
  color: var(--ink);
  letter-spacing: -0.2px;
}

.site-header__user {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-soft);
}

.site-nav {
  display: flex;
  gap: 28px;
}

.site-nav a {
  text-decoration: none;
  font-size: 14.5px;
  font-weight: 500;
  color: var(--ink-soft);
  position: relative;
  padding-bottom: 2px;
}

.site-nav a:hover {
  color: var(--crimson);
}

@media (max-width: 780px) {
  .site-nav {
    display: none;
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
  min-height: 470px;
  animation: rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
}

.medallion {
  position: absolute;
  top: 0;
  right: 8%;
  width: 240px;
  height: 240px;
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

.loan-card--front {
  position: absolute;
  top: 195px;
  left: 0;
  transform: rotate(-4deg);
  z-index: 2;
  animation: card-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
}

.loan-card--back {
  position: absolute;
  top: 305px;
  left: 130px;
  transform: rotate(5deg);
  z-index: 1;
  background: var(--paper-3);
  animation: card-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.45s both;
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
}

.trust-card {
  background: var(--paper-2);
  padding: 26px 30px;
  position: relative;
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

/* ---------- cta ---------- */
.cta {
  position: relative;
  max-width: 1220px;
  margin: 0 clamp(20px, 5vw, 64px) 96px;
  padding: clamp(56px, 8vw, 88px) clamp(24px, 6vw, 64px);
  border-radius: 28px;
  background: linear-gradient(155deg, var(--navy) 0%, var(--navy-2) 100%);
  color: var(--on-dark);
  text-align: center;
  overflow: hidden;
}

.cta::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 85% 20%, rgba(215, 173, 95, 0.25), transparent 55%);
  pointer-events: none;
}

.cta__seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 auto 28px;
  border-radius: 50%;
  border: 1.5px solid var(--gold-light);
  font-family: var(--display);
  font-weight: 650;
  color: var(--gold-light);
}

.cta h2 {
  color: var(--on-dark);
  font-size: clamp(26px, 4vw, 38px);
  max-width: 22ch;
  margin: 0 auto;
  letter-spacing: -0.5px;
}

.cta p {
  margin: 18px auto 32px;
  max-width: 44ch;
  color: var(--on-dark-soft);
  font-size: 15.5px;
}

/* ---------- footer ---------- */
.site-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  padding: 32px clamp(20px, 5vw, 64px) 40px;
  border-top: 1px solid var(--line);
}

.brand--footer {
  gap: 14px;
}

.brand--footer p {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--ink-faint);
}

.site-footer__note {
  font-size: 13px;
  color: var(--ink-faint);
  font-family: var(--mono);
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

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(20px) rotate(0deg);
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
  .loan-card,
  .medallion,
  .ticker__track {
    animation: none !important;
  }
}

/* ---------- notification banner ---------- */
.notification-banner {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--paper-2) 92%, transparent);
  backdrop-filter: blur(12px);
  border: 1.5px solid var(--line);
  box-shadow: var(--shadow-soft);
  min-width: 320px;
  max-width: 90vw;
  box-sizing: border-box;
}

.notification-banner--success {
  border-color: color-mix(in srgb, var(--gold) 50%, transparent);
}

.notification-banner--success .notification-banner__icon {
  color: var(--navy);
  background: var(--gold);
}

.notification-banner--info {
  border-color: color-mix(in srgb, var(--crimson) 50%, transparent);
}

.notification-banner--info .notification-banner__icon {
  color: #fbf3e6;
  background: var(--crimson);
}

.notification-banner__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 800;
}

.notification-banner__text {
  font-size: 13.5px;
  font-weight: 550;
  color: var(--ink);
  margin: 0;
  flex: 1;
}

.notification-banner__close {
  background: transparent;
  border: none;
  font-size: 18px;
  color: var(--ink-faint);
  cursor: pointer;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.notification-banner__close:hover {
  color: var(--ink);
}

/* Animations for Transition */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-down-enter-from {
  opacity: 0;
  transform: translate(-50%, -30px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translate(-50%, -30px);
}
</style>
