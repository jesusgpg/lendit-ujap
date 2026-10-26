import express, { type Request, type Response } from 'express'
import type { ApiRequest, ApiResponse } from '../backend/_lib/auth.js'
import healthHandler from '../backend/health.ts'
import itemsHandler from '../backend/items.ts'
import meHandler from '../backend/me.ts'
import categoriesHandler from '../backend/categories.ts'
import careersHandler from '../backend/careers.ts'
import schoolsHandler from '../backend/schools.ts'
import rolesHandler from '../backend/roles.ts'
import roleDetailHandler from '../backend/roles/[id].ts'
import permissionsHandler from '../backend/permissions.ts'
import usersHandler from '../backend/users.ts'
import userDetailHandler from '../backend/users/[id].ts'
import userResetPasswordHandler from '../backend/users/[id]/reset-password.ts'
import messagesHandler from '../backend/messages.ts'
import paymentsHandler from '../backend/payments.ts'
import teacherVerificationMeHandler from '../backend/teacher-verifications/me.ts'
import teacherVerificationMeCredentialHandler from '../backend/teacher-verifications/me/credential.ts'
import teacherVerificationsAdminHandler from '../backend/admin/teacher-verifications.ts'
import teacherVerificationDetailHandler from '../backend/admin/teacher-verifications/[id].ts'
import teacherVerificationDecisionHandler from '../backend/admin/teacher-verifications/[id]/decision.ts'

const app = express()
app.set('query parser', 'simple')
app.use(express.json())

type HandlerRequest = Omit<ApiRequest, 'query'> & {
  query: Record<string, string | string[] | undefined> & { id?: string; key?: string }
}
type Handler = (req: HandlerRequest, res: ApiResponse) => unknown

function wrap(handler: Handler, mergeParams = false) {
  return async (req: Request, res: Response) => {
    try {
      const query = { ...req.query, ...(mergeParams ? req.params : {}) } as HandlerRequest['query']
      await handler({ method: req.method, headers: req.headers, body: req.body, query }, res)
    } catch (error) {
      console.error('Unhandled API error', error)
      res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
    }
  }
}

// Handlers expect dynamic segments in query; Express supplies them in params.
// Pass a new request object because Express 5's req.query is read-only.
function withParamsAsQuery(handler: Handler) {
  return wrap(handler, true)
}

app.all('/api/health', wrap(healthHandler))
app.all('/api/items', wrap(itemsHandler))
app.all('/api/me', wrap(meHandler))
app.all('/api/categories', wrap(categoriesHandler))
app.all('/api/categories/:key', withParamsAsQuery(categoriesHandler))
app.all('/api/careers', wrap(careersHandler))
app.all('/api/careers/:id', withParamsAsQuery(careersHandler))
app.all('/api/schools', wrap(schoolsHandler))
app.all('/api/schools/:id', withParamsAsQuery(schoolsHandler))
app.all('/api/roles', wrap(rolesHandler))
app.all('/api/roles/:id', withParamsAsQuery(roleDetailHandler))
app.all('/api/permissions', wrap(permissionsHandler))
app.all('/api/users', wrap(usersHandler))
app.all('/api/users/:id/reset-password', withParamsAsQuery(userResetPasswordHandler))
app.all('/api/users/:id', withParamsAsQuery(userDetailHandler))
app.all('/api/messages', wrap(messagesHandler))
app.all('/api/payments', wrap(paymentsHandler))
app.all('/api/teacher-verifications/me/credential', wrap(teacherVerificationMeCredentialHandler))
app.all('/api/teacher-verifications/me', wrap(teacherVerificationMeHandler))
app.all('/api/admin/teacher-verifications/:id/decision', withParamsAsQuery(teacherVerificationDecisionHandler))
app.all('/api/admin/teacher-verifications/:id', withParamsAsQuery(teacherVerificationDetailHandler))
app.all('/api/admin/teacher-verifications', wrap(teacherVerificationsAdminHandler))

app.use((_req, res) => { res.status(404).json({ ok: false, error: "API_NOT_FOUND" }) })

export default app
