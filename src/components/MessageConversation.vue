<script setup lang="ts">
import 'emoji-picker-element'
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
const composer = ref<HTMLTextAreaElement | null>(null)
const emojiControl = ref<HTMLDivElement | null>(null)
const emojiTrigger = ref<HTMLButtonElement | null>(null)
const emojiOpen = ref(false)
const counterpartPhotoFailed = ref(false)
const itemPhotoFailed = ref(false)
const current = ref(props.thread)
const draft = computed({
  get: () => store.drafts[threadKey(props.thread)] ?? '',
  set: value => { store.drafts[threadKey(props.thread)] = value },
})
let channel: RealtimeChannel | null = null
let timer: ReturnType<typeof setInterval> | undefined
let disposed = false
let refreshing = false

interface EmojiClickEvent extends Event { detail: { unicode?: string } }

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
  } catch (err) { error.value = messageError(err) }
  finally { isLoadingOlder.value = false }
}
async function send() {
  const content = draft.value.trim()
  if (!content || content.length > 2000 || isSending.value || !current.value.canSend) return
  isSending.value = true
  sendError.value = ''
  const original = draft.value
  try {
    const response = await apiRequest<SendMessageResponse>('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ [props.thread.kind === 'inquiry' ? 'conversationId' : 'requestId']: props.thread.id, content }),
    })
    if (draft.value === original) draft.value = ''
    store.upsert({ ...current.value, latestMessage: response.message, updatedAt: response.message.createdAt })
    if (!disposed) { merge([response.message]); await bottom() }
  } catch (err) { if (!disposed) { sendError.value = messageError(err); void load(true) } }
  finally { isSending.value = false }
}
function time(value: string) {
  return new Intl.DateTimeFormat('es-VE', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}
function dayKey(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}
function showDayLabel(index: number) {
  return index === 0 || dayKey(messages.value[index - 1]!.createdAt) !== dayKey(messages.value[index]!.createdAt)
}
function dayLabel(value: string) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()) return 'Hoy'
  if (date.getFullYear() === yesterday.getFullYear() && date.getMonth() === yesterday.getMonth() && date.getDate() === yesterday.getDate()) return 'Ayer'
  return new Intl.DateTimeFormat('es-VE', {
    weekday: 'long', day: 'numeric', month: 'long',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  }).format(date)
}
function showSender(index: number) {
  return index === 0 || messages.value[index - 1]!.senderId !== messages.value[index]!.senderId
}
function insertEmoji(event: Event) {
  const emoji = (event as EmojiClickEvent).detail?.unicode
  if (!emoji) return
  const field = composer.value
  const start = field?.selectionStart ?? draft.value.length
  const end = field?.selectionEnd ?? start
  draft.value = `${draft.value.slice(0, start)}${emoji}${draft.value.slice(end)}`
  const cursorAt = start + emoji.length
  emojiOpen.value = false
  void nextTick(() => {
    field?.focus()
    field?.setSelectionRange(cursorAt, cursorAt)
  })
}
function handleEmojiOutside(event: PointerEvent) {
  if (emojiOpen.value && emojiControl.value && !emojiControl.value.contains(event.target as Node)) emojiOpen.value = false
}
function handleEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !emojiOpen.value) return
  event.preventDefault()
  event.stopPropagation()
  emojiOpen.value = false
  emojiTrigger.value?.focus()
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void send() }
}
async function subscribe() {
  const supabase = getSupabaseClient()
  const { data } = await supabase.auth.getSession()
  if (disposed) return
  if (data.session) await supabase.realtime.setAuth(data.session.access_token)
  if (disposed) return
  const field = props.thread.kind === 'inquiry' ? 'conversationId' : 'requestId'
  channel = supabase.channel(`inbox-${threadKey(props.thread)}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'ChatMessage', filter: `${field}=eq.${props.thread.id}`,
    }, () => { void load(true); void store.load() })
    .subscribe(status => {
      if (disposed) return
      live.value = status === 'SUBSCRIBED'
      if (live.value) void load(true)
    })
}
onMounted(() => {
  document.addEventListener('pointerdown', handleEmojiOutside)
  document.addEventListener('keydown', handleEscape)
  void nextTick(() => title.value?.focus({ preventScroll: true }))
  void load()
  void subscribe().catch(() => { live.value = false })
  timer = setInterval(() => { if (!document.hidden) { void load(true); void store.load() } }, 20000)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleEmojiOutside)
  document.removeEventListener('keydown', handleEscape)
  disposed = true
  clearInterval(timer)
  if (channel) void getSupabaseClient().removeChannel(channel)
})
</script>

<template>
  <section class="conversation" aria-label="Conversación seleccionada">
    <header class="conversation-heading">
      <button class="conversation-back" type="button" @click="emit('back')">← Mensajes</button>
      <div class="conversation-person">
        <img v-if="current.counterpart.photo && !counterpartPhotoFailed" :src="current.counterpart.photo" alt="" @error="counterpartPhotoFailed = true" />
        <span v-else class="conversation-person__initial" aria-hidden="true">{{ current.counterpart.name.charAt(0) }}</span>
        <div><h2 ref="title" tabindex="-1">{{ current.counterpart.name }}</h2><p>{{ current.kind === 'inquiry' ? 'Consulta sobre un objeto' : 'Conversación de una solicitud' }}</p></div>
      </div>
      <span class="conversation-live" :class="{ 'conversation-live--online': live }"><i aria-hidden="true"></i>{{ live ? 'En vivo' : 'Reconectando' }}</span>
    </header>

    <div class="conversation-object">
      <img v-if="current.item.photoUrl && !itemPhotoFailed" :src="current.item.photoUrl" alt="" @error="itemPhotoFailed = true" />
      <span v-else class="conversation-object__fallback" aria-hidden="true">{{ current.item.title.charAt(0) }}</span>
      <div><span class="conversation-object__eyebrow">{{ current.kind === 'inquiry' ? 'Consulta de objeto' : 'Solicitud de préstamo' }}</span><strong>{{ current.item.title }}</strong><p>{{ current.kind === 'inquiry' ? 'Pregunta por disponibilidad y coordina detalles.' : 'Coordina aquí las condiciones y la entrega.' }}</p></div>
      <router-link :to="current.kind === 'request' ? { name: 'requests' } : { name: 'catalog', query: { search: current.item.title } }">{{ current.kind === 'request' ? 'Ver solicitud' : 'Ver objeto' }} <span aria-hidden="true">↗</span></router-link>
    </div>

    <div ref="log" class="conversation-log" role="log" aria-label="Mensajes de la conversación" aria-relevant="additions text" :aria-busy="isLoading">
      <p v-if="isLoading && !messages.length" class="conversation-state" role="status">Cargando mensajes…</p>
      <div v-if="error" class="conversation-state conversation-state--error" role="alert"><p>{{ error }}</p><button type="button" @click="load()">Reintentar</button></div>
      <button v-if="cursor" class="conversation-older" type="button" :disabled="isLoadingOlder" @click="older">{{ isLoadingOlder ? 'Cargando…' : 'Cargar mensajes anteriores' }}</button>
      <div v-if="!isLoading && !error && !messages.length" class="conversation-empty"><span aria-hidden="true">↔</span><strong>Un lugar para ponerse de acuerdo.</strong><p>Pregunta por el estado del objeto o coordinen el punto de entrega en el campus.</p></div>
      <template v-for="(message, index) in messages" :key="message.id">
        <div v-if="showDayLabel(index)" class="conversation-day"><span>{{ dayLabel(message.createdAt) }}</span></div>
        <article class="conversation-message" :class="{ 'conversation-message--mine': message.senderId === auth.user?.id, 'conversation-message--grouped': !showSender(index) }">
          <span v-if="showSender(index) && message.senderId !== auth.user?.id" class="conversation-message__sender">{{ current.counterpart.name }}</span>
          <p>{{ message.content }}</p><time :datetime="message.createdAt">{{ time(message.createdAt) }}</time>
        </article>
      </template>
    </div>

    <form v-if="current.canSend" class="conversation-composer" @submit.prevent="send">
      <div ref="emojiControl" class="conversation-composer__tools">
        <label :for="`message-${current.id}`">Tu mensaje</label>
        <div class="conversation-composer__editor">
          <textarea :id="`message-${current.id}`" ref="composer" v-model="draft" rows="2" maxlength="2000" placeholder="Escribe para preguntar o coordinar la entrega…" :aria-describedby="`message-hint-${current.id}`" @keydown="onKeydown" />
          <div v-if="emojiOpen" class="conversation-emoji-popover"><emoji-picker class="conversation-emoji-picker" @emoji-click="insertEmoji" /></div>
          <button ref="emojiTrigger" class="conversation-emoji-trigger" type="button" :aria-label="emojiOpen ? 'Cerrar selector de emojis' : 'Insertar emoji'" :aria-expanded="emojiOpen" aria-haspopup="dialog" @click="emojiOpen = !emojiOpen"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5s1.2 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01" /></svg></button>
        </div>
      </div>
      <div class="conversation-composer__footer"><p :id="`message-hint-${current.id}`">{{ draft.length }}/2000 <span>·</span> Enter para enviar <span>·</span> Shift + Enter para nueva línea</p><button class="btn btn--primary" type="submit" :disabled="!draft.trim() || isSending">{{ isSending ? 'Enviando…' : 'Enviar mensaje' }} <span aria-hidden="true">↗</span></button></div>
      <p v-if="sendError" class="conversation-error" role="alert">{{ sendError }}</p>
    </form>
    <p v-else class="conversation-closed">Esta conversación está cerrada. Puedes leer su historial.</p>
  </section>
</template>

<style scoped>
.conversation{display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;background:var(--paper)}
.conversation-heading{display:flex;align-items:center;gap:14px;padding:20px 24px;border-bottom:1px solid var(--line)}
.conversation-person{display:flex;align-items:center;gap:12px;min-width:0;flex:1}.conversation-person>img,.conversation-person__initial{width:42px;height:42px;border-radius:50%;object-fit:cover;background:var(--navy-bg);flex:none}.conversation-person__initial{display:grid;place-items:center;font:500 20px var(--display);color:var(--navy)}.conversation-person>div{min-width:0}.conversation-person h2{font:600 17px/1.3 var(--sans);overflow-wrap:anywhere}.conversation-person p{margin-top:3px;font-size:12px;color:var(--ink-soft)}
.conversation-live{display:inline-flex;align-items:center;gap:7px;flex:none;color:var(--ink-soft);font-size:11px}.conversation-live i{width:7px;height:7px;border-radius:50%;background:var(--gold)}.conversation-live--online i{background:var(--navy)}.conversation-back{display:none}
.conversation-object{display:flex;align-items:center;gap:12px;padding:13px 24px;background:var(--paper-2);border-bottom:1px solid var(--line)}.conversation-object>img,.conversation-object__fallback{width:44px;height:44px;border-radius:9px;object-fit:cover;background:var(--navy-bg);flex:none}.conversation-object__fallback{display:grid;place-items:center;color:var(--navy);font:500 20px var(--display)}.conversation-object>div{display:grid;gap:3px;min-width:0;flex:1}.conversation-object__eyebrow{color:var(--ink-soft);font:500 9px var(--mono);letter-spacing:.07em;text-transform:uppercase}.conversation-object strong{font-size:13px;overflow-wrap:anywhere}.conversation-object p{font-size:11px;line-height:1.45;color:var(--ink-soft)}.conversation-object a{display:flex;align-items:center;gap:5px;min-height:40px;color:var(--navy);font-size:12px;font-weight:600;white-space:nowrap}
.conversation-log{flex:1;overflow-y:auto;overscroll-behavior:contain;min-height:180px;padding:24px clamp(16px,4vw,46px);display:flex;flex-direction:column;gap:6px;scrollbar-width:thin}.conversation-state{margin:auto;padding:18px;color:var(--ink-soft);text-align:center}.conversation-state--error button,.conversation-older{min-height:44px;background:transparent;border:0;text-decoration:underline;color:var(--navy);cursor:pointer}.conversation-older{align-self:center;flex:none;font-size:13px}.conversation-empty{display:grid;justify-items:center;gap:10px;max-width:340px;margin:auto;text-align:center}.conversation-empty>span{color:var(--navy);font-size:30px}.conversation-empty strong{font:500 22px/1.2 var(--display)}.conversation-empty p{font-size:13px;line-height:1.6;color:var(--ink-soft)}.conversation-day{display:flex;justify-content:center;margin:16px 0 10px}.conversation-day span{padding:5px 11px;border:1px solid var(--line);border-radius:999px;background:var(--paper);color:var(--ink-soft);font-size:10px}
.conversation-message{align-self:flex-start;max-width:min(78%,540px);padding:10px 13px 8px;background:var(--paper-2);border:1px solid var(--line);border-radius:15px 15px 15px 5px;flex:none}.conversation-message--mine{align-self:flex-end;background:var(--navy-bg);border-color:transparent;border-radius:15px 15px 5px 15px}.conversation-message--grouped{margin-top:1px}.conversation-message__sender{display:block;margin-bottom:4px;color:var(--navy);font-size:11px;font-weight:700}.conversation-message p{font-size:14px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.conversation-message time{display:block;margin-top:5px;color:var(--ink-soft);font:400 9px var(--mono);text-align:right}
.conversation-composer{padding:15px 24px 18px;border-top:1px solid var(--line);background:var(--paper)}.conversation-composer__tools>label{display:block;margin-bottom:7px;font-size:12px;font-weight:600}.conversation-composer__editor{position:relative}.conversation-composer textarea{box-sizing:border-box;display:block;width:100%;resize:vertical;max-height:180px;min-height:72px;padding:12px 48px 12px 13px;border:1px solid var(--line-strong);border-radius:12px;background:var(--paper);color:var(--ink);font:400 14px/1.5 var(--sans)}.conversation-emoji-trigger{position:absolute;right:8px;bottom:8px;display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--line);border-radius:50%;background:var(--paper-2);color:var(--navy);font-size:21px;cursor:pointer}.conversation-emoji-popover{position:absolute;right:0;bottom:50px;z-index:5;overflow:hidden;border:1px solid var(--line-strong);border-radius:14px;box-shadow:var(--shadow)}.conversation-emoji-picker{width:min(350px,calc(100vw - 48px));height:390px;--background:var(--paper);--border-color:var(--line);--indicator-color:var(--navy);--input-border-color:var(--line-strong);--input-font-color:var(--ink);--input-placeholder-color:var(--ink-soft);--outline-color:var(--navy)}.conversation-composer__footer{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-top:9px}.conversation-composer__footer p{font-size:10px;line-height:1.5;color:var(--ink-soft)}.conversation-composer__footer p span{margin:0 3px;color:var(--line-strong)}.conversation-composer .btn{min-width:140px}.conversation-composer .btn:disabled{background:var(--surface-soft);color:var(--ink-soft);cursor:not-allowed;transform:none}.conversation-error{margin-top:9px;color:var(--crimson-dark);font-size:13px}.conversation-closed{padding:18px 24px;background:var(--paper-2);color:var(--ink-soft);font-size:13px;line-height:1.6}
.conversation :is(button,a,textarea):focus-visible{outline:2px solid var(--navy);outline-offset:3px}
@media(max-width:760px){.conversation-heading{padding:10px 16px}.conversation-back{display:block;min-height:42px;padding:0 10px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--navy);font:600 12px var(--sans)}.conversation-live{font-size:0}.conversation-live i{width:9px;height:9px}.conversation-object{padding:11px 16px;align-items:flex-start;flex-wrap:wrap}.conversation-object>div{padding-top:2px}.conversation-object a{margin-left:56px;min-height:30px}.conversation-log{padding:16px}.conversation-message{max-width:88%}.conversation-composer{padding:12px 16px max(14px,env(safe-area-inset-bottom))}.conversation-composer__footer{align-items:flex-end}.conversation-composer__footer p{max-width:58%}.conversation-composer .btn{min-width:0;padding:10px 13px;font-size:12px}}
@media(max-width:420px){.conversation-person>img,.conversation-person__initial{width:36px;height:36px}.conversation-person h2{font-size:14px}.conversation-person p{font-size:10px}.conversation-composer__footer p{font-size:9px}.conversation-composer .btn{padding:9px 10px}}
@media(prefers-reduced-motion:reduce){.conversation *{scroll-behavior:auto}}

/* Keep the composer stretched inside the conversation grid at every viewport. */
.conversation{width:100%;align-self:stretch}
.conversation-heading{display:flex;flex-wrap:nowrap;justify-content:space-between;width:100%;box-sizing:border-box}
.conversation-person{flex:1 1 auto}
.conversation-live{flex:0 0 auto;margin-left:auto}
.conversation-object{display:flex;align-items:center;width:100%;box-sizing:border-box}
.conversation-object>div{display:grid;grid-template-columns:minmax(0,1fr);align-content:center;gap:4px;min-width:0}
.conversation-object strong{display:block;line-height:1.35}
.conversation-composer{display:grid;grid-template-columns:minmax(0,1fr);align-self:stretch;flex:0 0 auto;width:100%;max-width:100%;min-width:0;box-sizing:border-box}
.conversation-composer__tools,.conversation-composer__editor,.conversation-composer__footer{width:100%;max-width:100%;min-width:0;box-sizing:border-box}
.conversation-composer__tools{display:block}
.conversation-composer__editor{display:block;position:relative}
.conversation-composer textarea{width:100%;max-width:100%;min-width:0;min-height:84px;box-sizing:border-box;padding:12px 54px 12px 14px}
.conversation-emoji-trigger{appearance:none;-webkit-appearance:none;position:absolute;right:8px;bottom:8px;z-index:1;display:grid;place-items:center;width:44px;height:44px;min-width:44px;min-height:44px;padding:0;border:1px solid var(--line);border-radius:50%;background:var(--paper-2);color:var(--navy);cursor:pointer;transition:background-color 140ms ease,transform 140ms var(--ease-out)}
.conversation-emoji-trigger svg{width:21px;height:21px;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.conversation-emoji-trigger:hover{background:var(--paper-3)}
.conversation-emoji-trigger:active{transform:scale(.97)}
.conversation-composer__footer{align-items:center}
.conversation-composer__footer p{font-size:12px;line-height:1.5}
.conversation-composer .btn{min-height:44px}
@media(max-width:760px){.conversation-composer{padding:12px 16px max(14px,env(safe-area-inset-bottom))}.conversation-composer textarea{min-height:76px}.conversation-composer__footer{align-items:flex-end}.conversation-composer__footer p{max-width:58%;font-size:11px}.conversation-composer .btn{min-width:0;padding:10px 13px;font-size:12px}}
@media(max-width:420px){.conversation-composer__footer p{font-size:10px}.conversation-composer .btn{padding:9px 10px}}
@media(prefers-reduced-motion:reduce){.conversation-emoji-trigger{transition:none}.conversation-emoji-trigger:active{transform:none}}
</style>
