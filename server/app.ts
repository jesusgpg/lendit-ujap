import express, { type Request, type Response } from 'express'
import type { ApiRequest, ApiResponse } from '../backend/_lib/auth.js'
import healthHandler from '../backend/health.js'
import itemsHandler from '../backend/items.js'
import meHandler from '../backend/me.js'
import categoriesHandler from '../backend/categories.js'
import careersHandler from '../backend/careers.js'
import schoolsHandler from '../backend/schools.js'
import rolesHandler from '../backend/roles.js'
import roleDetailHandler from '../backend/roles/[id].js'
import permissionsHandler from '../backend/permissions.js'
import usersHandler from '../backend/users.js'
import userDetailHandler from '../backend/users/[id].js'
import userResetPasswordHandler from '../backend/users/[id]/reset-password.js'
import messagesHandler from '../backend/messages.js'
import paymentsHandler from '../backend/payments.js'
import notificationsHandler from '../backend/notifications.js'
import teacherVerificationMeHandler from '../backend/teacher-verifications/me.js'
import teacherVerificationMeCredentialHandler from '../backend/teacher-verifications/me/credential.js'
import teacherVerificationsAdminHandler from '../backend/admin/teacher-verifications.js'
import teacherVerificationDetailHandler from '../backend/admin/teacher-verifications/[id].js'
import teacherVerificationDecisionHandler from '../backend/admin/teacher-verifications/[id]/decision.js'

const app = express()
app.set('query parser', 'simple')
app.use(express.json())

type HandlerRequest = Omit<ApiRequest, 'query'> & {
  query: Record<string, string | string[] | undefined> & { id?: string; key?: string }
}
type Handler = (req: HandlerRequest, res: ApiResponse) => unknown

function wrap(handler: Handler, mergeParams = false) {
  return async (req: Request, res: Response) => {
    // Keep the small handler contract independent of Express's declaration
    // resolution in Vercel's per-function TypeScript compiler.
    const request = req as unknown as HandlerRequest & { params: Record<string, string> }
    const response = res as unknown as ApiResponse
    try {
      const query = { ...request.query, ...(mergeParams ? request.params : {}) } as HandlerRequest['query']
      await handler({ method: request.method, headers: request.headers, body: request.body, query }, response)
    } catch (error) {
      console.error('Unhandled API error', error)
      response.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
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
app.all('/api/notifications', wrap(notificationsHandler))
app.all('/api/teacher-verifications/me/credential', wrap(teacherVerificationMeCredentialHandler))
app.all('/api/teacher-verifications/me', wrap(teacherVerificationMeHandler))
app.all('/api/admin/teacher-verifications/:id/decision', withParamsAsQuery(teacherVerificationDecisionHandler))
app.all('/api/admin/teacher-verifications/:id', withParamsAsQuery(teacherVerificationDetailHandler))
app.all('/api/admin/teacher-verifications', wrap(teacherVerificationsAdminHandler))

app.use((_req, res) => { res.status(404).json({ ok: false, error: "API_NOT_FOUND" }) })

export default app
