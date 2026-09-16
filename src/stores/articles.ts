import { defineStore } from 'pinia'
import { apiRequest } from '../lib/api'
import type { Article, NewArticleInput } from '../types'

interface ItemsResponse {
  items: Article[]
}

interface ItemResponse {
  item: Article
}

export const useArticlesStore = defineStore('articles', {
  state: () => ({
    articles: [] as Article[],
    isLoading: false,
    error: null as string | null,
    isInitialized: false,
  }),

  actions: {
    async initialize() {
      if (this.isInitialized || this.isLoading) {
        return
      }
      await this.load()
    },

    async load() {
      this.isLoading = true
      this.error = null

      try {
        const response = await apiRequest<ItemsResponse>('/api/items')
        this.articles = response.items
        this.isInitialized = true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'No se pudieron cargar los objetos.'
      } finally {
        this.isLoading = false
      }
    },

    // Se publica de inmediato: no hay cola de revisión.
    async publish(input: NewArticleInput) {
      const response = await apiRequest<ItemResponse>('/api/items', {
        method: 'POST',
        body: JSON.stringify(input),
      })

      await this.load()
      return response.item
    },
  },
})
