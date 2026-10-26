// Run after `vercel build`: checks the emitted JavaScript, not the TS source.
// Uses no credentials and never connects to a database or Supabase.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

process.env.DATABASE_URL = 'postgresql://postgres@127.0.0.1:1/unused'
const entry = resolve('.vercel/output/functions/api/index.func/api/index.js')
const { default: handler } = await import(pathToFileURL(entry).href)
const server = createServer(handler)
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
try {
  for (const route of ['/api/me', '/api?__apiPath=/me', '/api?__apiPath=/users']) {
    const response = await fetch(base + route)
    assert.equal(response.status, 401)
    assert.equal((await response.json()).error, 'UNAUTHORIZED')
  }
  const response = await fetch(`${base}/api?__apiPath=/missing`)
  assert.equal(response.status, 404)
  assert.equal((await response.json()).error, 'API_NOT_FOUND')
  console.log('PASS: 4 emitted Vercel runtime checks; no remote services used.')
} finally {
  await new Promise(resolve => server.close(resolve))
}
