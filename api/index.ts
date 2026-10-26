// Single Vercel Function. Internal handlers live outside api/ so they are not
// deployed as separate functions. Keep the public /api/* contract unchanged.
import type { IncomingMessage, ServerResponse } from 'node:http'
import app from '../server/app.js'

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const route = url.searchParams.get('__apiPath')
  if (route !== null) {
    url.searchParams.delete('__apiPath')
    req.url = `/api/${route.replace(/^\/+/, '')}${url.search}`
  }
  return app(req, res)
}
