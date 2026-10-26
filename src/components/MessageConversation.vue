<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { apiRequest } from '../lib/api'
import { getSupabaseClient } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { messageError, threadKey, threadQuery, useMessagesStore } from '../stores/messages'
import type { ChatMessage, MessageThread, MessagesResponse, SendMessageResponse } from '../types'

const props = defineProps<{ thread: MessageThread }>()
const emit = defineEmits<{ back: [] }>()
const auth = useAuthStore()
const store = useMessagesStore()
const messages = ref<ChatMessage[]>([])
const isLoading = ref(true)
const isLoadingOlder = ref(false)
const error = ref('')
const sendError = ref('')
const isSending = ref(false)
const live = ref(false)
const cursor = ref<string | null>(null)
const log = ref<HTMLElement | null>(null)
const title = ref<HTMLElement | null>(null)
const current = ref(props.thread)
const draft = computed({ get: () => store.drafts[threadKey(props.thread)] ?? '', set: value => { store.drafts[threadKey(props.thread)] = value } })
let channel: RealtimeChannel | null = null
let timer: ReturnType<typeof setInterval> | undefined
let disposed = false
let refreshing = false

function nearBottom() { return !log.value || log.value.scrollHeight - log.value.scrollTop - log.value.clientHeight < 100 }
async function bottom() { await nextTick(); if (log.value) log.value.scrollTop = log.value.scrollHeight }
function merge(incoming: ChatMessage[]) {
  messages.value = [...new Map([...messages.value, ...incoming].map(message => [message.id, message])).values()]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))
}
async function load(refresh = false) {
  if (refreshing) return
  refreshing = true
  if (!refresh) isLoading.value = true
  const follow = nearBottom()
  try {
    const response = await apiRequest<MessagesResponse & { thread: MessageThread }>(`/api/messages?${threadQuery(props.thread)}`)
    if (disposed) return
    current.value = response.thread
    store.upsert(response.thread)
    merge(response.messages)
    if (!refresh) cursor.value = response.nextCursor ?? null
    error.value = ''
    if (follow) await bottom()
  } catch (err) { if (!disposed) error.value = messageError(err) }
  finally { refreshing = false; if (!disposed) isLoading.value = false }
}
async function older() {
  if (!cursor.value || isLoadingOlder.value) return
  isLoadingOlder.value = true
  const height = log.value?.scrollHeight ?? 0
  try {
    const response = await apiRequest<MessagesResponse>(`/api/messages?${threadQuery(props.thread)}&before=${encodeURIComponent(cursor.value)}`)
    if (disposed) return
    merge(response.messages)
    cursor.value = response.nextCursor ?? null
    await nextTick()
    if (log.value) log.value.scrollTop += log.value.scrollHeight - height
  } catch (err) { error.value = messageError(err) } finally { isLoadingOlder.value = false }
}
async function send() {
  const content = draft.value.trim()
  if (!content || content.length > 2000 || isSending.value || !current.value.canSend) return
  isSending.value = true
  sendError.value = ''
  const original = draft.value
  try {
    const response = await apiRequest<SendMessageResponse>('/api/messages', { method: 'POST', body: JSON.stringify({ [props.thread.kind === 'inquiry' ? 'conversationId' : 'requestId']: props.thread.id, content }) })
    if (draft.value === original) draft.value = ''
    store.upsert({ ...current.value, latestMessage: response.message, updatedAt: response.message.createdAt })
    if (!disposed) { merge([response.message]); await bottom() }
  } catch (err) { if (!disposed) { sendError.value = messageError(err); void load(true) } }
  finally { isSending.value = false }
}
function time(value: string) { return new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) { event.preventDefault(); void send() }
}
async function subscribe() {
  const supabase = getSupabaseClient()
  const { data } = await supabase.auth.getSession()
  if (disposed) return
  if (data.session) await supabase.realtime.setAuth(data.session.access_token)
  if (disposed) return
  const field = props.thread.kind === 'inquiry' ? 'conversationId' : 'requestId'
  channel = supabase.channel(`inbox-${threadKey(props.thread)}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ChatMessage', filter: `${field}=eq.${props.thread.id}` }, () => { void load(true); void store.load() }).subscribe(status => {
    if (disposed) return
    live.value = status === 'SUBSCRIBED'
    if (live.value) void load(true)
  })
}
onMounted(() => {
  void nextTick(() => title.value?.focus({ preventScroll: true }))
  void load()
  void subscribe().catch(() => { live.value = false })
  timer = setInterval(() => { if (!document.hidden) { void load(true); void store.load() } }, 20000)
})
onBeforeUnmount(() => {
  disposed = true
  clearInterval(timer)
  if (channel) void getSupabaseClient().removeChannel(channel)
})
</script>

<template>
  <section class="conversation" aria-label="Conversación seleccionada">
    <header class="conversation-heading">
      <button type="button" class="conversation-back" @click="emit('back')">← Mensajes</button>
      <div class="conversation-person"><img v-if="current.counterpart.photo" :src="current.counterpart.photo" alt="" /><span v-else aria-hidden="true">{{ current.counterpart.name.charAt(0) }}</span><div><h2 ref="title" tabindex="-1">{{ current.counterpart.name }}</h2><p>{{ current.kind === 'inquiry' ? 'Consulta sobre un objeto' : 'Conversación de una solicitud' }}</p></div></div>
      <p class="conversation-connection" role="status">{{ live ? 'Actualizaciones en vivo' : 'Se actualiza automáticamente' }}</p>
    </header>
    <div class="conversation-object"><img v-if="current.item.photoUrl" :src="current.item.photoUrl" alt="" /><div><strong>{{ current.item.title }}</strong><p>{{ current.kind === 'inquiry' ? 'Preguntar no crea una solicitud de préstamo.' : 'Revisa las condiciones y fechas en tu solicitud.' }}</p></div><router-link :to="current.kind === 'request' ? {name:'requests'} : {name:'catalog',query:{search:current.item.title}}">{{ current.kind === 'request' ? 'Ver solicitud' : 'Ver objeto' }} ↗</router-link></div>
    <div ref="log" class="conversation-log" role="log" aria-label="Mensajes de la conversación" aria-relevant="additions text" :aria-busy="isLoading">
      <p v-if="isLoading" class="conversation-state" role="status">Cargando mensajes…</p>
      <div v-if="error" class="conversation-state" role="alert"><p>{{ error }}</p><button type="button" @click="load()">Reintentar</button></div>
      <button v-if="cursor" class="conversation-older" type="button" :disabled="isLoadingOlder" @click="older">{{ isLoadingOlder ? 'Cargando…' : 'Cargar mensajes anteriores' }}</button>
      <div v-if="!isLoading && !error && !messages.length" class="conversation-state"><strong>Empiecen por los detalles.</strong><p>Pregunta por el estado del objeto o acuerden un punto de entrega dentro del campus.</p></div>
      <article v-for="message in messages" :key="message.id" class="conversation-message" :class="{'conversation-message--mine':message.senderId===auth.user?.id}"><span>{{ message.senderId===auth.user?.id ? 'Tú' : current.counterpart.name }}</span><p>{{ message.content }}</p><time :datetime="message.createdAt">{{ time(message.createdAt) }}</time></article>
    </div>
    <form v-if="current.canSend" class="conversation-composer" @submit.prevent="send">
      <label :for="`message-${current.id}`">Tu mensaje</label>
      <textarea :id="`message-${current.id}`" v-model="draft" rows="2" maxlength="2000" placeholder="Escribe para preguntar o coordinar la entrega…" :aria-describedby="`message-hint-${current.id}`" @keydown="onKeydown" />
      <div><p :id="`message-hint-${current.id}`">{{ draft.length }}/2000 · Ctrl/⌘ + Enter para enviar</p><button class="btn btn--primary" type="submit" :disabled="!draft.trim() || isSending">{{ isSending ? 'Enviando…' : 'Enviar mensaje' }}</button></div>
      <p v-if="sendError" class="conversation-error" role="alert">{{ sendError }}</p>
    </form>
    <p v-else class="conversation-closed">Esta conversación está cerrada. Puedes leer su historial.</p>
  </section>
</template>

<style scoped>
.conversation{display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;background:var(--paper)}
.conversation-heading{padding:22px 24px 16px;border-bottom:1px solid var(--line)}
.conversation-person{display:flex;align-items:center;gap:12px}.conversation-person>img,.conversation-person>span{width:42px;height:42px;border-radius:50%;object-fit:cover;background:var(--surface-soft)}.conversation-person>span{display:grid;place-items:center;font:500 22px var(--display);color:var(--navy)}
.conversation-person h2{font:650 20px/1.3 var(--sans);overflow-wrap:anywhere}.conversation-person p,.conversation-connection{font-size:13px;color:var(--ink-soft);line-height:1.5}.conversation-connection{margin:8px 0 0 54px}.conversation-back{display:none}
.conversation-object{display:flex;align-items:center;gap:14px;padding:16px 24px;background:var(--surface-soft)}.conversation-object>img{width:48px;height:48px;border-radius:8px;object-fit:cover}.conversation-object>div{min-width:0;flex:1}.conversation-object strong{font-size:15px;overflow-wrap:anywhere}.conversation-object p{font-size:13px;line-height:1.5;color:var(--ink-soft);margin-top:4px}.conversation-object a{font-size:13px;color:var(--crimson-dark);min-height:44px;display:flex;align-items:center;white-space:nowrap}
.conversation-log{flex:1;overflow-y:auto;overscroll-behavior:contain;min-height:160px;padding:24px;display:flex;flex-direction:column;gap:16px;scrollbar-width:thin}.conversation-state{padding:20px;font-size:15px;line-height:1.65;color:var(--ink-soft);text-align:center;margin:auto}.conversation-state strong{color:var(--ink)}.conversation-state button,.conversation-older{min-height:44px;background:transparent;border:0;text-decoration:underline;color:var(--crimson-dark);cursor:pointer}.conversation-older{align-self:center;font-size:14px;flex-shrink:0}
.conversation-message{align-self:flex-start;max-width:85%;padding:12px 16px;background:var(--surface-soft);border-radius:12px;flex-shrink:0}.conversation-message--mine{align-self:flex-end;background:var(--navy-bg)}.conversation-message>span{display:block;font-size:12px;font-weight:600;color:var(--ink-soft);margin-bottom:6px}.conversation-message p{font-size:15px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}.conversation-message time{display:block;font-size:11px;color:var(--ink-soft);margin-top:8px}
.conversation-composer{padding:16px 24px 20px;border-top:1px solid var(--line)}.conversation-composer>label{display:block;font-size:14px;font-weight:600;margin-bottom:8px}.conversation-composer textarea{display:block;width:100%;resize:vertical;max-height:180px;min-height:76px;border:1px solid var(--line-strong);border-radius:10px;background:var(--paper);color:var(--ink);padding:12px;font:400 16px/1.5 var(--sans)}.conversation-composer>div{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:10px}.conversation-composer>div>p{font-size:12px;line-height:1.5;color:var(--ink-soft)}.conversation-error{font-size:14px;color:var(--crimson-dark);margin-top:10px}.conversation-closed{padding:20px 24px;background:var(--surface-soft);color:var(--ink-soft);font-size:14px;line-height:1.6}
@media(max-width:760px){.conversation-heading{padding:12px 18px}.conversation-back{display:block;background:none;border:0;min-height:44px;color:var(--crimson-dark);font:600 14px var(--sans);padding:0;margin-bottom:8px}.conversation-object{padding:14px 18px;flex-wrap:wrap}.conversation-object a{min-height:32px}.conversation-log{padding:18px}.conversation-message{max-width:94%}.conversation-composer{padding:14px 18px max(16px,env(safe-area-inset-bottom))}.conversation-composer>div{align-items:flex-end}.conversation-composer .btn{padding:10px 16px;font-size:13px}}
</style>

<style scoped>
.conversation-composer .btn{min-width:148px}
.conversation-composer .btn:disabled{background:var(--surface-soft);color:var(--ink-soft);cursor:not-allowed;transform:none}
.conversation-person>div{min-width:0}.conversation-person>img,.conversation-person>span{flex-shrink:0}
</style>
