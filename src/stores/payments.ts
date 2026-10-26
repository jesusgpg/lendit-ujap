import { defineStore } from 'pinia'
import { apiRequest } from '../lib/api'
import type { PaymentRecord, SimulatePaymentPayload } from '../types'

export interface SimulatePaymentResponse {
  ok: boolean
  payment: PaymentRecord
  simulatedFailure?: boolean
  idempotencyReplay?: boolean
  message?: string
  error?: string
}

export interface GetPaymentResponse {
  ok: boolean
  payment: PaymentRecord | null
  error?: string
}

export const usePaymentsStore = defineStore('payments', {
  state: () => ({
    isProcessing: false,
    error: null as string | null,
    lastPayment: null as PaymentRecord | null,
  }),

  actions: {
    async simulatePayment(payload: SimulatePaymentPayload): Promise<SimulatePaymentResponse> {
      this.isProcessing = true
      this.error = null

      try {
        const response = await apiRequest<SimulatePaymentResponse>('/api/payments', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        this.lastPayment = response.payment
        return response
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo procesar la simulación de pago.'
        this.error = message
        throw err
      } finally {
        this.isProcessing = false
      }
    },

    async fetchPayment(requestId: string): Promise<PaymentRecord | null> {
      try {
        const response = await apiRequest<GetPaymentResponse>(
          `/api/payments?requestId=${encodeURIComponent(requestId)}`,
        )
        return response.payment
      } catch {
        return null
      }
    },
  },
})
