<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { push } from 'notivue'
import LoadingState from '../components/LoadingState.vue'
import SiteFooter from '../components/SiteFooter.vue'
import SiteHeader from '../components/SiteHeader.vue'
import { useRequestsStore } from '../stores/requests'
import type { LoanRequest } from '../types'

const requestsStore = useRequestsStore()
const busyKey = ref<string | null>(null)

const incomingRequests = computed(() => requestsStore.requests.filter((request) => request.isOwner))
const outgoingRequests = computed(() => requestsStore.requests.filter((request) => !request.isOwner))
const pendingCount = computed(() => requestsStore.requests.filter((request) => request.status === 'PENDING').length)
const activeLoanCount = computed(
  () => requestsStore.requests.filter((request) => request.loan?.status === 'ACTIVE').length,
)

onMounted(() => {
  void requestsStore.load()
})

function statusLabel(status: LoanRequest['status']) {
  const labels: Record<LoanRequest['status'], string> = {
    PENDING: 'Pendiente',
    APPROVED: 'Aprobada',
    REJECTED: 'Rechazada',
    CANCELLED: 'Cancelada',
    EXPIRED: 'Vencida',
  }
  return labels[status]
}

function formatDateRange(request: LoanRequest) {
  const date = new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' })
  const time = new Intl.DateTimeFormat('es-VE', { timeStyle: 'short' })
  const starts = new Date(request.startsAt)
  const ends = new Date(request.endsAt)
  return `${date.format(starts)} · ${time.format(starts)}–${time.format(ends)}`
}

function formatOffer(request: LoanRequest) {
  if (request.item.mode !== 'RENTAL' || request.item.price === null || !request.item.currency) {
    return 'Préstamo gratuito'
  }
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: request.item.currency,
    maximumFractionDigits: 2,
  }).format(request.item.price)
}

async function performAction(request: LoanRequest, action: 'approve' | 'reject' | 'cancel' | 'return') {
  const key = `${action}:${request.id}:${request.loan?.id ?? ''}`
  busyKey.value = key

  try {
    await requestsStore.act(
      action === 'return'
        ? { action, loanId: request.loan?.id ?? '' }
        : { action, requestId: request.id },
    )
    await requestsStore.load()
    const messages: Record<typeof action, string> = {
      approve: 'La solicitud fue aprobada y el objeto pasó a préstamo activo.',
      reject: 'La solicitud fue rechazada y el pago simulado quedó devuelto.',
      cancel: 'La solicitud fue cancelada.',
      return: 'La devolución quedó registrada y el objeto volvió a estar disponible.',
    }
    push.success({ title: 'Solicitud actualizada', message: messages[action] })
  } catch (error) {
    push.error({
      title: 'No se pudo actualizar la solicitud',
      message: error instanceof Error ? error.message : 'Intenta nuevamente.',
    })
  } finally {
    busyKey.value = null
  }
}
</script>

<template>
  <div class="requests-page">
    <SiteHeader show-marketplace-nav />

    <main class="requests-content">
      <header class="requests-masthead">
        <div>
          <router-link class="back-link" to="/catalogo">← Explorar objetos</router-link>
          <p class="requests-masthead__eyebrow">Tu movimiento · LendIt UJAP</p>
          <h1>Solicitudes sin mensajes perdidos.</h1>
          <p>Aquí se encuentran lo que pides y lo que otras personas te piden a ti.</p>
        </div>
        <div class="requests-masthead__signal">
          <strong>{{ pendingCount }}</strong>
          <span>pendientes</span>
        </div>
      </header>

      <section class="request-stats" aria-label="Resumen de solicitudes">
        <div>
          <span>Por responder</span>
          <strong>{{ pendingCount }}</strong>
        </div>
        <div>
          <span>Préstamos activos</span>
          <strong>{{ activeLoanCount }}</strong>
        </div>
        <div>
          <span>Total de movimientos</span>
          <strong>{{ requestsStore.requests.length }}</strong>
        </div>
      </section>

      <div v-if="requestsStore.isLoading" class="requests-loading">
        <LoadingState label="Cargando solicitudes…" />
      </div>

      <div v-else-if="requestsStore.error" class="request-message request-message--error">
        <strong>No pudimos cargar tus solicitudes.</strong>
        <p>{{ requestsStore.error }}</p>
        <button class="btn btn--ghost" type="button" @click="requestsStore.load">Intentar de nuevo</button>
      </div>

      <div v-else class="request-columns">
        <section class="request-section" aria-labelledby="incoming-title">
          <header class="request-section__header">
            <div>
              <p class="section-kicker">Como propietario</p>
              <h2 id="incoming-title">Te están pidiendo</h2>
            </div>
            <span>{{ incomingRequests.length }}</span>
          </header>

          <div v-if="!incomingRequests.length" class="request-message">
            <span class="request-message__mark" aria-hidden="true">↗</span>
            <strong>Aún no te han pedido nada.</strong>
            <p>Cuando alguien necesite uno de tus objetos, aparecerá aquí.</p>
          </div>

          <ul v-else class="request-list">
            <li v-for="request in incomingRequests" :key="request.id" class="request-card">
              <div class="request-card__item">
                <span class="request-card__icon">{{ request.item.categoryIcon || '·' }}</span>
                <div>
                  <span class="request-card__code">{{ request.item.code }}</span>
                  <h3>{{ request.item.title }}</h3>
                  <p>{{ formatOffer(request) }}</p>
                </div>
              </div>
              <div class="request-card__details">
                <span>Solicita <strong>{{ request.requester.name || request.requester.email }}</strong></span>
                <span>{{ formatDateRange(request) }}</span>
                <span v-if="request.message">“{{ request.message }}”</span>
              </div>
              <div class="request-card__footer">
                <span class="request-status" :class="`request-status--${request.status.toLowerCase()}`">
                  <span aria-hidden="true"></span>{{ statusLabel(request.status) }}
                </span>
                <div class="request-card__actions">
                  <button
                    v-if="request.status === 'PENDING'"
                    class="request-card__action request-card__action--primary"
                    type="button"
                    :disabled="busyKey === `approve:${request.id}:`"
                    @click="performAction(request, 'approve')"
                  >
                    {{ busyKey === `approve:${request.id}:` ? 'Guardando…' : 'Aceptar' }}
                  </button>
                  <button
                    v-if="request.status === 'PENDING'"
                    class="request-card__action"
                    type="button"
                    :disabled="busyKey === `reject:${request.id}:`"
                    @click="performAction(request, 'reject')"
                  >
                    Rechazar
                  </button>
                  <button
                    v-if="request.loan?.status === 'ACTIVE'"
                    class="request-card__action"
                    type="button"
                    :disabled="busyKey === `return:${request.id}:${request.loan.id}`"
                    @click="performAction(request, 'return')"
                  >
                    Marcar devolución
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </section>

        <section class="request-section" aria-labelledby="outgoing-title">
          <header class="request-section__header">
            <div>
              <p class="section-kicker">Como solicitante</p>
              <h2>Lo que estás pidiendo</h2>
            </div>
            <span>{{ outgoingRequests.length }}</span>
          </header>

          <div v-if="!outgoingRequests.length" class="request-message">
            <span class="request-message__mark" aria-hidden="true">↙</span>
            <strong>Tu lista está vacía.</strong>
            <p>Explora el catálogo y pide algo cuando lo necesites.</p>
            <router-link class="btn btn--ghost" to="/catalogo">Explorar catálogo</router-link>
          </div>

          <ul v-else class="request-list">
            <li v-for="request in outgoingRequests" :key="request.id" class="request-card">
              <div class="request-card__item">
                <span class="request-card__icon">{{ request.item.categoryIcon || '·' }}</span>
                <div>
                  <span class="request-card__code">{{ request.item.code }}</span>
                  <h3>{{ request.item.title }}</h3>
                  <p>{{ formatOffer(request) }}</p>
                </div>
              </div>
              <div class="request-card__details">
                <span>Propietario <strong>{{ request.item.owner.name || request.item.owner.email }}</strong></span>
                <span>{{ formatDateRange(request) }}</span>
                <span v-if="request.payment">Pago {{ request.payment.status === 'SIMULATED_PAID' ? 'simulado registrado' : request.payment.status.toLowerCase() }}</span>
                <span v-if="request.message">“{{ request.message }}”</span>
              </div>
              <div class="request-card__footer">
                <span class="request-status" :class="`request-status--${request.status.toLowerCase()}`">
                  <span aria-hidden="true"></span>{{ statusLabel(request.status) }}
                </span>
                <div class="request-card__actions">
                  <button
                    v-if="request.status === 'PENDING'"
                    class="request-card__action"
                    type="button"
                    :disabled="busyKey === `cancel:${request.id}:`"
                    @click="performAction(request, 'cancel')"
                  >
                    Cancelar
                  </button>
                  <button
                    v-if="request.loan?.status === 'ACTIVE'"
                    class="request-card__action"
                    type="button"
                    :disabled="busyKey === `return:${request.id}:${request.loan.id}`"
                    @click="performAction(request, 'return')"
                  >
                    Marcar devolución
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.requests-page {
  min-height: 100svh;
  background:
    radial-gradient(circle at 88% 2%, var(--gold-bg), transparent 26%),
    var(--paper);
}

.requests-content {
  max-width: 1220px;
  margin: 0 auto;
  padding: clamp(48px, 8vw, 90px) clamp(20px, 5vw, 64px) 96px;
}

.requests-masthead {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 30px;
  padding-bottom: 48px;
}

.back-link {
  display: inline-block;
  margin-bottom: 36px;
  color: var(--crimson-dark);
  font-family: var(--mono);
  font-size: 12px;
  text-decoration: none;
  letter-spacing: 0.04em;
}

.back-link:hover {
  color: var(--crimson);
}

.requests-masthead__eyebrow,
.section-kicker {
  margin: 0 0 12px;
  color: var(--crimson-dark);
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.requests-masthead h1 {
  max-width: 14ch;
  font-size: clamp(44px, 6vw, 70px);
  line-height: 0.98;
  letter-spacing: -1.8px;
}

.requests-masthead p:last-child {
  margin-top: 24px;
  color: var(--ink-soft);
  font-size: 17px;
}

.requests-masthead__signal {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 126px;
  height: 126px;
  flex: 0 0 auto;
  border: 1px solid var(--gold);
  border-radius: 50% 50% 50% 8px;
  background: var(--gold-bg);
  transform: rotate(5deg);
}

.requests-masthead__signal strong {
  color: var(--crimson-dark);
  font-family: var(--display);
  font-size: 42px;
  line-height: 1;
}

.requests-masthead__signal span {
  color: var(--ink-faint);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.request-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 58px;
}

.request-stats > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 17px 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--paper-2);
}

.request-stats span {
  color: var(--ink-faint);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.request-stats strong {
  color: var(--ink);
  font-family: var(--display);
  font-size: 30px;
  line-height: 1;
}

.request-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 32px;
}

.request-section {
  min-width: 0;
  border-top: 1px solid var(--line-strong);
}

.request-section__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding: 25px 0 20px;
}

.request-section__header .section-kicker {
  margin-bottom: 8px;
}

.request-section__header h2 {
  font-size: 31px;
  line-height: 1;
}

.request-section__header > span {
  color: var(--ink-faint);
  font-family: var(--mono);
  font-size: 12px;
}

.request-list {
  display: grid;
  gap: 10px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.request-card {
  display: grid;
  gap: 15px;
  padding: 17px;
  border: 1px solid var(--line);
  border-radius: 14px 14px 14px 3px;
  background: var(--paper-2);
}

.request-card__item {
  display: flex;
  align-items: center;
  gap: 11px;
}

.request-card__icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 11px 11px 11px 2px;
  background: var(--crimson-bg);
  font-size: 19px;
}

.request-card__item div {
  min-width: 0;
}

.request-card__code {
  color: var(--ink-faint);
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.04em;
}

.request-card h3 {
  margin-top: 2px;
  font-size: 20px;
  line-height: 1.05;
}

.request-card__item p {
  margin-top: 3px;
  color: var(--crimson-dark);
  font-family: var(--mono);
  font-size: 11px;
}

.request-card__details {
  display: grid;
  gap: 5px;
  padding: 11px 0;
  border-top: 1px dashed var(--line-strong);
  border-bottom: 1px dashed var(--line-strong);
  color: var(--ink-faint);
  font-size: 12px;
  line-height: 1.4;
}

.request-card__details strong {
  color: var(--ink-soft);
}

.request-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.request-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-faint);
  font-size: 12px;
}

.request-status > span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ink-faint);
}

.request-status--pending {
  color: var(--gold);
}

.request-status--pending > span {
  background: var(--gold);
}

.request-status--approved {
  color: var(--navy-2);
}

.request-status--approved > span {
  background: var(--navy-2);
}

.request-status--rejected,
.request-status--cancelled {
  color: var(--crimson-dark);
}

.request-status--rejected > span,
.request-status--cancelled > span {
  background: var(--crimson);
}

.request-card__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.request-card__action {
  padding: 7px 10px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--ink-soft);
  font: 600 11px var(--sans);
  cursor: pointer;
}

.request-card__action:hover:not(:disabled) {
  border-color: var(--crimson);
  background: var(--crimson);
  color: var(--on-dark);
}

.request-card__action--primary {
  border-color: var(--gold);
  background: var(--gold-bg);
  color: var(--ink);
}

.request-card__action:disabled {
  cursor: wait;
  opacity: 0.6;
}

.requests-loading {
  margin-top: 20px;
}

.request-message {
  display: grid;
  justify-items: start;
  gap: 9px;
  min-height: 190px;
  padding: 25px;
  border: 1px dashed var(--line-strong);
  border-radius: 14px;
  background: color-mix(in srgb, var(--paper-2) 72%, transparent);
}

.request-message strong {
  color: var(--ink);
  font-family: var(--display);
  font-size: 21px;
}

.request-message p {
  color: var(--ink-faint);
  font-size: 13px;
}

.request-message--error strong {
  color: var(--crimson-dark);
}

.request-message__mark {
  color: var(--gold);
  font-family: var(--display);
  font-size: 31px;
}

@media (max-width: 900px) {
  .request-columns {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .requests-masthead {
    align-items: flex-start;
    flex-direction: column;
  }

  .requests-masthead__signal {
    align-self: flex-end;
  }

  .request-stats {
    grid-template-columns: 1fr;
  }

  .request-card__footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .request-card__actions {
    justify-content: flex-start;
  }
}

@media (max-width: 460px) {
  .requests-masthead h1 {
    font-size: 48px;
  }
}
</style>
