import { defineStore } from 'pinia'
import { apiRequest } from '../lib/api'
import type { MessageThread } from '../types'
let generation = 0

export function threadKey(thread: Pick<MessageThread, 'kind' | 'id'>) { return `${thread.kind}:${thread.id}` }
export function threadQuery(thread: Pick<MessageThread, 'kind' | 'id'>) { return `${thread.kind === 'inquiry' ? 'conversationId' : 'requestId'}=${encodeURIComponent(thread.id)}` }
export function messageError(error: unknown) {
  const code = error instanceof Error ? error.message : ''
  const errors: Record<string, string> = {
    OWN_ITEM: 'Esta publicación es tuya. Revisa las conversaciones que recibas en tu bandeja.',
    ITEM_NOT_AVAILABLE: 'Este objeto ya no está disponible para iniciar una consulta.',
    ITEM_NOT_FOUND: 'No encontramos esa publicación.',
    FORBIDDEN: 'No tienes acceso a esta conversación.',
    THREAD_NOT_FOUND: 'Esta conversación ya no está disponible.',
    REQUEST_NOT_FOUND: 'No encontramos la solicitud de esta conversación.',
    REQUEST_NOT_ACTIVE: 'La solicitud está cerrada. Puedes consultar su historial.',
    CONVERSATION_CLOSED: 'Esta conversación ya no permite enviar mensajes.',
    UNAUTHORIZED: 'Tu sesión no está disponible. Vuelve a iniciar sesión.',
    ADMIN_MARKETPLACE_FORBIDDEN: 'La cuenta administrativa no participa en préstamos ni conversaciones personales.',
  }
  return errors[code] ?? 'No pudimos completar la acción. Intenta de nuevo.'
}

export const useMessagesStore = defineStore('messages', {
  state: () => ({ threads: [] as MessageThread[], drafts: {} as Record<string, string>, newMessageIds: [] as string[], isLoading: false, error: '', page: 0, hasMore: false }),
  getters: {
    hasNewMessages: state => state.newMessageIds.length > 0,
  },
  actions: {
    markNewMessage(messageId: string) {
      if (this.newMessageIds.includes(messageId)) return false
      this.newMessageIds = [...this.newMessageIds.slice(-99), messageId]
      return true
    },
    clearNewMessageNotifications() {
      this.newMessageIds = []
    },
    async load(more = false) {
      if (this.isLoading) return
      this.isLoading = true
      const version = generation
      this.error = ''
      try {
        const page = more ? this.page + 1 : 0
        const response = await apiRequest<{ threads: MessageThread[]; hasMore: boolean }>(`/api/messages?view=inbox&page=${page}`)
        if (version !== generation) return
        const combined = more ? [...this.threads, ...response.threads] : response.threads
        this.threads = [...new Map(combined.map(thread => [threadKey(thread), thread])).values()]
        this.page = page
        this.hasMore = response.hasMore
      } catch (error) { if (version === generation) this.error = messageError(error) } finally { if (version === generation) this.isLoading = false }
    },
    async start(itemId: string) {
      const version = generation
      const response = await apiRequest<{ thread: MessageThread }>('/api/messages', { method: 'POST', body: JSON.stringify({ action: 'start', itemId }) })
      if (version !== generation) throw new Error('UNAUTHORIZED')
      this.upsert(response.thread)
      return response.thread
    },
    upsert(thread: MessageThread) {
      this.threads = [thread, ...this.threads.filter(existing => threadKey(existing) !== threadKey(thread))]
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    },
    clear() { generation++; this.$reset() },
  },
})
