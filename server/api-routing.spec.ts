import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// Routing tests only: no database or external identity service is contacted.
vi.mock('../backend/_lib/prisma.js', () => ({ prisma: {} }))
vi.mock('../backend/health.ts', () => ({ default: (_req: unknown, res: { json: (body: unknown) => void }) => res.json({ ok: true }) }))
vi.mock('../backend/categories.ts', () => ({ default: (req: { query: unknown }, res: { json: (body: unknown) => void }) => res.json({ query: req.query }) }))
vi.mock('../backend/admin/teacher-verifications/[id]/decision.ts', () => ({ default: (req: { query: unknown; body: unknown }, res: { json: (body: unknown) => void }) => res.json({ query: req.query, body: req.body }) }))

import handler from '../api/index.js'

describe('single Vercel API entry point', () => {
  let server: Server
  let base: string
  beforeAll(async () => {
    server = createServer(handler)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing test port')
    base = `http://127.0.0.1:${address.port}`
  })
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) })
  it('routes the Vercel rewrite to health', async () => {
    const response = await fetch(`${base}/api?__apiPath=health`)
    expect(await response.json()).toEqual({ ok: true })
  })
  it('also handles the original path when Vercel preserves it', async () => {
    expect(await (await fetch(`${base}/api/health`)).json()).toEqual({ ok: true })
  })
  it('preserves search parameters and merges dynamic category keys', async () => {
    const response = await fetch(`${base}/api?__apiPath=categories/laboratorio&search=microscopio&key=spoofed`)
    expect(await response.json()).toEqual({ query: { search: 'microscopio', key: 'laboratorio' } })
  })
  it('preserves nested decision routes, JSON payloads and IDs', async () => {
    const body = { action: 'APPROVE', expectedVersion: 3 }
    const response = await fetch(`${base}/api?__apiPath=admin/teacher-verifications/fixture/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    expect(await response.json()).toEqual({ query: { id: 'fixture' }, body })
  })
  it('keeps authentication checks on an actual protected handler', async () => {
    const response = await fetch(`${base}/api?__apiPath=users`)
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: 'UNAUTHORIZED' })
  })
  it('returns a JSON 404 for unknown API paths', async () => {
    const response = await fetch(`${base}/api?__apiPath=missing`)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ ok: false, error: 'API_NOT_FOUND' })
  })
})

