import { defineStore } from 'pinia'
import { getArticles } from '../data'
import type { Article, NewArticleInput } from '../types'

const STORAGE_KEY = 'lendit-ujap:published-articles'

function readCachedArticles(): Article[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? (JSON.parse(raw) as Article[]) : []
}

export const useArticlesStore = defineStore('articles', {
  state: () => ({
    articles: [...getArticles(), ...readCachedArticles()] as Article[],
  }),

  actions: {
    publish(input: NewArticleInput) {
      const article: Article = {
        id: `article-${Date.now()}`,
        code: `#UJAP-${Math.floor(1000 + Math.random() * 9000)}`,
        title: input.title,
        category: input.category,
        duration: input.duration,
        status: 'available',
      }
      this.articles.unshift(article)

      const cached = readCachedArticles()
      cached.unshift(article)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cached))

      return article
    },
  },
})
