import { onBeforeUnmount, watch } from 'vue'
import type { RealtimeChannel, RealtimePostgresInsertPayload } from '@supabase/supabase-js'
import { useRoute } from 'vue-router'
import { push } from 'notivue'
import { getSupabaseClient } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { useNotificationsStore } from '../stores/notifications'
import { useRequestsStore } from '../stores/requests'
import type { AppNotification } from '../types'

export function useRealtimeNotifications() {
  const route = useRoute()
  const auth = useAuthStore()
  const notifications = useNotificationsStore()
  const requests = useRequestsStore()
  let channel: RealtimeChannel | null = null
  let version = 0
  let refreshTimer: ReturnType<typeof setInterval> | undefined

  function removeChannel() {
    if (!channel) return
    void getSupabaseClient().removeChannel(channel)
    channel = null
  }

  function onNotification(payload: RealtimePostgresInsertPayload<AppNotification>) {
    const notification = payload.new
    if (!notifications.receive(notification)) return

    if (notification.type === 'NEW_MESSAGE' && route.name === 'messages') {
      const hrefQuery = notification.href.split('?', 2)[1] ?? ''
      const conversationId = new URLSearchParams(hrefQuery).get('conversation')
      if (conversationId && route.query.conversation === conversationId) void notifications.markRead(notification.id)
    }

    if (['NEW_REQUEST', 'REQUEST_UPDATED', 'PAYMENT_RECEIVED', 'LOAN_RETURNED'].includes(notification.type)
      && route.name === 'requests') {
      void requests.load()
    }

    // Chat messages already have their own live toast and inbox refresh channel.
    if (notification.type === 'NEW_MESSAGE') return
    push.info({
      title: notification.title,
      message: notification.message,
      duration: 5000,
      ariaLive: 'polite',
      ariaRole: 'status',
    })
  }

  async function subscribe(userId: string, currentVersion: number) {
    const client = getSupabaseClient()
    const { data, error } = await client.auth.getSession()
    if (error || !data.session || currentVersion !== version) return
    await client.realtime.setAuth(data.session.access_token)
    if (currentVersion !== version) return

    channel = client.channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'Notification',
        filter: `userId=eq.${userId}`,
      }, onNotification)
      .subscribe(status => {
        if (currentVersion === version && status === 'SUBSCRIBED') void notifications.load().catch(() => undefined)
      })
  }

  watch([() => auth.user?.id, () => auth.isAdmin], ([userId, isAdmin]) => {
    const currentVersion = ++version
    removeChannel()
    if (refreshTimer) clearInterval(refreshTimer)
    if (!userId || isAdmin) {
      notifications.clear()
      return
    }
    void notifications.load().catch(() => undefined)
    void subscribe(userId, currentVersion).catch(() => undefined)
    refreshTimer = setInterval(() => {
      if (!document.hidden) void notifications.load().catch(() => undefined)
    }, 60_000)
  }, { immediate: true })

  onBeforeUnmount(() => {
    version++
    removeChannel()
    if (refreshTimer) clearInterval(refreshTimer)
  })
}
