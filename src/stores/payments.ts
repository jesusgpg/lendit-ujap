import { defineStore } from 'pinia'
import { apiRequest } from '../lib/api'
import type {
  BCVExchangeRates,
  MobileRentalPaymentPayload,
  PaymentRecord,
  PaymentsAccountResponse,
  WalletAccount,
  WalletRentalPaymentPayload,
  WalletTopUpPayload,
  WalletTransaction,
  CentralPaymentAccount,
} from '../types'

interface PaymentResponse {
  ok: boolean
  payment: PaymentRecord
  approved?: boolean
  idempotencyReplay?: boolean
}

interface GetPaymentResponse {
  ok: boolean
  payment: PaymentRecord | null
}

export const usePaymentsStore = defineStore('payments', {
  state: () => ({
    isProcessing: false,
    isLoadingAccount: false,
    error: null as string | null,
    accountError: null as string | null,
    walletAccounts: [] as WalletAccount[],
    walletTransactions: [] as WalletTransaction[],
    centralAccount: null as CentralPaymentAccount | null,
    exchangeRates: null as BCVExchangeRates | null,
    lastPayment: null as PaymentRecord | null,
  }),

  getters: {
    balanceFor: state => (currency: WalletAccount['currency']) =>
      state.walletAccounts.find(account => account.currency === currency)?.balance ?? 0,
  },

  actions: {
    async loadAccount() {
      this.isLoadingAccount = true
      this.accountError = null
      try {
        const response = await apiRequest<PaymentsAccountResponse>('/api/payments?view=account')
        this.walletAccounts = response.wallet.accounts
        this.walletTransactions = response.wallet.transactions
        this.centralAccount = response.centralAccount
        this.exchangeRates = response.exchangeRates
        return response
      } catch (error) {
        this.accountError = error instanceof Error ? error.message : 'No se pudo cargar tu cuenta de pagos.'
        throw error
      } finally {
        this.isLoadingAccount = false
      }
    },

    async submitMobileRental(payload: MobileRentalPaymentPayload) {
      return this.submitPayment(payload)
    },

    async submitWalletTopUp(payload: WalletTopUpPayload) {
      return this.submitPayment(payload)
    },

    async submitWalletRental(payload: WalletRentalPaymentPayload) {
      return this.submitPayment(payload)
    },

    async submitPayment(payload: MobileRentalPaymentPayload | WalletTopUpPayload | WalletRentalPaymentPayload) {
      this.isProcessing = true
      this.error = null
      try {
        const response = await apiRequest<PaymentResponse>('/api/payments', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        this.lastPayment = response.payment
        await this.loadAccount().catch(() => undefined)
        return response
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo validar el pago.'
        this.error = message
        throw error
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

    clear() {
      this.isProcessing = false
      this.isLoadingAccount = false
      this.error = null
      this.accountError = null
      this.walletAccounts = []
      this.walletTransactions = []
      this.centralAccount = null
      this.exchangeRates = null
      this.lastPayment = null
    },
  },
})
