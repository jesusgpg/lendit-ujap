import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const apiRequestMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', () => ({
  apiRequest: apiRequestMock,
}))

import { useRequestsStore } from './requests'

describe('loan request store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiRequestMock.mockReset()
  })

  it('sends the requested schedule to the existing items endpoint', async () => {
    const request = { id: 'request-1' }
    apiRequestMock.mockResolvedValueOnce({ request })
    const store = useRequestsStore()

    const result = await store.create({
      itemId: 'item-1',
      startsAt: '2026-09-20T10:00:00.000Z',
      endsAt: '2026-09-20T12:00:00.000Z',
      message: 'Lo necesito para una exposición.',
    })

    expect(result).toEqual(request)
    expect(apiRequestMock).toHaveBeenCalledWith('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        resource: 'request',
        itemId: 'item-1',
        startsAt: '2026-09-20T10:00:00.000Z',
        endsAt: '2026-09-20T12:00:00.000Z',
        message: 'Lo necesito para una exposición.',
      }),
    })
  })

  it('uses the request action endpoint for approval and return actions', async () => {
    apiRequestMock.mockResolvedValue({ request: null })
    const store = useRequestsStore()

    await store.act({ action: 'approve', requestId: 'request-1' })
    await store.act({ action: 'return', loanId: 'loan-1' })

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/api/items', {
      method: 'PATCH',
      body: JSON.stringify({ resource: 'request', action: 'approve', requestId: 'request-1' }),
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/api/items', {
      method: 'PATCH',
      body: JSON.stringify({ resource: 'request', action: 'return', loanId: 'loan-1' }),
    })
  })
})
