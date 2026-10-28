import { onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { RealtimeChannel, RealtimePostgresInsertPayload } from '@supabase/supabase-js'
import { push } from 'notivue'
import { getSupabaseClient } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { threadKey, useMessagesStore } from '../stores/messages'
import type { ChatMessage, MessageThread } from '../types'

export function useMessageNotifications() {
  const route = useRoute()
  const auth = useAuthStore()
  const inbox = useMessagesStore()

  let channel: RealtimeChannel | null = null
  let subscriptionVersion = 0

  function removeChannel() {
    if (!channel) return
    void getSupabaseClient().removeChannel(channel)
    channel = null
  }

  function isViewingThread(message: ChatMessage) {
    if (route.name !== 'messages') return false
    const threadId = message.conversationId ?? message.requestId
    const routeThreadId = message.conversationId
      ? route.query.conversation
      : route.query.request
    return typeof routeThreadId === 'string' && routeThreadId === threadId
  }

  function findThread(message: ChatMessage): MessageThread | undefined {
    const thread = message.conversationId
      ? { kind: 'inquiry' as const, id: message.conversationId }
      : message.requestId
        ? { kind: 'request' as const, id: message.requestId }
        : null
    return thread ? inbox.threads.find(item => threadKey(item) === threadKey(thread)) : undefined
  }

  function onMessage(payload: RealtimePostgresInsertPayload<ChatMessage>) {
    const message = payload.new
    const userId = auth.user?.id
    if (!userId || message.senderId === userId) return

    void inbox.load()
    if (isViewingThread(message)) return

    const thread = findThread(message)
    const preview = message.content.trim().replace(/\s+/g, ' ')
    const snippet = preview.length > 100 ? `${preview.slice(0, 97)}…` : preview

    push.info({
      title: thread ? `Mensaje de ${thread.counterpart.name}` : 'Mensaje nuevo',
      message: thread ? `${thread.item.title} · ${snippet}` : snippet,
      duration: 8000,
      ariaLive: 'polite',
      ariaRole: 'status',
    })
  }

  async function subscribe(userId: string, version: number) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session || version !== subscriptionVersion) return

    await supabase.realtime.setAuth(data.session.access_token)
    if (version !== subscriptionVersion) return

    channel = supabase
      .channel(`message-notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ChatMessage',
      }, onMessage)
      .subscribe()
  }

  watch([() => auth.user?.id, () => auth.isAdmin], ([userId, isAdmin]) => {
    const version = ++subscriptionVersion
    removeChannel()
    if (!userId || isAdmin) return
    void subscribe(userId, version).catch(() => {
      // The conversation view retains its existing refresh behavior if Realtime is unavailable.
    })
  }, { immediate: true })

  onBeforeUnmount(() => {
    subscriptionVersion++
    removeChannel()
  })
}
