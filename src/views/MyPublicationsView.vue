<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { push } from 'notivue'
import LoadingState from '../components/LoadingState.vue'
import ModalDialog from '../components/ModalDialog.vue'
import PublishArticleForm from '../components/PublishArticleForm.vue'
import SiteFooter from '../components/SiteFooter.vue'
import SiteHeader from '../components/SiteHeader.vue'
import { removeItemPhoto } from '../lib/storage'
import { useArticlesStore } from '../stores/articles'
import type { Article } from '../types'

const articlesStore = useArticlesStore()
const updatingId = ref<string | null>(null)
const deletingId = ref<string | null>(null)
const editingArticle = ref<Article | null>(null)

const availableCount = computed(() => articlesStore.myArticles.filter((article) => article.status === 'available').length)
const pausedCount = computed(() => articlesStore.myArticles.filter((article) => article.status === 'paused').length)

onMounted(() => {
  void articlesStore.loadMine()
})

function statusLabel(status: Article['status']) {
  const labels: Record<Article['status'], string> = {
    available: 'Disponible',
    paused: 'Pausado',
    lent: 'En préstamo',
    rejected: 'Requiere revisión',
  }
  return labels[status]
}

function formatDate(value?: string) {
  if (!value) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' }).format(new Date(value))
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

function openEdit(article: Article) {
  editingArticle.value = article
}

function closeEdit() {
  editingArticle.value = null
}

function handleUpdated() {
  closeEdit()
  push.success({ title: 'Publicación actualizada', message: 'Los cambios ya están visibles en tu estante.' })
}

async function toggleStatus(article: Article) {
  if (article.status !== 'available' && article.status !== 'paused') return

  updatingId.value = article.id
  const nextStatus = article.status === 'available' ? 'paused' : 'available'

  try {
    await articlesStore.setStatus(article.id, nextStatus)
    push.success({
      title: nextStatus === 'available' ? 'Publicación reactivada' : 'Publicación pausada',
      message: nextStatus === 'available' ? 'El campus ya puede volver a verla.' : 'Dejará de aparecer en el catálogo.',
    })
  } catch (error) {
    push.error({
      title: 'No se actualizó la publicación',
      message: error instanceof Error ? error.message : 'Intenta nuevamente.',
    })
  } finally {
    updatingId.value = null
  }
}

async function deletePublication(article: Article) {
  if (!window.confirm(`¿Eliminar “${article.title}”? Esta acción no se puede deshacer.`)) return

  deletingId.value = article.id
  try {
    const deleted = await articlesStore.remove(article.id)
    if (deleted.photoUrl) {
      void removeItemPhoto(deleted.photoUrl).catch(() => undefined)
    }
    push.success({ title: 'Publicación eliminada', message: 'El objeto salió de tu estante.' })
  } catch (error) {
    push.error({
      title: 'No se eliminó la publicación',
      message: error instanceof Error ? error.message : 'Intenta nuevamente.',
    })
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="my-page">
    <SiteHeader show-marketplace-nav />

    <main class="my-content">
      <header class="my-masthead">
        <div>
          <router-link class="back-link" to="/catalogo">← Explorar objetos</router-link>
          <p class="my-masthead__eyebrow">Tu estante · LendIt UJAP</p>
          <h1>Lo que has puesto a circular.</h1>
          <p>Administra la disponibilidad de tus objetos desde un solo lugar.</p>
        </div>
        <router-link class="btn btn--primary" to="/publicar">+ Nueva publicación</router-link>
      </header>

      <section class="my-stats" aria-label="Resumen de publicaciones">
        <div class="my-stat my-stat--total">
          <span class="my-stat__label">Total publicado</span>
          <strong>{{ articlesStore.myArticles.length }}</strong>
          <span>fichas en tu estante</span>
        </div>
        <div class="my-stat">
          <span class="my-stat__label">Disponibles</span>
          <strong>{{ availableCount }}</strong>
          <span>visibles para pedir</span>
        </div>
        <div class="my-stat">
          <span class="my-stat__label">Pausados</span>
          <strong>{{ pausedCount }}</strong>
          <span>fuera del catálogo</span>
        </div>
      </section>

      <section class="my-list" aria-labelledby="my-list-title">
        <div class="my-list__heading">
          <div>
            <p class="section-kicker">Mis publicaciones</p>
            <h2 id="my-list-title">Tus objetos</h2>
          </div>
          <span v-if="!articlesStore.isLoadingMine" class="my-list__count">
            {{ articlesStore.myArticles.length }} {{ articlesStore.myArticles.length === 1 ? 'objeto' : 'objetos' }}
          </span>
        </div>

        <LoadingState v-if="articlesStore.isLoadingMine" label="Cargando tu estante…" />

        <div v-else-if="articlesStore.mineError" class="my-message my-message--error">
          <strong>No pudimos cargar tus publicaciones.</strong>
          <p>{{ articlesStore.mineError }}</p>
          <button class="btn btn--ghost" type="button" @click="articlesStore.loadMine">Intentar de nuevo</button>
        </div>

        <div v-else-if="!articlesStore.myArticles.length" class="my-message">
          <span class="my-message__mark" aria-hidden="true">✦</span>
          <strong>Tu estante está esperando el primer objeto.</strong>
          <p>Publica una calculadora, un cargador, un libro o cualquier cosa útil para otra persona.</p>
          <router-link class="btn btn--primary" to="/publicar">Publicar mi primer objeto</router-link>
        </div>

        <ul v-else class="publication-list">
          <li v-for="article in articlesStore.myArticles" :key="article.id" class="publication-row">
            <div class="publication-row__mark" aria-hidden="true">
              <img v-if="article.photoUrl" :src="article.photoUrl" :alt="`Foto de ${article.title}`" />
              <span v-else>{{ article.categoryIcon || '·' }}</span>
            </div>
            <div class="publication-row__body">
              <div class="publication-row__topline">
                <span class="publication-row__code">{{ article.code }}</span>
                <span class="publication-row__date">Publicado {{ formatDate(article.publishedAt) }}</span>
              </div>
              <h3>{{ article.title }}</h3>
              <p class="publication-row__meta">{{ article.category }} · {{ article.duration }} · {{ formatOffer(article) }}</p>
              <p v-if="article.description" class="publication-row__description">{{ article.description }}</p>
              <div class="publication-row__bottomline">
                <span class="publication-status" :class="`publication-status--${article.status}`">
                  <span aria-hidden="true"></span>{{ statusLabel(article.status) }}
                </span>
                <span v-if="article.restrictedToRoles.length" class="publication-row__audience">
                  Solo {{ article.restrictedToRoles.map((role) => role === 'STUDENT' ? 'estudiantes' : 'profesores').join(' y ') }}
                </span>
                <span v-else class="publication-row__audience">Todo el campus</span>
              </div>
            </div>
            <div class="publication-row__actions">
              <button class="publication-row__action" type="button" @click="openEdit(article)">Editar</button>
              <button
                v-if="article.status === 'available' || article.status === 'paused'"
                class="publication-row__action"
                type="button"
                :disabled="updatingId === article.id || deletingId === article.id"
                @click="toggleStatus(article)"
              >
                {{ updatingId === article.id ? 'Guardando…' : article.status === 'available' ? 'Pausar' : 'Reactivar' }}
              </button>
              <button
                class="publication-row__action publication-row__action--danger"
                type="button"
                :disabled="deletingId === article.id || updatingId === article.id"
                @click="deletePublication(article)"
              >
                {{ deletingId === article.id ? 'Eliminando…' : 'Eliminar' }}
              </button>
            </div>
          </li>
        </ul>
      </section>
    </main>

    <SiteFooter />

    <ModalDialog v-if="editingArticle" wide title="Editar publicación" @close="closeEdit">
      <PublishArticleForm :article="editingArticle" submit-label="Guardar cambios" @updated="handleUpdated" />
    </ModalDialog>
  </div>
</template>

<style scoped>
.my-page {
  min-height: 100svh;
  background:
    linear-gradient(120deg, color-mix(in srgb, var(--navy-bg) 64%, transparent), transparent 35%),
    var(--paper);
}

.my-content {
  max-width: 1220px;
  margin: 0 auto;
  padding: clamp(48px, 8vw, 90px) clamp(20px, 5vw, 64px) 96px;
}

.my-masthead {
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

.my-masthead__eyebrow,
.section-kicker {
  margin: 0 0 12px;
  color: var(--crimson-dark);
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.my-masthead h1 {
  max-width: 13ch;
  font-size: clamp(44px, 6.5vw, 70px);
  line-height: 0.98;
  letter-spacing: -1.8px;
}

.my-masthead p:last-child {
  margin-top: 24px;
  color: var(--ink-soft);
  font-size: 17px;
}

.my-stats {
  display: grid;
  grid-template-columns: 1.35fr 1fr 1fr;
  gap: 12px;
  margin-bottom: 58px;
}

.my-stat {
  display: flex;
  flex-direction: column;
  min-height: 136px;
  padding: 21px 23px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--paper-2);
}

.my-stat--total {
  border-color: color-mix(in srgb, var(--gold) 48%, var(--line));
  background: linear-gradient(135deg, var(--gold-bg), var(--paper-2) 70%);
}

.my-stat__label {
  color: var(--ink-faint);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.my-stat strong {
  margin: auto 0 2px;
  color: var(--ink);
  font-family: var(--display);
  font-size: 42px;
  line-height: 1;
}

.my-stat > span:last-child {
  color: var(--ink-faint);
  font-size: 12px;
}

.my-list {
  border-top: 1px solid var(--line-strong);
}

.my-list__heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding: 26px 0 22px;
}

.my-list__heading .section-kicker {
  margin-bottom: 8px;
}

.my-list__heading h2 {
  font-size: 34px;
  line-height: 1;
}

.my-list__count {
  color: var(--ink-faint);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.publication-list {
  display: grid;
  gap: 10px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.publication-row {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 15px 15px 15px 3px;
  background: var(--paper-2);
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.publication-row:hover {
  border-color: var(--gold-light);
  box-shadow: var(--shadow-soft);
  transform: translateY(-2px);
}

.publication-row__mark {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 15px 15px 15px 3px;
  background: var(--crimson-bg);
  color: var(--crimson-dark);
  font-size: 25px;
}

.publication-row__mark img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.publication-row__mark span {
  line-height: 1;
}

.publication-row__topline,
.publication-row__bottomline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.publication-row__topline {
  justify-content: space-between;
  gap: 15px;
}

.publication-row__code,
.publication-row__date {
  color: var(--ink-faint);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.publication-row h3 {
  margin-top: 7px;
  font-size: 23px;
  line-height: 1.05;
}

.publication-row__meta {
  margin-top: 4px;
  color: var(--ink-faint);
  font-size: 13px;
}

.publication-row__description {
  max-width: 70ch;
  margin-top: 9px;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.45;
}

.publication-row__bottomline {
  margin-top: 14px;
}

.publication-status,
.publication-row__audience {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-faint);
  font-size: 12px;
}

.publication-status span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ink-faint);
}

.publication-status--available {
  color: var(--gold);
}

.publication-status--available span {
  background: var(--gold);
}

.publication-status--paused {
  color: var(--crimson-dark);
}

.publication-status--paused span {
  background: var(--crimson);
}

.publication-row__audience {
  padding-left: 10px;
  border-left: 1px solid var(--line-strong);
}

.publication-row__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.publication-row__action {
  padding: 9px 13px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--ink-soft);
  font: 600 12px var(--sans);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.publication-row__action:hover:not(:disabled) {
  border-color: var(--crimson);
  background: var(--crimson);
  color: var(--on-dark);
}

.publication-row__action--danger {
  color: var(--crimson-dark);
}

.publication-row__action:disabled {
  cursor: wait;
  opacity: 0.6;
}

.my-message {
  display: grid;
  justify-items: start;
  gap: 10px;
  min-height: 240px;
  padding: 30px;
  border: 1px dashed var(--line-strong);
  border-radius: 16px;
  background: color-mix(in srgb, var(--paper-2) 72%, transparent);
}

.my-message strong {
  color: var(--ink);
  font-family: var(--display);
  font-size: 25px;
}

.my-message p {
  color: var(--ink-faint);
}

.my-message--error strong {
  color: var(--crimson-dark);
}

.my-message__mark {
  color: var(--gold);
  font-size: 36px;
}

@media (max-width: 760px) {
  .my-masthead {
    align-items: flex-start;
    flex-direction: column;
  }

  .my-masthead .btn {
    width: 100%;
  }

  .my-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .my-stat {
    min-height: 118px;
    padding: 16px;
  }

  .my-stat strong {
    font-size: 34px;
  }

  .publication-row {
    grid-template-columns: 48px minmax(0, 1fr);
    gap: 13px;
  }

  .publication-row__mark {
    width: 48px;
    height: 48px;
  }

  .publication-row__actions {
    grid-column: 2;
    justify-content: flex-start;
  }
}

@media (max-width: 460px) {
  .my-masthead h1 {
    font-size: 48px;
  }

  .my-stats {
    grid-template-columns: 1fr;
  }

  .my-stat {
    min-height: 100px;
  }

  .my-stat strong {
    margin-top: 18px;
  }

  .publication-row__topline {
    display: block;
  }

  .publication-row__date {
    display: block;
    margin-top: 4px;
  }

  .publication-row__audience {
    padding-left: 0;
    border-left: 0;
  }
}
</style>
