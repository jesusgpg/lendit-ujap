<script setup lang="ts">
import { getAppName } from '../data'

const appName = getAppName()
const crestSrc = `${import.meta.env.BASE_URL}images/Logo-UJAP1.png`
</script>

<template>
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
</template>

<style scoped>
.site-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  padding: 32px clamp(20px, 5vw, 64px) 40px;
  border-top: 1px solid var(--line);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
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

@media (max-width: 380px) {
  .brand__crest {
    width: 36px;
    height: 36px;
  }
  .brand__name {
    font-size: 16px;
  }
}
</style>
