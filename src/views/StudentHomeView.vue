<script setup lang="ts">
import { computed, onMounted } from 'vue'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useAuthStore } from '../stores/auth'
import { useArticlesStore } from '../stores/articles'
import { useRequestsStore } from '../stores/requests'
import { useMessagesStore } from '../stores/messages'
import type { LoanRequest } from '../types'

const auth = useAuthStore()
const articles = useArticlesStore()
const requests = useRequestsStore()
const messagesStore = useMessagesStore()
const pending = computed(() => requests.requests.filter(r => r.isOwner && r.status === 'PENDING'))
const active = computed(() => requests.requests.filter(r => r.loan?.status === 'ACTIVE' || r.loan?.status === 'OVERDUE'))
const upcoming = computed(() => [...active.value].sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt)).slice(0, 3))
const recent = computed(() => [...articles.myArticles].sort((a, b) => Date.parse(b.publishedAt ?? '') - Date.parse(a.publishedAt ?? '')).slice(0, 3))
const available = computed(() => articles.myArticles.filter(item => item.status === 'available').length)

function dueLabel(request: LoanRequest) {
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(request.endsAt))
}

function load() {
  return Promise.all([articles.loadMine(), requests.load(), messagesStore.load()])
}

onMounted(() => { void load() })
</script>

<template>
  <div class="student-home">
    <SiteHeader show-marketplace-nav />
    <main id="main-content" class="home-workspace">
      <header class="home-heading">
        <div>
          <p class="home-context">Tu espacio en LendIt UJAP</p>
          <h1>Hola, {{ auth.user?.firstName }}.</h1>
          <p>Lo que compartes, lo que necesitas y tus próximos acuerdos.</p>
        </div>
        <router-link v-if="auth.isTeacherApplicant" class="btn btn--primary" to="/cuenta/acreditacion">Acreditación docente <span aria-hidden="true">↗</span></router-link>
        <router-link v-else class="btn btn--primary" to="/publicar">Publicar un objeto <span aria-hidden="true">↗</span></router-link>
      </header>

      <div v-if="auth.isTeacherApplicant" class="home-alert-banner" role="alert">
        <div>
          <strong>Acreditación docente en curso</strong>
          <p>Tu postulación está en revisión administrativa. Mientras se valida tu credencial, la publicación y solicitud de objetos están pausadas.</p>
        </div>
        <router-link to="/cuenta/acreditacion" class="btn btn--small btn--primary">
          Ver estado ↗
        </router-link>
      </div>

      <section class="home-summary" aria-label="Resumen de tu actividad">
        <router-link to="/solicitudes"><span>Por responder</span><strong>{{ requests.isLoading ? '…' : requests.error ? '—' : pending.length }}</strong><span>Solicitudes recibidas <span aria-hidden="true">↗</span></span></router-link>
        <router-link to="/solicitudes"><span>En préstamo</span><strong>{{ requests.isLoading ? '…' : requests.error ? '—' : active.length }}</strong><span>Préstamos y alquileres activos <span aria-hidden="true">↗</span></span></router-link>
        <router-link to="/mis-publicaciones"><span>Tus objetos disponibles</span><strong>{{ articles.isLoadingMine ? '…' : articles.mineError ? '—' : available }}</strong><span>Gestionar publicaciones <span aria-hidden="true">↗</span></span></router-link>
      </section>

      <div class="home-columns">
        <div class="home-main">
          <section class="home-section" aria-labelledby="home-pending-title">
            <div class="home-section-heading"><h2 id="home-pending-title">Necesitan tu respuesta</h2><router-link to="/solicitudes">Ver solicitudes ↗</router-link></div>
            <div v-if="requests.isLoading" class="home-empty" role="status">Cargando tus solicitudes…</div>
            <div v-else-if="requests.error" class="home-empty" role="alert"><p>No pudimos cargar tus solicitudes.</p><button type="button" class="home-text-action" @click="requests.load()">Volver a intentar</button></div>
            <div v-else-if="!pending.length" class="home-empty"><strong>Todo al día.</strong><p>Cuando alguien pida uno de tus objetos, podrás revisar su solicitud aquí.</p></div>
            <ul v-else class="home-list"><li v-for="request in pending.slice(0, 3)" :key="request.id"><div><strong>{{ request.item.title }}</strong><p>{{ request.requester.name }} quiere pedirlo.</p></div><router-link to="/solicitudes">Revisar <span aria-hidden="true">↗</span></router-link></li></ul>
          </section>

          <section class="home-section" aria-labelledby="home-loans-title">
            <div class="home-section-heading"><h2 id="home-loans-title">Próximas devoluciones</h2><router-link to="/solicitudes">Ver préstamos ↗</router-link></div>
            <div v-if="requests.isLoading" class="home-empty" role="status">Cargando préstamos…</div>
            <div v-else-if="requests.error" class="home-empty">Los préstamos no están disponibles en este momento.</div>
            <div v-else-if="!upcoming.length" class="home-empty"><p>No tienes devoluciones pendientes. Explora el catálogo para encontrar lo que te falta.</p><router-link to="/catalogo">Explorar objetos ↗</router-link></div>
            <ul v-else class="home-list"><li v-for="request in upcoming" :key="request.id"><div><strong>{{ request.item.title }}</strong><p>{{ request.isOwner ? 'Recibes de' : 'Devuelves a' }} {{ request.isOwner ? request.requester.name : request.item.owner.name }}</p><time :datetime="request.endsAt">{{ dueLabel(request) }}</time></div><router-link to="/solicitudes">{{ request.loan?.status === 'OVERDUE' || Date.parse(request.endsAt) < Date.now() ? 'Plazo vencido' : 'Coordinar' }} ↗</router-link></li></ul>
          </section>
        </div>

        <aside class="home-aside">
          <section class="home-section" aria-labelledby="home-messages-title">
            <div class="home-section-heading"><h2 id="home-messages-title">Conversaciones recientes</h2><router-link to="/mensajes">Ver mensajes ↗</router-link></div>
            <p v-if="messagesStore.isLoading && !messagesStore.threads.length" class="home-empty" role="status">Cargando conversaciones…</p>
            <div v-else-if="messagesStore.error" class="home-empty" role="alert"><p>{{ messagesStore.error }}</p><button type="button" class="home-text-action" @click="messagesStore.load()">Reintentar</button></div>
            <ul v-else-if="messagesStore.threads.length" class="home-list"><li v-for="thread in messagesStore.threads.slice(0,3)" :key="`${thread.kind}:${thread.id}`"><div><strong>{{ thread.counterpart.name }}</strong><p>{{ thread.item.title }}</p></div><router-link :to="{name:'messages',query:{[thread.kind==='inquiry'?'conversation':'request']:thread.id}}">Abrir ↗</router-link></li></ul>
            <div v-else class="home-empty"><p>Las consultas y los chats de tus solicitudes aparecerán aquí.</p><router-link to="/mensajes">Abrir mensajes ↗</router-link></div>
          </section>
          <section class="home-discover" aria-labelledby="home-discover-title">
            <img src="/images/Logo-UJAP1.png" alt="" width="40" height="48" />
            <h2 id="home-discover-title">El campus tiene más para compartir.</h2>
            <p>Busca libros, calculadoras o equipos para tu próximo proyecto.</p>
            <router-link to="/catalogo">Explorar el catálogo <span aria-hidden="true">↗</span></router-link>
          </section>
          <section class="home-section" aria-labelledby="home-items-title">
            <div class="home-section-heading"><h2 id="home-items-title">Tus publicaciones</h2><router-link to="/mis-publicaciones">Ver todas ↗</router-link></div>
            <p v-if="articles.isLoadingMine" class="home-empty" role="status">Cargando publicaciones…</p>
            <div v-else-if="articles.mineError" class="home-empty" role="alert"><p>No pudimos cargar tus objetos.</p><button class="home-text-action" type="button" @click="articles.loadMine()">Volver a intentar</button></div>
            <div v-else-if="!recent.length" class="home-empty"><p>Tu primera publicación puede ayudar a alguien de la comunidad.</p><router-link to="/publicar">Compartir un objeto ↗</router-link></div>
            <ul v-else class="home-list home-item-list"><li v-for="item in recent" :key="item.id"><img v-if="item.photoUrl" :src="item.photoUrl" alt="" loading="lazy" /><span v-else class="home-item-initial" aria-hidden="true">{{ item.category.charAt(0) }}</span><div><router-link to="/mis-publicaciones">{{ item.title }}</router-link><p>{{ item.status === 'available' ? 'Disponible' : item.status === 'lent' ? 'En préstamo' : item.status === 'paused' ? 'Pausada' : 'No disponible' }}</p></div></li></ul>
          </section>
        </aside>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.student-home{min-height:100svh;background:var(--paper)}
.home-workspace{max-width:1440px;margin:auto;padding:40px clamp(20px,4vw,56px) 72px;min-height:75svh}
.home-heading{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:32px}
.home-context{font-size:14px;color:var(--ink-soft);margin-bottom:8px}
.home-heading h1{font:550 clamp(30px,3vw,40px)/1.15 var(--display);letter-spacing:-.03em;margin-bottom:12px}
.home-heading p:last-child{font-size:16px;line-height:1.6;color:var(--ink-soft)}
.home-heading .btn{gap:24px;flex-shrink:0}
.home-alert-banner{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:18px 24px;margin-bottom:32px;background:var(--gold-bg);border:1px solid var(--gold-border);border-radius:12px;color:var(--ink)}
.home-alert-banner strong{display:block;font-size:15px;color:var(--navy);margin-bottom:4px}
.home-alert-banner p{font-size:14px;line-height:1.5;margin:0;color:var(--ink-soft)}
.home-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:var(--surface-soft);border-radius:16px;padding:24px 0;margin-bottom:40px}
.home-summary>a{display:flex;flex-direction:column;gap:8px;padding:0 28px;text-decoration:none;color:var(--ink)}
.home-summary>a+a{border-left:1px solid var(--line)}
.home-summary strong{font:600 34px/1.2 var(--sans);font-variant-numeric:tabular-nums;color:var(--navy)}
.home-summary span{font-size:14px;line-height:1.5}.home-summary>a>span:last-child{font-size:13px;color:var(--ink-soft)}
.home-columns{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:40px;align-items:start}
.home-main,.home-aside{display:grid;gap:32px;min-width:0}
.home-section-heading{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin-bottom:18px}
.home-section h2{font:650 21px/1.3 var(--sans);letter-spacing:-.025em}
.home-section a,.home-text-action{color:var(--crimson-dark);font-size:14px;text-underline-offset:4px}
.home-section-heading>a{white-space:nowrap}
.home-empty{padding:24px;background:var(--surface-soft);border-radius:12px;font-size:15px;line-height:1.65;color:var(--ink-soft)}
.home-empty strong{display:block;color:var(--ink);margin-bottom:4px}.home-empty a,.home-empty button{display:inline-block;margin-top:12px}
.home-text-action{background:none;border:0;text-decoration:underline;cursor:pointer;padding:0;min-height:44px}
.home-list{list-style:none;margin:0;padding:0}.home-list li{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:18px 0;border-bottom:1px solid var(--line)}
.home-list li:first-child{padding-top:0}.home-list strong,.home-item-list a{font-size:16px;font-weight:600;color:var(--ink);overflow-wrap:anywhere}
.home-list p,.home-list time{font-size:14px;color:var(--ink-soft);line-height:1.55;margin-top:4px}.home-list li>a{flex-shrink:0;min-height:44px;display:inline-flex;align-items:center}
.home-discover{padding:28px;border-radius:16px;background:var(--navy);color:var(--on-dark)}
.home-discover img{object-fit:contain;margin-bottom:18px}.home-discover h2{font:500 28px/1.15 var(--display);letter-spacing:-.025em;max-width:22ch;color:inherit}
.home-discover p{font-size:15px;line-height:1.6;margin-top:14px;color:var(--on-dark-soft)}
.home-discover a{display:flex;justify-content:space-between;align-items:center;color:var(--on-dark);font-weight:600;font-size:14px;min-height:44px;margin-top:16px;text-underline-offset:5px}
.home-item-list li{justify-content:flex-start}.home-item-list img,.home-item-initial{width:56px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0;background:var(--surface-soft)}
.home-item-initial{display:grid;place-items:center;font:500 24px var(--display);color:var(--navy)}
@media(max-width:900px){.home-columns{grid-template-columns:1fr;gap:32px}.home-aside{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.home-summary>a{padding:0 20px}}
@media(max-width:640px){.home-workspace{padding-top:28px}.home-heading{align-items:flex-start;flex-direction:column;gap:18px;margin-bottom:24px}.home-heading h1{font-size:30px}.home-summary{grid-template-columns:1fr;padding:0 20px;margin-bottom:28px}.home-summary>a{display:grid;grid-template-columns:1fr auto;gap:4px 12px;padding:16px 0}.home-summary>a+a{border-left:0;border-top:1px solid var(--line)}.home-summary strong{grid-column:2;grid-row:1/3;font-size:28px;align-self:center}.home-aside{grid-template-columns:1fr}.home-section h2{font-size:19px}.home-section-heading{flex-wrap:wrap;gap:8px}.home-list li{gap:12px}.home-discover{padding:24px}.home-discover h2{font-size:27px}}
</style>
