<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import MessageConversation from '../components/MessageConversation.vue'
import { apiRequest } from '../lib/api'
import { messageError, threadKey, threadQuery, useMessagesStore } from '../stores/messages'
import { useAuthStore } from '../stores/auth'
import type { MessageThread } from '../types'

const route = useRoute()
const router = useRouter()
const store = useMessagesStore()
const auth = useAuthStore()
const search = ref('')
const selected = ref<MessageThread | null>(null)
const opening = ref(false)
const openError = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const filtered = computed(() => store.threads.filter(thread => `${thread.item.title} ${thread.counterpart.name}`.toLocaleLowerCase('es').includes(search.value.trim().toLocaleLowerCase('es'))))
let revision = 0
let inboxTimer: ReturnType<typeof setInterval> | undefined

function select(thread: MessageThread) {
  store.clearNewMessageNotifications()
  void router.push({ name: 'messages', query: { [thread.kind === 'inquiry' ? 'conversation' : 'request']: thread.id } })
}
async function close() { await router.push({ name: 'messages' }); await nextTick(); searchInput.value?.focus() }
function shortDate(value: string) { return new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short' }).format(new Date(value)) }
async function openRoute() {
  const generation = ++revision
  openError.value = ''
  selected.value = null
  const itemId = typeof route.query.item === 'string' ? route.query.item : null
  const requestId = typeof route.query.request === 'string' ? route.query.request : null
  const conversationId = typeof route.query.conversation === 'string' ? route.query.conversation : null
  if (!itemId && !requestId && !conversationId) { opening.value = false; return }
  opening.value = true
  try {
    if (itemId) {
      const thread = await store.start(itemId)
      if (generation !== revision) return
      await router.replace({ name: 'messages', query: { conversation: thread.id } })
      return
    }
    const key = { kind: conversationId ? 'inquiry' as const : 'request' as const, id: (conversationId ?? requestId)! }
    const existing = store.threads.find(thread => threadKey(thread) === threadKey(key))
    const thread = existing ?? (await apiRequest<{ thread: MessageThread }>(`/api/messages?${threadQuery(key)}`)).thread
    if (generation !== revision) return
    selected.value = thread
    store.upsert(thread)
  } catch (error) { if (generation === revision) openError.value = messageError(error) }
  finally { if (generation === revision) opening.value = false }
}
watch(() => route.fullPath, () => {
  store.clearNewMessageNotifications()
  void openRoute()
}, { immediate: true })
watch(() => store.threads, threads => {
  if (selected.value) selected.value = threads.find(thread => threadKey(thread) === threadKey(selected.value!)) ?? selected.value
})
onMounted(() => {
  void store.load()
  inboxTimer = setInterval(() => { if (!document.hidden && !selected.value) void store.load() }, 20000)
})
onBeforeUnmount(() => { revision++; clearInterval(inboxTimer) })
</script>

<template>
  <div class="messages-page" :class="{'messages-page--selected':selected || opening}">
    <SiteHeader show-marketplace-nav />
    <main id="main-content" class="messages-workspace">
      <header class="messages-heading"><div><h1>Mensajes</h1><p>Pregunta por un objeto y coordina los detalles con su propietario.</p></div><router-link to="/catalogo">Explorar catálogo ↗</router-link></header>
      <div class="messages-layout">
        <aside class="messages-list" aria-label="Bandeja de conversaciones">
          <label class="messages-search"><span>Buscar conversación</span><input ref="searchInput" v-model="search" type="search" placeholder="Persona u objeto" /></label>
          <p v-if="store.isLoading && !store.threads.length" class="messages-state" role="status">Cargando conversaciones…</p>
          <div v-if="store.error" class="messages-state" role="alert"><p>{{ store.error }}</p><button type="button" @click="store.load()">Reintentar</button></div>
          <div v-else-if="!store.isLoading && !store.threads.length" class="messages-state"><strong>Tu próxima conversación empieza con un objeto.</strong><p>Usa “Preguntar al propietario” en el catálogo o “Conversar” en una solicitud.</p><router-link to="/catalogo">Buscar un objeto ↗</router-link></div>
          <p v-else-if="!filtered.length && !store.isLoading" class="messages-state">No hay coincidencias en las conversaciones cargadas.</p>
          <ul v-if="filtered.length"><li v-for="thread in filtered" :key="threadKey(thread)"><button type="button" class="messages-thread" :class="{'is-selected':selected && threadKey(selected)===threadKey(thread)}" :aria-current="selected && threadKey(selected)===threadKey(thread) ? 'true' : undefined" @click="select(thread)"><img v-if="thread.item.photoUrl" :src="thread.item.photoUrl" alt="" loading="lazy" /><span v-else class="messages-initial" aria-hidden="true">{{ thread.item.title.charAt(0) }}</span><span class="messages-thread-info"><strong>{{ thread.counterpart.name }}</strong><span>{{ thread.item.title }}</span><span class="messages-preview">{{ thread.latestMessage ? `${thread.latestMessage.senderId === auth.user?.id ? 'Tú: ' : ''}${thread.latestMessage.content}` : 'Sin mensajes todavía' }}</span><span class="messages-context">{{ thread.kind === 'inquiry' ? 'Consulta' : 'Solicitud' }} · {{ shortDate(thread.updatedAt) }}</span></span></button></li></ul>
          <button v-if="store.hasMore" type="button" class="messages-more" :disabled="store.isLoading" @click="store.load(true)">{{ store.isLoading ? 'Cargando…' : 'Cargar más conversaciones' }}</button>
        </aside>
        <div class="messages-detail">
          <div v-if="opening" class="messages-empty" role="status"><p>Abriendo conversación…</p><button type="button" @click="close">Volver a la bandeja</button></div>
          <div v-else-if="openError" class="messages-empty" role="alert"><p>{{ openError }}</p><button type="button" @click="openRoute">Reintentar</button><button type="button" @click="close">Volver a la bandeja</button></div>
          <MessageConversation v-else-if="selected" :key="threadKey(selected)" :thread="selected" @back="close" />
          <div v-else class="messages-empty"><span class="messages-empty-mark" aria-hidden="true">↔</span><h2>Un lugar para ponerse de acuerdo.</h2><p>Selecciona una conversación para preguntar, revisar condiciones o coordinar la entrega en el campus.</p></div>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.messages-page{display:flex;flex-direction:column;min-height:100dvh}
.messages-workspace{display:flex;flex:1;flex-direction:column;min-height:0;width:100%;max-width:1760px;margin:0 auto;padding:24px clamp(24px,3.2vw,64px) 28px}
.messages-heading{display:flex;justify-content:space-between;align-items:center;gap:24px;flex-shrink:0;margin-bottom:20px}
.messages-heading h1{font:550 36px/1.15 var(--display);letter-spacing:-.03em}
.messages-heading p{font-size:15px;color:var(--ink-soft);margin-top:10px;line-height:1.6}
.messages-heading>a{font-size:14px;color:var(--crimson-dark);white-space:nowrap}
/* Keep the inbox and conversation in one frame; the wider pane belongs to the active chat. */
.messages-layout{display:grid;flex:1;grid-template-columns:minmax(300px,360px) minmax(0,1fr);min-height:clamp(420px,calc(100dvh - 340px),560px);max-height:1100px;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--paper)}
.messages-list{border-right:1px solid var(--line);overflow-y:auto;min-width:0;scrollbar-width:thin;background:var(--paper)}
.messages-list ul{list-style:none;margin:0;padding:0}
.messages-search{display:block;padding:20px}
.messages-search>span{display:block;font-size:13px;font-weight:600;margin-bottom:8px}
.messages-search input{width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--line-strong);border-radius:10px;color:var(--ink);background:var(--paper);font:400 16px var(--sans)}
.messages-thread{display:flex;align-items:flex-start;gap:12px;padding:18px 20px;width:100%;border:0;border-bottom:1px solid var(--line);background:transparent;text-align:left;color:var(--ink);font-family:var(--sans);cursor:pointer;transition:background 150ms ease}
.messages-thread:hover,.messages-thread.is-selected{background:var(--surface-soft)}
.messages-thread>img,.messages-initial{width:44px;height:44px;object-fit:cover;flex-shrink:0;border-radius:8px;background:var(--surface-soft)}
.messages-initial{display:grid;place-items:center;font:500 24px var(--display);color:var(--navy)}
.messages-thread-info{display:flex;flex-direction:column;min-width:0;gap:5px}
.messages-thread-info>strong{font-size:15px;line-height:1.4;overflow-wrap:anywhere}
.messages-thread-info>span{font-size:14px;line-height:1.4}
.messages-thread-info>.messages-preview{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink-soft);max-width:100%}
.messages-thread-info>.messages-context{font-size:12px;color:var(--ink-soft)}
.messages-detail{min-width:0;min-height:0}
.messages-state{padding:20px;font-size:14px;line-height:1.65;color:var(--ink-soft)}
.messages-state p{margin-top:10px}
.messages-state a,.messages-state button,.messages-more,.messages-empty button{color:var(--crimson-dark);font-size:14px;min-height:44px;background:none;border:0;text-decoration:underline;cursor:pointer}
.messages-state a{display:inline-flex;align-items:center}
.messages-more{display:block;margin:12px auto;padding:8px 16px}
.messages-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;height:100%;padding:36px;color:var(--ink-soft);gap:16px}
.messages-empty h2{font:500 30px/1.15 var(--display);max-width:22ch;color:var(--ink)}
.messages-empty p{max-width:42ch;font-size:15px;line-height:1.7}
.messages-empty-mark{font:500 44px var(--display);color:var(--navy)}
@media(max-width:1050px){.messages-layout{grid-template-columns:280px minmax(0,1fr)}}
@media(min-width:1600px){.messages-layout{grid-template-columns:380px minmax(0,1fr)}}
@media(max-width:760px){.messages-workspace{padding:24px 18px 40px}.messages-heading{align-items:flex-start;flex-direction:column;gap:14px}.messages-heading h1{font-size:30px}.messages-layout{display:block;flex:none;height:auto;min-height:400px}.messages-list{border:0;overflow:visible}.messages-detail{display:none}.messages-page--selected .messages-heading,.messages-page--selected .messages-list,.messages-page--selected :deep(.site-footer){display:none}.messages-page--selected .messages-workspace{padding:0}.messages-page--selected .messages-layout{height:calc(100dvh - 70px);min-height:400px;border:0;border-radius:0}.messages-page--selected .messages-detail{display:block;height:100%}}
@media(prefers-reduced-motion:reduce){.messages-thread{transition:none}}
</style>
