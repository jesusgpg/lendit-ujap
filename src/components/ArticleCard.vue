<script setup lang="ts">
import type { Article } from '../types'
import ItemPhotoGallery from './ItemPhotoGallery.vue'
withDefaults(defineProps<{ article: Article; isOwn?: boolean; readOnly?: boolean }>(), { isOwn: false, readOnly: false })
defineEmits<{ (e: 'request', articleId: string): void; (e: 'question', articleId: string): void }>()
function formatOffer(article: Article) {
  if (article.mode !== 'RENTAL' || article.price === null || !article.currency) return 'Préstamo gratuito'
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: article.currency, maximumFractionDigits: 2 }).format(article.price)
}
</script>
<template>
  <article class="loan-card">
    <div class="loan-card__visual">
      <ItemPhotoGallery class="loan-card__gallery" :photo-urls="article.photoUrls" :photo-url="article.photoUrl" :title="article.title" :category-icon="article.category.slice(0, 1)" />
      <span class="loan-card__status" :class="{ 'loan-card__status--lent': article.status !== 'available' }">{{ article.status === 'available' ? 'Disponible' : 'En préstamo' }}</span>
    </div>
    <div class="loan-card__body">
      <p class="loan-card__category">{{ article.category }}</p>
      <h3>{{ article.title }}</h3>
      <p class="loan-card__meta">{{ article.duration }}</p>
      <div class="loan-card__footer"><div><strong>{{ formatOffer(article) }}</strong><span>{{ article.status === 'lent' && article.returnTime ? `Devolución: ${article.returnTime}` : 'Entrega por coordinar' }}</span></div><span v-if="readOnly || isOwn" class="loan-card__own">{{ readOnly ? 'Solo lectura' : 'Tu publicación' }}</span><button v-else type="button" @click="$emit('request', article.id)">{{ article.status === 'available' ? 'Solicitar' : 'Consultar' }} <span aria-hidden="true">↗</span></button></div>
      <button v-if="!isOwn && !readOnly" type="button" class="loan-card__question" @click="$emit('question', article.id)">Preguntar al propietario</button>
    </div>
  </article>
</template>
<style scoped>
.loan-card{min-width:0;width:100%;background:var(--paper);border-radius:14px;overflow:hidden}.loan-card__visual{position:relative;overflow:hidden;border-radius:14px;background:var(--surface-soft)}.loan-card__gallery{height:220px;border-radius:14px;background:var(--surface-soft)}.loan-card__gallery :deep(.item-gallery__fallback-icon){font:500 64px var(--display);color:var(--navy);opacity:.65}.loan-card__gallery :deep(.item-gallery__image){transition:transform 300ms var(--ease-out)}.loan-card__status{position:absolute;bottom:13px;left:13px;z-index:4;padding:5px 10px;border-radius:999px;background:var(--paper);color:var(--ink);font:600 12px var(--sans);pointer-events:none}.loan-card__status::before{display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;background:#397448;content:''}.loan-card__status--lent::before{background:var(--gold)}.loan-card__body{padding:17px 1px 0}.loan-card__category{font-size:13px;color:var(--ink-soft);margin:0 0 5px}.loan-card h3{font:650 21px/1.3 var(--sans);letter-spacing:-.025em;overflow-wrap:anywhere}.loan-card__meta{margin-top:5px;font-size:14px;color:var(--ink-soft)}.loan-card__footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:17px}.loan-card__footer>div{min-width:0}.loan-card__footer strong,.loan-card__footer>div>span{display:block}.loan-card__footer strong{font-size:15px;color:var(--navy)}.loan-card__footer>div>span{margin-top:4px;font-size:12px;color:var(--ink-soft)}.loan-card__footer button{flex:0 0 auto;padding:10px 15px;border:0;border-radius:999px;background:var(--crimson);color:white;font:650 13px var(--sans);cursor:pointer;transition:background 160ms ease,transform 160ms var(--ease-out)}.loan-card__footer button:hover{background:var(--crimson-dark)}.loan-card__footer button:active{transform:scale(.97)}.loan-card__own{font-size:13px;color:var(--ink-soft)}@media(hover:hover) and (pointer:fine){.loan-card:hover :deep(.item-gallery__image){transform:scale(1.035)}}@media(max-width:1000px) and (min-width:701px){.loan-card__footer{align-items:flex-start;flex-direction:column}.loan-card__gallery{height:190px}}@media(prefers-reduced-motion:reduce){.loan-card__gallery :deep(.item-gallery__image),.loan-card__footer button{transition:none}}
</style>

<style scoped>
.loan-card__question{padding:10px 0;margin-top:8px;min-height:44px;background:none;border:0;color:var(--crimson-dark);font:500 14px var(--sans);text-decoration:underline;text-underline-offset:4px;cursor:pointer}
</style>
