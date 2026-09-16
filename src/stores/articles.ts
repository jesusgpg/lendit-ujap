import { defineStore } from 'pinia'
import { apiRequest } from '../lib/api'
import type { Article, NewArticleInput, UpdateArticleInput } from '../types'

interface ItemsResponse {
  items: Article[]
}

interface ItemResponse {
  item: Article
}

interface DeletedItemResponse {
  item: { id: string; photoUrl: string | null }
}

export const useArticlesStore = defineStore('articles', {
  state: () => ({
    articles: [] as Article[],
    myArticles: [] as Article[],
    isLoading: false,
    isLoadingMine: false,
    error: null as string | null,
    mineError: null as string | null,
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

    async loadMine() {
      this.isLoadingMine = true
      this.mineError = null

      try {
        const response = await apiRequest<ItemsResponse>('/api/items?mine=1')
        this.myArticles = response.items
      } catch (error) {
        this.mineError = error instanceof Error ? error.message : 'No se pudieron cargar tus publicaciones.'
      } finally {
        this.isLoadingMine = false
      }
    },

    async update(id: string, input: UpdateArticleInput) {
      const response = await apiRequest<ItemResponse>('/api/items', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...input }),
      })

      this.myArticles = this.myArticles.map((article) => (article.id === id ? response.item : article))
      await this.load()
      return response.item
    },

    async setStatus(id: string, status: 'available' | 'paused') {
      return this.update(id, { status })
    },

    async remove(id: string) {
      const response = await apiRequest<DeletedItemResponse>('/api/items', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })

      this.myArticles = this.myArticles.filter((article) => article.id !== id)
      this.articles = this.articles.filter((article) => article.id !== id)
      return response.item
    },
  },
})
