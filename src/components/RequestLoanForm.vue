<script setup lang="ts">
import { ref } from 'vue'
import { push } from 'notivue'
import type { Article } from '../types'
import { useRequestsStore } from '../stores/requests'

defineProps<{
  article: Article
}>()

const emit = defineEmits<{
  (e: 'submitted'): void
}>()

const requestsStore = useRequestsStore()
const startsAt = ref(toLocalDateTime(new Date(Date.now() + 30 * 60 * 1000)))
const endsAt = ref(toLocalDateTime(new Date(Date.now() + 150 * 60 * 1000)))
const message = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)
const minimumStart = toLocalDateTime(new Date())

function toLocalDateTime(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

function formatOffer(article: Article) {
  if (article.mode !== 'RENTAL' || article.price === null || !article.currency) {
    return 'Préstamo gratuito'
  }

  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: article.currency,
    maximumFractionDigits: 2,
  }).format(article.price)
}

async function submit(article: Article) {
  errorMessage.value = ''
  const starts = new Date(startsAt.value)
  const ends = new Date(endsAt.value)

  if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime()) || ends <= starts) {
    errorMessage.value = 'La fecha de devolución debe ser posterior al inicio.'
    return
  }
  if (starts.getTime() < Date.now() - 60_000) {
    errorMessage.value = 'El inicio del préstamo no puede estar en el pasado.'
    return
  }

  isSubmitting.value = true
  try {
    await requestsStore.create({
      itemId: article.id,
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      message: message.value.trim() || undefined,
    })
    push.success({
      title: 'Solicitud enviada',
      message:
        article.mode === 'RENTAL'
          ? 'El pago simulado quedó registrado y el propietario debe aprobar la solicitud.'
          : 'El propietario debe aprobar la solicitud antes de entregarte el objeto.',
    })
    emit('submitted')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo enviar la solicitud.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <form class="request-form" @submit.prevent="submit(article)">
    <div class="request-form__item">
      <span class="request-form__icon">{{ article.categoryIcon || '·' }}</span>
      <div>
        <strong>{{ article.title }}</strong>
        <span>{{ article.category }} · {{ formatOffer(article) }}</span>
      </div>
    </div>

    <div class="request-form__dates">
      <label class="field">
        <span>Desde</span>
        <input v-model="startsAt" :min="minimumStart" type="datetime-local" required />
      </label>
      <label class="field">
        <span>Hasta</span>
        <input v-model="endsAt" :min="startsAt || minimumStart" type="datetime-local" required />
      </label>
    </div>

    <label class="field">
      <span>Mensaje para quien presta <small>(opcional)</small></span>
      <textarea
        v-model="message"
        rows="3"
        maxlength="600"
        placeholder="¿Dónde te conviene encontrarse? ¿Para qué clase lo necesitas?"
      ></textarea>
    </label>

    <div v-if="article.mode === 'RENTAL'" class="payment-note">
      <span class="payment-note__mark">₿</span>
      <p><strong>Pago simulado</strong> · Se registrará {{ formatOffer(article) }} sin realizar un cobro real.</p>
    </div>

    <p v-if="errorMessage" class="request-form__error">{{ errorMessage }}</p>
    <button class="btn btn--primary" type="submit" :disabled="isSubmitting">
      {{ isSubmitting ? 'Enviando…' : article.mode === 'RENTAL' ? 'Pagar y solicitar' : 'Enviar solicitud' }}
    </button>
  </form>
</template>

<style scoped>
.request-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.request-form__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px;
  border-radius: 12px;
  background: var(--paper);
  border: 1px solid var(--line);
}

.request-form__icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 10px 10px 10px 2px;
  background: var(--crimson-bg);
  font-size: 21px;
}

.request-form__item div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.request-form__item strong {
  color: var(--ink);
  font-family: var(--display);
  font-size: 19px;
}

.request-form__item div span {
  color: var(--ink-faint);
  font-size: 12px;
}

.request-form__dates {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  color: var(--ink-soft);
  font-size: 13px;
  font-weight: 600;
}

.field input,
.field textarea {
  width: 100%;
  min-width: 0;
  padding: 10px 11px;
  border: 1.5px solid var(--line-strong);
  border-radius: 9px;
  background: var(--paper);
  color: var(--ink);
  font: inherit;
}

.field textarea {
  resize: vertical;
  line-height: 1.45;
}

.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--crimson);
}

.field small {
  color: var(--ink-faint);
  font-size: 11px;
  font-weight: 400;
}

.payment-note {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 13px;
  border: 1px solid color-mix(in srgb, var(--gold) 44%, var(--line));
  border-radius: 10px;
  background: var(--gold-bg);
}

.payment-note__mark {
  color: var(--gold);
  font-family: var(--mono);
  font-size: 17px;
}

.payment-note p {
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.4;
}

.payment-note strong {
  color: var(--ink);
}

.request-form__error {
  color: var(--crimson-dark);
  font-size: 13px;
}

.request-form .btn {
  width: 100%;
}

.request-form .btn:disabled {
  cursor: wait;
  opacity: 0.7;
}

@media (max-width: 430px) {
  .request-form__dates {
    grid-template-columns: 1fr;
  }
}
</style>
