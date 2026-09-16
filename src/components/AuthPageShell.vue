<script setup lang="ts">
import { useRouter } from 'vue-router'
import SiteFooter from './SiteFooter.vue'
import SiteHeader from './SiteHeader.vue'

withDefaults(
  defineProps<{
    eyebrow: string
    title: string
    description: string
    note: string
    cardKicker: string
    cardTitle: string
    cardLabel: string
    wideCard?: boolean
  }>(),
  { wideCard: false },
)

const router = useRouter()

function goToLogin() {
  void router.push({ name: 'login' })
}
</script>

<template>
  <div class="auth-page" :class="{ 'auth-page--wide-card': wideCard }">
    <SiteHeader show-marketplace-nav @open-login="goToLogin" />

    <main class="auth-page__layout">
      <section class="auth-page__intro" aria-labelledby="auth-page-title">
        <p class="auth-page__eyebrow">{{ eyebrow }}</p>
        <h1 id="auth-page-title">{{ title }}</h1>
        <p class="auth-page__description">{{ description }}</p>
        <div class="auth-page__signal" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <p class="auth-page__note">{{ note }}</p>
      </section>

      <section class="auth-page__card" :class="{ 'auth-page__card--wide': wideCard }" :aria-label="cardLabel">
        <div class="auth-page__card-mark" aria-hidden="true">L</div>
        <p class="auth-page__card-kicker">{{ cardKicker }}</p>
        <h2>{{ cardTitle }}</h2>
        <slot />
      </section>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100svh;
  background:
    radial-gradient(circle at 10% 8%, var(--gold-bg), transparent 32%),
    linear-gradient(135deg, var(--navy-bg), transparent 55%),
    var(--paper);
}

.auth-page__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 430px);
  gap: clamp(40px, 8vw, 120px);
  align-items: center;
  max-width: 1120px;
  min-height: calc(100svh - 168px);
  margin: 0 auto;
  padding: clamp(56px, 9vw, 110px) clamp(20px, 5vw, 64px);
}

.auth-page__intro {
  max-width: 620px;
}

.auth-page__eyebrow,
.auth-page__card-kicker {
  margin: 0 0 18px;
  color: var(--gold);
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.auth-page__intro h1 {
  max-width: 12ch;
  font-size: clamp(42px, 6vw, 72px);
  line-height: 0.98;
  letter-spacing: -1.8px;
}

.auth-page__description {
  max-width: 48ch;
  margin-top: 26px;
  color: var(--ink-soft);
  font-size: 18px;
  line-height: 1.6;
}

.auth-page__signal {
  display: flex;
  gap: 7px;
  margin-top: 34px;
}

.auth-page__signal span {
  width: 38px;
  height: 4px;
  border-radius: 999px;
  background: var(--crimson);
}

.auth-page__signal span:nth-child(2) {
  background: var(--gold);
}

.auth-page__signal span:nth-child(3) {
  width: 14px;
  background: var(--navy);
}

.auth-page__note {
  max-width: 42ch;
  margin-top: 28px;
  color: var(--ink-faint);
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.6;
}

.auth-page__card {
  position: relative;
  padding: clamp(26px, 4vw, 38px);
  border: 1px solid color-mix(in srgb, var(--gold) 42%, var(--line));
  border-radius: 22px 22px 22px 4px;
  background: color-mix(in srgb, var(--paper-2) 92%, transparent);
  box-shadow: 0 28px 55px -36px rgba(22, 29, 51, 0.7);
}

.auth-page--wide-card .auth-page__layout {
  grid-template-columns: minmax(280px, 0.7fr) minmax(620px, 1.3fr);
  max-width: 1360px;
}

.auth-page__card--wide {
  min-width: 0;
}

.auth-page__card::before {
  position: absolute;
  top: 0;
  right: 28px;
  left: 28px;
  height: 3px;
  border-radius: 0 0 99px 99px;
  background: linear-gradient(90deg, var(--crimson), var(--gold));
  content: '';
}

.auth-page__card-mark {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  margin-bottom: 24px;
  border-radius: 11px 11px 11px 2px;
  background: var(--navy);
  color: var(--on-dark);
  font-family: var(--display);
  font-size: 23px;
  font-weight: 700;
}

.auth-page__card-kicker {
  margin-bottom: 8px;
  color: var(--crimson-dark);
}

.auth-page__card h2 {
  margin-bottom: 24px;
  font-size: 30px;
}

@media (max-width: 780px) {
  .auth-page__layout {
    grid-template-columns: 1fr;
    gap: 38px;
    min-height: auto;
    padding-top: 58px;
    padding-bottom: 64px;
  }

  .auth-page--wide-card .auth-page__layout {
    grid-template-columns: 1fr;
  }

  .auth-page__intro h1 {
    max-width: 14ch;
  }
}

@media (max-width: 460px) {
  .auth-page__intro h1 {
    font-size: 42px;
  }

  .auth-page__card {
    border-radius: 18px 18px 18px 3px;
  }
}
</style>
