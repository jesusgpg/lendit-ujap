// Servidor de desarrollo local que expone los mismos handlers de api/*
// bajo Express, sin depender de `vercel dev` ni de una cuenta de Vercel.
// En producción (Vercel) esos handlers se siguen usando tal cual como funciones serverless.
import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import healthHandler from '../api/health.ts'
import itemsHandler from '../api/items.ts'
import meHandler from '../api/me.ts'
import categoriesHandler from '../api/categories.ts'
import careersHandler from '../api/careers.ts'
import schoolsHandler from '../api/schools.ts'
import rolesHandler from '../api/roles.ts'
import roleDetailHandler from '../api/roles/[id].ts'
import permissionsHandler from '../api/permissions.ts'
import usersHandler from '../api/users.ts'
import userDetailHandler from '../api/users/[id].ts'
import userResetPasswordHandler from '../api/users/[id]/reset-password.ts'

const app = express()
app.use(express.json())

function wrap(handler: (req: Request, res: Response) => unknown) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res)
    } catch (error) {
      console.error('Unhandled API error', error)
      res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
    }
  }
}

// Vercel expone los segmentos dinámicos ([id]) en req.query; en Express llegan en req.params.
// req.query es de solo lectura en Express 5, así que envolvemos el request en vez de mutarlo.
function withParamsAsQuery(handler: (req: Request, res: Response) => unknown) {
  return wrap((req, res) => {
    const requestWithMergedQuery = Object.create(req, {
      query: { value: { ...req.query, ...req.params }, enumerable: true },
    }) as Request
    return handler(requestWithMergedQuery, res)
  })
}

app.all('/api/health', wrap(healthHandler))
app.all('/api/items', wrap(itemsHandler))
app.all('/api/me', wrap(meHandler))
app.all('/api/categories', wrap(categoriesHandler))
app.all('/api/categories/:key', withParamsAsQuery(categoriesHandler))
app.all('/api/careers', wrap(careersHandler))
app.all('/api/careers/:id', withParamsAsQuery(careersHandler))
app.all('/api/schools', wrap(schoolsHandler))
app.all('/api/roles', wrap(rolesHandler))
app.all('/api/roles/:id', withParamsAsQuery(roleDetailHandler))
app.all('/api/permissions', wrap(permissionsHandler))
app.all('/api/users', wrap(usersHandler))
app.all('/api/users/:id/reset-password', withParamsAsQuery(userResetPasswordHandler))
app.all('/api/users/:id', withParamsAsQuery(userDetailHandler))

const port = Number(process.env.DEV_API_PORT ?? 8787)
app.listen(port, () => {
  console.log(`[dev-api] escuchando en http://localhost:${port}`)
})
