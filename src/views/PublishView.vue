<script setup lang="ts">
import { push } from 'notivue'
import { useRouter } from 'vue-router'
import PublishArticleForm from '../components/PublishArticleForm.vue'
import SiteFooter from '../components/SiteFooter.vue'
import SiteHeader from '../components/SiteHeader.vue'

const router = useRouter()

function handlePublished() {
  push.success({ title: 'Objeto publicado', message: 'Tu objeto ya está disponible para el campus.' })
  void router.replace({ name: 'my-publications' })
}
</script>

<template>
  <div class="publish-page">
    <SiteHeader show-marketplace-nav />

    <main class="publish-layout">
      <section class="publish-intro" aria-labelledby="publish-title">
        <router-link class="back-link" to="/catalogo">← Volver al catálogo</router-link>
        <p class="publish-intro__eyebrow">Nueva publicación · LendIt UJAP</p>
        <h1 id="publish-title">Haz que algo útil vuelva a circular.</h1>
        <p class="publish-intro__description">
          Una buena publicación dice lo necesario: qué es, en qué estado está y durante cuánto tiempo puede ayudar a
          otra persona.
        </p>

        <ol class="publish-steps">
          <li>
            <span>01</span>
            <div>
              <strong>Describe</strong>
              <p>Usa un nombre fácil de encontrar y cuenta los detalles importantes.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Define el plazo</strong>
              <p>Indica cuántas horas o días puedes dejarlo disponible.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Hazlo visible</strong>
              <p>Elige si puede pedirlo todo el campus o solo un tipo de usuario.</p>
            </div>
          </li>
        </ol>

        <p class="publish-intro__note">
          Esta primera versión coordina préstamos entre miembros de la UJAP. El alquiler con cobro requiere agregar
          monto, moneda y un flujo de pagos.
        </p>
      </section>

      <section class="publish-panel" aria-label="Formulario para publicar un objeto">
        <div class="publish-panel__topline">
          <span>Ficha de objeto</span>
          <span>Se publica al guardar</span>
        </div>
        <h2>Cuéntale al campus qué tienes.</h2>
        <p class="publish-panel__hint">Los campos marcados son suficientes para que tu publicación aparezca hoy.</p>
        <PublishArticleForm @published="handlePublished" />
      </section>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.publish-page {
  min-height: 100svh;
  background:
    radial-gradient(circle at 10% 8%, var(--gold-bg), transparent 30%),
    linear-gradient(135deg, var(--navy-bg), transparent 48%),
    var(--paper);
}

.publish-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(360px, 520px);
  gap: clamp(42px, 8vw, 130px);
  align-items: start;
  max-width: 1220px;
  margin: 0 auto;
  padding: clamp(48px, 8vw, 92px) clamp(20px, 5vw, 64px) 96px;
}

.publish-intro {
  max-width: 620px;
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

.publish-intro__eyebrow,
.publish-panel__topline {
  margin: 0 0 14px;
  color: var(--crimson-dark);
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.publish-intro h1 {
  max-width: 11ch;
  font-size: clamp(46px, 6.5vw, 76px);
  line-height: 0.97;
  letter-spacing: -2px;
}

.publish-intro__description {
  max-width: 48ch;
  margin-top: 28px;
  color: var(--ink-soft);
  font-size: 18px;
  line-height: 1.58;
}

.publish-steps {
  display: grid;
  gap: 0;
  max-width: 530px;
  padding: 0;
  margin: 54px 0 0;
  list-style: none;
}

.publish-steps li {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 16px;
  padding: 18px 0;
  border-top: 1px solid var(--line);
}

.publish-steps li:last-child {
  border-bottom: 1px solid var(--line);
}

.publish-steps li > span {
  color: var(--gold);
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.05em;
}

.publish-steps strong {
  display: block;
  margin-bottom: 3px;
  color: var(--ink);
  font-family: var(--display);
  font-size: 21px;
  font-weight: 600;
}

.publish-steps p {
  color: var(--ink-faint);
  font-size: 14px;
  line-height: 1.45;
}

.publish-intro__note {
  max-width: 50ch;
  margin-top: 28px;
  color: var(--ink-faint);
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.65;
}

.publish-panel {
  position: relative;
  padding: clamp(26px, 4vw, 40px);
  border: 1px solid color-mix(in srgb, var(--gold) 48%, var(--line));
  border-radius: 24px 24px 24px 5px;
  background: color-mix(in srgb, var(--paper-2) 93%, transparent);
  box-shadow: 0 28px 58px -38px rgba(22, 29, 51, 0.72);
}

.publish-panel::before {
  position: absolute;
  top: 0;
  right: 30px;
  left: 30px;
  height: 3px;
  border-radius: 0 0 99px 99px;
  background: linear-gradient(90deg, var(--crimson), var(--gold));
  content: '';
}

.publish-panel__topline {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 12px;
  color: var(--gold);
  font-size: 10px;
}

.publish-panel__topline span:last-child {
  color: var(--ink-faint);
  text-align: right;
}

.publish-panel h2 {
  margin-bottom: 8px;
  font-size: 31px;
  line-height: 1.05;
}

.publish-panel__hint {
  margin-bottom: 26px;
  color: var(--ink-faint);
  font-size: 14px;
  line-height: 1.5;
}

@media (max-width: 860px) {
  .publish-layout {
    grid-template-columns: 1fr;
    gap: 54px;
  }

  .publish-intro {
    max-width: 720px;
  }

  .publish-intro h1 {
    max-width: 13ch;
  }
}

@media (max-width: 460px) {
  .publish-intro h1 {
    font-size: 48px;
  }

  .publish-panel {
    border-radius: 19px 19px 19px 4px;
  }

  .publish-panel__topline {
    align-items: flex-start;
    flex-direction: column;
  }

  .publish-panel__topline span:last-child {
    text-align: left;
  }
}
</style>
