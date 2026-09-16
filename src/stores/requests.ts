import { defineStore } from 'pinia'
import { apiRequest } from '../lib/api'
import type { LoanRequest, NewLoanRequestInput } from '../types'

interface RequestsResponse {
  requests: LoanRequest[]
}

interface RequestResponse {
  request: LoanRequest | null
}

type RequestAction =
  | { action: 'approve' | 'reject' | 'cancel'; requestId: string }
  | { action: 'return'; loanId: string }

export const useRequestsStore = defineStore('requests', {
  state: () => ({
    requests: [] as LoanRequest[],
    isLoading: false,
    error: null as string | null,
  }),

  actions: {
    async load() {
      this.isLoading = true
      this.error = null

      try {
        const response = await apiRequest<RequestsResponse>('/api/items?view=requests')
        this.requests = response.requests
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'No se pudieron cargar las solicitudes.'
      } finally {
        this.isLoading = false
      }
    },

    async create(input: NewLoanRequestInput) {
      const response = await apiRequest<RequestResponse>('/api/items', {
        method: 'POST',
        body: JSON.stringify({ resource: 'request', ...input }),
      })
      return response.request
    },

    async act(input: RequestAction) {
      const response = await apiRequest<RequestResponse>('/api/items', {
        method: 'PATCH',
        body: JSON.stringify({ resource: 'request', ...input }),
      })
      return response.request
    },
  },
})
