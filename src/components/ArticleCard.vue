<script setup lang="ts">
import type { Article } from '../types'

withDefaults(
  defineProps<{
    article: Article
    isOwn?: boolean
  }>(),
  { isOwn: false },
)

defineEmits<{
  (e: 'request', articleId: string): void
}>()

function formatOffer(article: { mode: string; price: number | null; currency: string | null }) {
  if (article.mode !== 'RENTAL' || article.price === null || !article.currency) {
    return 'Préstamo gratuito'
  }

  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: article.currency,
    maximumFractionDigits: 2,
  }).format(article.price)
}
</script>

<template>
  <article class="loan-card">
    <div class="loan-card__visual">
      <img v-if="article.photoUrl" :src="article.photoUrl" :alt="`Foto de ${article.title}`" />
      <span v-else aria-hidden="true">{{ article.categoryIcon || '·' }}</span>
    </div>
    <header>
      <span 
        class="loan-card__tag" 
        :class="{ 'loan-card__tag--gold': article.status === 'available' }"
      >
        {{ article.status === 'available' ? 'DISPONIBLE' : 'EN PRÉSTAMO' }}
      </span>
      <span class="loan-card__code">{{ article.code }}</span>
    </header>
    <h3>{{ article.title }}</h3>
    <p class="loan-card__meta">{{ article.category }} · {{ article.duration }}</p>
    <p class="loan-card__offer">{{ formatOffer(article) }}</p>
    
    <footer class="loan-card__footer">
      <div v-if="article.status === 'lent' && article.returnTime" class="loan-card__return">
        <span>Devuelve</span>
        <strong>{{ article.returnTime }}</strong>
      </div>
      <div v-else class="loan-card__return">
        <span>Listo para retirar</span>
      </div>
      <span v-if="isOwn" class="loan-card__own">Es tuyo</span>
      <button
        v-else
        class="btn-action"
        :class="{ 'btn-action--available': article.status === 'available' }"
        @click="$emit('request', article.id)"
      >
        {{ article.status === 'available' ? 'Pedir' : 'Preguntar' }}
      </button>
    </footer>
  </article>
</template>

<style scoped>
.loan-card {
  width: 268px;
  max-width: 100%;
  padding: 22px 22px 20px;
  border-radius: 16px;
  background: var(--paper-2);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.loan-card:hover {
  transform: translateY(-2px) rotate(0deg) !important;
  box-shadow: var(--shadow-soft);
}

.loan-card header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.loan-card__visual {
  display: grid;
  place-items: center;
  width: 100%;
  height: 82px;
  margin-bottom: 14px;
  overflow: hidden;
  border-radius: 11px;
  background: linear-gradient(135deg, var(--navy-bg), var(--gold-bg));
}

.loan-card__visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.loan-card__visual span {
  font-size: 31px;
}

.loan-card__tag {
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.06em;
  color: var(--crimson-dark);
  background: var(--crimson-bg);
  padding: 4px 8px;
  border-radius: 5px;
}

.loan-card__tag--gold {
  color: var(--gold);
  background: var(--gold-bg);
}

.loan-card__code {
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--ink-faint);
}

.loan-card h3 {
  font-size: 19px;
  font-weight: 560;
  margin: 0;
  color: var(--ink);
}

.loan-card__meta {
  margin: 4px 0 16px 0;
  font-size: 13px;
  color: var(--ink-faint);
}

.loan-card__offer {
  margin-top: -9px;
  color: var(--crimson-dark);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.02em;
}

.loan-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px dashed var(--line-strong);
  font-size: 12.5px;
  color: var(--ink-faint);
}

.loan-card__return {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
}

.loan-card__return strong {
  font-family: var(--mono);
  color: var(--ink);
}

.btn-action {
  background: color-mix(in srgb, var(--crimson) 8%, var(--paper-2));
  color: var(--crimson-dark);
  border: 1px solid color-mix(in srgb, var(--crimson) 25%, transparent);
  border-radius: 999px;
  padding: 6px 14px;
  font-family: var(--sans);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-action:hover {
  background: var(--crimson);
  color: white;
  border-color: var(--crimson);
}

.btn-action--available {
  background: color-mix(in srgb, var(--gold) 10%, var(--paper-2));
  color: var(--gold);
  border-color: color-mix(in srgb, var(--gold) 30%, transparent);
}

.btn-action--available:hover {
  background: var(--gold);
  color: var(--navy);
  border-color: var(--gold);
}

.loan-card__own {
  font-family: var(--sans);
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-faint);
}
</style>
