import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Article } from '../types'

const apiRequestMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', () => ({
  apiRequest: apiRequestMock,
}))

import { useArticlesStore } from './articles'

const article: Article = {
  id: 'item-1',
  code: '#UJAP-TEST',
  title: 'Calculadora',
  description: 'Para el parcial',
  photoUrl: null,
  category: 'Útiles escolares',
  categoryKey: 'utiles-escolares',
  categoryIcon: '📏',
  duration: '2 horas',
  mode: 'LOAN',
  price: null,
  currency: null,
  status: 'available',
  restrictedToRoles: [],
}

describe('article workflow store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiRequestMock.mockReset()
  })

  it('loads only the authenticated user publications for the shelf', async () => {
    apiRequestMock.mockResolvedValueOnce({ items: [article] })
    const store = useArticlesStore()

    await store.loadMine()

    expect(apiRequestMock).toHaveBeenCalledWith('/api/items?mine=1')
    expect(store.myArticles).toEqual([article])
  })

  it('updates a publication and refreshes the public catalog', async () => {
    const updated = { ...article, title: 'Calculadora HP', status: 'paused' as const }
    apiRequestMock.mockResolvedValueOnce({ item: updated }).mockResolvedValueOnce({ items: [] })
    const store = useArticlesStore()
    store.myArticles = [article]

    await store.update(article.id, { title: 'Calculadora HP', status: 'paused' })

    expect(apiRequestMock).toHaveBeenNthCalledWith(
      1,
      '/api/items',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ id: article.id, title: 'Calculadora HP', status: 'paused' }) }),
    )
    expect(store.myArticles[0].title).toBe('Calculadora HP')
  })

  it('removes a publication from both local lists after the API confirms deletion', async () => {
    apiRequestMock.mockResolvedValueOnce({ item: { id: article.id, photoUrl: null } })
    const store = useArticlesStore()
    store.myArticles = [article]
    store.articles = [article]

    await store.remove(article.id)

    expect(store.myArticles).toHaveLength(0)
    expect(store.articles).toHaveLength(0)
  })
})
