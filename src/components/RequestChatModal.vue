<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import LoadingState from './LoadingState.vue'
import { apiRequest } from '../lib/api'
import { getSupabaseClient } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import type { ChatMessage, LoanRequest, MessagesResponse, SendMessageResponse } from '../types'

const props = defineProps<{
  request: LoanRequest
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const authStore = useAuthStore()

const messages = ref<ChatMessage[]>([])
const isLoading = ref(true)
const fetchError = ref<string | null>(null)
const inputText = ref('')
const isSending = ref(false)
const sendError = ref<string | null>(null)

const messagesContainerRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const dialogRef = ref<HTMLElement | null>(null)

let activeChannel: RealtimeChannel | null = null

const isChatOpen = computed(() => {
  return (
    props.request.status === 'PENDING' ||
    props.request.status === 'APPROVED' ||
    props.request.loan?.status === 'ACTIVE'
  )
})

const counterparty = computed(() => {
  if (props.request.isOwner) {
    return {
      name: props.request.requester.name || props.request.requester.email,
      roleLabel: 'Solicitante',
    }
  }
  return {
    name: props.request.item.owner.name || props.request.item.owner.email,
    roleLabel: 'Propietario',
  }
})

const closedNotice = computed(() => {
  if (props.request.loan?.status === 'RETURNED') {
    return 'El objeto fue devuelto y el préstamo finalizó. Esta conversación está en modo solo lectura.'
  }
  if (props.request.status === 'REJECTED') {
    return 'La solicitud fue rechazada. Esta conversación está en modo solo lectura.'
  }
  if (props.request.status === 'CANCELLED') {
    return 'La solicitud fue cancelada. Esta conversación está en modo solo lectura.'
  }
  if (props.request.status === 'EXPIRED') {
    return 'La solicitud ha expirado. Esta conversación está en modo solo lectura.'
  }
  return 'Esta conversación está cerrada. Solo se permite enviar mensajes en solicitudes pendientes, aprobadas o préstamos activos.'
})

function formatMessageTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return ''

    const now = new Date()
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()

    const timeFormatter = new Intl.DateTimeFormat('es-VE', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    if (isToday) {
      return timeFormatter.format(date)
    }

    const dateFormatter = new Intl.DateTimeFormat('es-VE', {
      day: 'numeric',
      month: 'short',
    })
    return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`
  } catch {
    return ''
  }
}

function getSenderLabel(senderId: string): string {
  if (authStore.user?.id && senderId === authStore.user.id) {
    return 'Tú'
  }
  if (senderId === props.request.requester.id) {
    return `${props.request.requester.name || props.request.requester.email} (Solicitante)`
  }
  if (senderId === props.request.item.owner.id) {
    return `${props.request.item.owner.name || props.request.item.owner.email} (Propietario)`
  }
  return 'Usuario'
}

function scrollToBottom() {
  void nextTick(() => {
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
    }
  })
}

function addMessage(msg: ChatMessage) {
  if (!msg || !msg.id) return
  const alreadyExists = messages.value.some((item) => item.id === msg.id)
  if (!alreadyExists) {
    messages.value.push(msg)
    messages.value.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    scrollToBottom()
  }
}

async function loadHistory() {
  isLoading.value = true
  fetchError.value = null

  try {
    const res = await apiRequest<MessagesResponse>(
      `/api/messages?requestId=${encodeURIComponent(props.request.id)}`,
    )
    if (res?.ok && Array.isArray(res.messages)) {
      for (const msg of res.messages) {
        addMessage(msg)
      }
    }
  } catch (err) {
    fetchError.value = err instanceof Error ? err.message : 'No se pudo cargar el historial de mensajes.'
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

async function setupRealtimeSubscription(requestId: string) {
  teardownRealtimeSubscription()

  try {
    const supabase = getSupabaseClient()

    // Setear JWT de sesión antes de suscribirse
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (token) {
      supabase.realtime.setAuth(token)
    }

    // Suscribirse con cliente Supabase a INSERT de tabla public.ChatMessage filtrado por requestId
    activeChannel = supabase
      .channel(`chat:request:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ChatMessage',
          filter: `requestId=eq.${requestId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          if (newMsg && newMsg.requestId === requestId) {
            addMessage(newMsg)
          }
        },
      )
      .subscribe((_status, err) => {
        if (err) {
          console.warn('Fallo en la suscripción Realtime del chat:', err)
        }
      })
  } catch (err) {
    console.warn('Error al iniciar suscripción Realtime del chat:', err)
  }
}

function teardownRealtimeSubscription() {
  if (activeChannel) {
    try {
      const supabase = getSupabaseClient()
      void supabase.removeChannel(activeChannel)
    } catch {
      // Ignorar errores al limpiar el canal
    }
    activeChannel = null
  }
}

async function sendMessage() {
  const content = inputText.value.trim()
  if (!content || !isChatOpen.value || isSending.value) {
    return
  }

  if (content.length > 2000) {
    sendError.value = 'El mensaje no puede exceder 2000 caracteres.'
    return
  }

  isSending.value = true
  sendError.value = null

  try {
    const res = await apiRequest<SendMessageResponse>('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        requestId: props.request.id,
        content,
      }),
    })

    if (res?.message) {
      addMessage(res.message)
    }
    inputText.value = ''
    scrollToBottom()
    nextTick(() => {
      textareaRef.value?.focus()
    })
  } catch (err) {
    sendError.value = err instanceof Error ? err.message : 'No se pudo enviar el mensaje.'
  } finally {
    isSending.value = false
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

watch(
  () => props.request.id,
  async (newId, oldId) => {
    if (newId !== oldId) {
      messages.value = []
      inputText.value = ''
      sendError.value = null
      teardownRealtimeSubscription()
      if (newId) {
        await setupRealtimeSubscription(newId)
        await loadHistory()
      }
    }
  },
)

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  await setupRealtimeSubscription(props.request.id)
  await loadHistory()
  nextTick(() => {
    if (isChatOpen.value && textareaRef.value) {
      textareaRef.value.focus()
    } else if (dialogRef.value) {
      dialogRef.value.focus()
    }
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  teardownRealtimeSubscription()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="chat-modal-fade">
      <div class="chat-overlay" @click.self="$emit('close')">
        <section
          ref="dialogRef"
          class="chat-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-dialog-title"
          tabindex="-1"
        >
          <!-- Header -->
          <header class="chat-header">
            <div class="chat-header__info">
              <span class="chat-header__icon" aria-hidden="true">{{ request.item.categoryIcon || '💬' }}</span>
              <div class="chat-header__titles">
                <p class="chat-header__eyebrow">
                  {{ counterparty.roleLabel }}: <strong>{{ counterparty.name }}</strong>
                </p>
                <h2 id="chat-dialog-title" class="chat-header__title">
                  {{ request.item.title }}
                </h2>
                <div class="chat-header__meta">
                  <span class="chat-header__code">{{ request.item.code }}</span>
                  <span class="chat-status-pill" :class="`chat-status-pill--${request.status.toLowerCase()}`">
                    {{ request.status }}
                  </span>
                  <span v-if="request.loan" class="chat-status-pill chat-status-pill--loan">
                    Préstamo {{ request.loan.status.toLowerCase() }}
                  </span>
                </div>
              </div>
            </div>

            <button
              class="chat-close-btn"
              type="button"
              aria-label="Cerrar ventana de conversación"
              title="Cerrar conversación (Esc)"
              @click="$emit('close')"
            >
              ×
            </button>
          </header>

          <!-- Chat body / Messages -->
          <main
            ref="messagesContainerRef"
            class="chat-messages-container"
            role="log"
            aria-live="polite"
            aria-label="Historial de mensajes de la solicitud"
          >
            <!-- Loading state -->
            <div v-if="isLoading" class="chat-state-box chat-state-box--loading">
              <LoadingState label="Cargando mensajes…" />
            </div>

            <!-- Error state -->
            <div v-else-if="fetchError" class="chat-state-box chat-state-box--error" role="alert">
              <span class="chat-state-icon" aria-hidden="true">⚠️</span>
              <p class="chat-state-title">No pudimos cargar los mensajes</p>
              <p class="chat-state-desc">{{ fetchError }}</p>
              <button class="btn btn--small btn--ghost" type="button" @click="loadHistory">
                Reintentar carga
              </button>
            </div>

            <!-- Empty state -->
            <div v-else-if="!messages.length" class="chat-state-box chat-state-box--empty">
              <span class="chat-state-icon" aria-hidden="true">💬</span>
              <p class="chat-state-title">Aún no hay mensajes</p>
              <p class="chat-state-desc">
                {{
                  isChatOpen
                    ? 'Inicia la conversación para coordinar el punto de entrega o resolver cualquier duda sobre el objeto.'
                    : 'No se intercambiaron mensajes en esta solicitud.'
                }}
              </p>
            </div>

            <!-- Messages list -->
            <ul v-else class="chat-list">
              <li
                v-for="msg in messages"
                :key="msg.id"
                class="chat-bubble-row"
                :class="{
                  'chat-bubble-row--mine': authStore.user?.id && msg.senderId === authStore.user.id,
                  'chat-bubble-row--theirs': !authStore.user?.id || msg.senderId !== authStore.user.id,
                }"
              >
                <div class="chat-bubble">
                  <header class="chat-bubble__meta">
                    <span class="chat-bubble__sender">{{ getSenderLabel(msg.senderId) }}</span>
                    <time class="chat-bubble__time" :datetime="msg.createdAt">
                      {{ formatMessageTime(msg.createdAt) }}
                    </time>
                  </header>
                  <p class="chat-bubble__content">{{ msg.content }}</p>
                </div>
              </li>
            </ul>
          </main>

          <!-- Footer / Input bar or Closed notification -->
          <footer class="chat-footer">
            <!-- Closed chat notification -->
            <div v-if="!isChatOpen" class="chat-closed-notice" role="status">
              <span class="chat-closed-notice__icon" aria-hidden="true">🔒</span>
              <div class="chat-closed-notice__body">
                <strong>Conversación cerrada</strong>
                <p>{{ closedNotice }}</p>
              </div>
            </div>

            <!-- Active chat composer -->
            <form v-else class="chat-composer" @submit.prevent="sendMessage">
              <div v-if="sendError" class="chat-send-error" role="alert">
                <span>{{ sendError }}</span>
                <button type="button" class="chat-send-error__close" @click="sendError = null" aria-label="Descartar aviso">×</button>
              </div>

              <div class="chat-input-wrapper">
                <textarea
                  ref="textareaRef"
                  v-model="inputText"
                  class="chat-textarea"
                  rows="2"
                  maxlength="2000"
                  aria-label="Escribe tu mensaje para coordinar la solicitud"
                  placeholder="Escribe un mensaje… (Presiona Enter para enviar, Shift+Enter para salto de línea)"
                  :disabled="isSending"
                  @keydown.enter.exact.prevent="sendMessage"
                ></textarea>
              </div>

              <div class="chat-composer__bar">
                <span
                  class="chat-char-counter"
                  :class="{ 'chat-char-counter--warning': inputText.length >= 1900 }"
                  aria-live="polite"
                >
                  {{ inputText.length }}/2000
                </span>

                <button
                  class="btn btn--primary btn--small chat-submit-btn"
                  type="submit"
                  :disabled="isSending || !inputText.trim() || inputText.length > 2000"
                >
                  {{ isSending ? 'Enviando…' : 'Enviar mensaje' }}
                </button>
              </div>
            </form>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.chat-overlay {
  position: fixed;
  inset: 0;
  z-index: 250;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: color-mix(in srgb, var(--navy) 60%, transparent);
  backdrop-filter: blur(5px);
}

.chat-dialog {
  display: flex;
  flex-direction: column;
  width: min(100%, 640px);
  height: min(88vh, 680px);
  border-radius: 20px;
  background: var(--paper);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  overflow: hidden;
  outline: none;
}

/* Header */
.chat-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--line);
  background: var(--paper-2);
}

.chat-header__info {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}

.chat-header__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  border-radius: 12px;
  background: var(--crimson-bg);
  font-size: 22px;
}

.chat-header__titles {
  min-width: 0;
}

.chat-header__eyebrow {
  margin: 0 0 2px;
  color: var(--ink-faint);
  font-size: 12px;
  line-height: 1.3;
}

.chat-header__eyebrow strong {
  color: var(--ink);
}

.chat-header__title {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-header__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.chat-header__code {
  color: var(--ink-faint);
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.05em;
}

.chat-status-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  font-family: var(--mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: var(--paper-3);
  color: var(--ink-soft);
}

.chat-status-pill--pending {
  background: var(--gold-bg);
  color: var(--gold);
}

.chat-status-pill--approved {
  background: var(--navy-bg);
  color: var(--navy-2);
}

.chat-status-pill--rejected,
.chat-status-pill--cancelled {
  background: var(--crimson-bg);
  color: var(--crimson-dark);
}

.chat-status-pill--loan {
  border: 1px solid var(--gold);
  background: transparent;
  color: var(--gold);
}

.chat-close-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ink-faint);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.chat-close-btn:hover {
  background: var(--line);
  color: var(--ink);
}

/* Messages area */
.chat-messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  background:
    radial-gradient(circle at 95% 5%, var(--gold-bg), transparent 30%),
    var(--paper);
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}

.chat-messages-container::-webkit-scrollbar {
  width: 7px;
}

.chat-messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages-container::-webkit-scrollbar-thumb {
  background: var(--line-strong);
  border-radius: 999px;
}

.chat-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chat-bubble-row {
  display: flex;
  width: 100%;
}

.chat-bubble-row--mine {
  justify-content: flex-end;
}

.chat-bubble-row--theirs {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 82%;
  min-width: 140px;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.45;
  word-break: break-word;
}

.chat-bubble-row--mine .chat-bubble {
  background: var(--crimson);
  color: var(--on-dark);
  border-bottom-right-radius: 3px;
  box-shadow: var(--shadow-soft);
}

.chat-bubble-row--theirs .chat-bubble {
  background: var(--paper-2);
  color: var(--ink);
  border: 1px solid var(--line);
  border-bottom-left-radius: 3px;
}

.chat-bubble__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
  font-size: 11px;
}

.chat-bubble-row--mine .chat-bubble__sender {
  color: var(--on-dark);
  font-weight: 700;
  font-family: var(--sans);
}

.chat-bubble-row--theirs .chat-bubble__sender {
  color: var(--crimson-dark);
  font-weight: 700;
  font-family: var(--sans);
}

.chat-bubble__time {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.02em;
  opacity: 0.82;
  white-space: nowrap;
}

.chat-bubble__content {
  margin: 0;
  white-space: pre-wrap;
}

/* States */
.chat-state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 220px;
  padding: 30px;
  border-radius: 14px;
  border: 1px dashed var(--line-strong);
  background: color-mix(in srgb, var(--paper-2) 60%, transparent);
}

.chat-state-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.chat-state-title {
  color: var(--ink);
  font-family: var(--display);
  font-size: 18px;
  margin: 0 0 6px;
}

.chat-state-desc {
  color: var(--ink-faint);
  font-size: 13px;
  max-width: 36ch;
  margin-bottom: 12px;
}

.chat-state-box--error {
  border-color: var(--crimson);
}

.chat-state-box--error .chat-state-title {
  color: var(--crimson-dark);
}

/* Footer / Composer */
.chat-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--line);
  background: var(--paper-2);
}

.chat-closed-notice {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink-soft);
}

.chat-closed-notice__icon {
  font-size: 20px;
  flex: 0 0 auto;
}

.chat-closed-notice__body strong {
  display: block;
  font-size: 13px;
  color: var(--ink);
  margin-bottom: 2px;
}

.chat-closed-notice__body p {
  font-size: 12px;
  line-height: 1.4;
  color: var(--ink-faint);
}

.chat-composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-send-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--crimson-bg);
  border: 1px solid var(--crimson);
  color: var(--crimson-dark);
  font-size: 12px;
}

.chat-send-error__close {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
}

.chat-input-wrapper {
  position: relative;
}

.chat-textarea {
  width: 100%;
  resize: vertical;
  min-height: 52px;
  max-height: 140px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1.5px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 14px;
  line-height: 1.4;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.chat-textarea:focus {
  border-color: var(--crimson);
  box-shadow: 0 0 0 3px var(--crimson-bg);
}

.chat-composer__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chat-char-counter {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-faint);
}

.chat-char-counter--warning {
  color: var(--crimson);
  font-weight: 600;
}

.chat-submit-btn {
  cursor: pointer;
}

.chat-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

/* Animations */
.chat-modal-fade-enter-active,
.chat-modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.chat-modal-fade-enter-from,
.chat-modal-fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .chat-dialog {
    height: 94vh;
    border-radius: 16px;
  }

  .chat-header {
    padding: 14px 16px;
  }

  .chat-messages-container {
    padding: 14px 16px;
  }

  .chat-bubble {
    max-width: 90%;
  }

  .chat-footer {
    padding: 12px 14px;
  }
}
</style>
