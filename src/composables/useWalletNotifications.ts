import { onBeforeUnmount, watch } from 'vue'
import type { RealtimeChannel, RealtimePostgresInsertPayload } from '@supabase/supabase-js'
import { push } from 'notivue'
import { getSupabaseClient } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { usePaymentsStore } from '../stores/payments'
import type { WalletTransaction } from '../types'

export function useWalletNotifications() {
  const auth = useAuthStore()
  const payments = usePaymentsStore()
  let channel: RealtimeChannel | null = null
  let version = 0
  const seen = new Set<string>()

  function removeChannel() {
    if (!channel) return
    void getSupabaseClient().removeChannel(channel)
    channel = null
  }

  function onTransaction(payload: RealtimePostgresInsertPayload<WalletTransaction>) {
    const transaction = payload.new
    if (!['RENTAL_CREDIT', 'RENTAL_REFUND', 'RENTAL_REVERSAL'].includes(transaction.type) || seen.has(transaction.id)) return
    seen.add(transaction.id)
    if (seen.size > 100) seen.delete(seen.values().next().value as string)
    void payments.loadAccount().catch(() => undefined)
    const amount = new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: transaction.currency,
      maximumFractionDigits: 2,
    }).format(Number(transaction.amount))
    push.info({
      title: transaction.type === 'RENTAL_REFUND'
        ? 'Saldo reintegrado'
        : transaction.type === 'RENTAL_REVERSAL' ? 'Ajuste de wallet' : 'Pago aprobado',
      message: transaction.type === 'RENTAL_REFUND'
        ? `${amount} volvió a tu wallet${transaction.description ? ` · ${transaction.description}` : ''}.`
        : transaction.type === 'RENTAL_REVERSAL'
          ? `${amount} se descontó de tu wallet${transaction.description ? ` · ${transaction.description}` : ''}.`
          : `${amount} se acreditó en tu wallet${transaction.description ? ` · ${transaction.description}` : ''}.`,
      duration: 8000,
      ariaLive: 'polite',
      ariaRole: 'status',
    })
  }

  async function subscribe(userId: string, subscriptionVersion: number) {
    const client = getSupabaseClient()
    const { data, error } = await client.auth.getSession()
    if (error || !data.session || subscriptionVersion !== version) return
    await client.realtime.setAuth(data.session.access_token)
    if (subscriptionVersion !== version) return
    channel = client
      .channel(`wallet-notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'WalletTransaction',
        filter: `userId=eq.${userId}`,
      }, onTransaction)
      .subscribe()
  }

  watch([() => auth.user?.id, () => auth.isAdmin], ([userId, isAdmin]) => {
    const currentVersion = ++version
    removeChannel()
    if (!userId || isAdmin) return
    void subscribe(userId, currentVersion).catch(() => {
      // The persisted wallet history remains available if Realtime is offline.
    })
  }, { immediate: true })

  onBeforeUnmount(() => {
    version++
    removeChannel()
  })
}
