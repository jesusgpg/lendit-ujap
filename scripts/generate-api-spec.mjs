// Reviewed route inventory. Keep request schemas aligned with backend Zod schemas.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const string = (maxLength, extra = {}) => ({ type: 'string', ...(maxLength ? { maxLength } : {}), ...extra })
const uuid = string(undefined, { format: 'uuid' })
const object = (properties, required = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) })
const ref = name => ({ $ref: `#/components/schemas/${name}` })
const schemas = {
  Success: object({ ok: { type: 'boolean', enum: [true] } }, ['ok']),
  Error: object({ ok: { type: 'boolean', enum: [false] }, error: string() }, ['ok', 'error']),
  ProfilePatch: object({ firstName: string(80, { minLength: 1 }), lastName: string(80, { minLength: 1 }), phone: string(30, { minLength: 7 }), photoUrl: { ...string(undefined, { format: 'uri' }), nullable: true }, careerId: { ...uuid, nullable: true }, schoolId: { ...uuid, nullable: true }, department: { ...string(120), nullable: true } }),
  Publication: object({ title: string(160, { minLength: 2 }), categoryKey: string(60, { minLength: 1 }), duration: string(80, { minLength: 1 }), description: string(1000), mode: { type: 'string', enum: ['LOAN', 'RENTAL'], default: 'LOAN' }, price: { type: 'number', exclusiveMinimum: true, minimum: 0, maximum: 100000 }, currency: { type: 'string', enum: ['USD', 'EUR', 'VES'] }, photoUrls: { type: 'array', maxItems: 8, items: string(2048, { format: 'uri' }) }, photoUrl: string(2048, { format: 'uri' }), restrictedToRoles: { type: 'array', items: string() } }, ['title', 'categoryKey', 'duration']),
  RequestCreate: object({ resource: { type: 'string', enum: ['request'] }, itemId: uuid, startsAt: string(undefined, { format: 'date-time' }), endsAt: string(undefined, { format: 'date-time' }), message: string(600) }, ['resource', 'itemId', 'startsAt', 'endsAt']),
  RequestAction: object({ resource: { type: 'string', enum: ['request'] }, action: { type: 'string', enum: ['approve', 'reject', 'cancel', 'return'] }, requestId: uuid, loanId: uuid }, ['resource', 'action']),
  UserPatch: object({ roleId: uuid, isActive: { type: 'boolean' } }),
  RoleCreate: object({ name: string(60, { minLength: 2 }), description: string(300), permissionKeys: { type: 'array', items: string() } }, ['name']),
  RolePatch: object({ description: string(300), permissionKeys: { type: 'array', maxItems: 100, items: string(80) } }),
  School: object({ name: string(120, { minLength: 2 }), imagenUrl: { ...string(255, { format: 'uri', pattern: '^https://' }), nullable: true }, imagenAlt: { ...string(255), nullable: true } }, ['name']),
  Career: object({ name: string(120, { minLength: 2 }), schoolId: { ...uuid, nullable: true }, imagenUrl: { ...string(255, { format: 'uri', pattern: '^https://' }), nullable: true }, imagenAlt: { ...string(255), nullable: true } }, ['name']),
  Category: object({ key: string(60, { minLength: 2 }), label: string(80, { minLength: 2 }), icon: string(8), blurb: string(300), imagenUrl: { ...string(undefined, { format: 'uri', pattern: '^https://' }), nullable: true }, imagenAlt: string(500, { minLength: 2 }), unsplashPhotoId: { ...string(100), nullable: true } }, ['key', 'label']),
  PaymentSimulation: object({ requestId: uuid, outcome: { type: 'string', enum: ['success', 'failure'], default: 'success' }, paymentMethod: { type: 'string', enum: ['campus_balance', 'fake_card', 'fake_mobile_pay'], default: 'campus_balance' } }, ['requestId']),
  TeacherSubmit: object({ schoolId: uuid, careerId: { ...uuid, nullable: true }, department: { ...string(120), nullable: true }, documentPath: string(255, { minLength: 3 }), expectedVersion: { type: 'integer', minimum: 1 } }, ['schoolId', 'documentPath']),
  TeacherDecision: object({ action: { type: 'string', enum: ['APPROVE', 'REJECT', 'REQUEST_CORRECTION'] }, reason: string(1000), expectedVersion: { type: 'integer', minimum: 1 } }, ['action', 'expectedVersion']),
}
schemas.PublicationPatch = object({ ...schemas.Publication.properties, id: uuid, status: { type: 'string', enum: ['AVAILABLE', 'PAUSED'] } }, ['id'])
schemas.SchoolPatch = { ...schemas.School, required: undefined }
schemas.CareerPatch = { ...schemas.Career, required: undefined }
schemas.CategoryPatch = object(Object.fromEntries(Object.entries(schemas.Category.properties).filter(([key]) => key !== 'key')))
const paths = {}
const query = (name, description, type = 'string', required = false) => ({ in: 'query', name, description, required, schema: { type } })
function operation(path, method, summary, permission = 'Sesión activa', options = {}) {
  const { schema, parameters = [], success = 200, publicRead = false, optionalAuth = false } = options
  const pathParams = [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({ name, in: 'path', required: true, schema: name === 'id' ? uuid : string(), description: 'Identificador del recurso' }))
  ;(paths[path] ??= {})[method] = {
    summary, description: `${permission}. Ver docs/api-reference.md para reglas condicionales y ejemplos. Las respuestas de éxito documentan el sobre común; los DTO completos no se modelan todavía.`,
    operationId: `${method}_${path.replace(/[^a-zA-Z0-9]+/g, '_')}`,
    security: publicRead ? [] : optionalAuth ? [{}, { bearerAuth: [] }] : [{ bearerAuth: [] }],
    ...(pathParams.length || parameters.length ? { parameters: [...pathParams, ...parameters] } : {}),
    ...(schema ? { requestBody: { required: true, content: { 'application/json': { schema: typeof schema === 'string' ? ref(schema) : schema } } } } : {}),
    responses: {
      [success]: { description: summary, content: { 'application/json': { schema: ref('Success') } } },
      default: { description: 'Error HTTP según validación, permisos, estado o proveedor. Consultar referencia humana; 401/403/404/409 no son intercambiables.', content: { 'application/json': { schema: ref('Error') } } },
    },
  }
}
operation('/api/health', 'get', 'Comprobar conexión PostgreSQL', 'Público. 200 activo; 503 conexión caída', { publicRead: true })
paths['/api/health'].get.responses['503'] = { description: 'Base de datos no disponible', content: { 'application/json': { schema: object({ ok: { type: 'boolean', enum: [false] }, database: { type: 'string', enum: ['down'] } }, ['ok', 'database']) } } }
operation('/api/me', 'get', 'Consultar perfil propio', 'Sesión activa; 409 PROFILE_REQUIRED si no existe perfil')
operation('/api/me', 'patch', 'Actualizar o materializar perfil propio', 'profile.update para perfil existente; validación académica por tipo de cuenta', { schema: 'ProfilePatch' })
operation('/api/items', 'get', 'Listar publicaciones o solicitudes propias', 'Catálogo público; mine y view=requests requieren sesión. ADMIN solo lectura de catálogo', { optionalAuth: true, parameters: [query('mine', '1 o true: publicaciones propias'), query('view', 'requests: solicitudes propias')] })
operation('/api/items', 'post', 'Crear publicación o solicitud', 'items.publish o items.rent según resource; ADMIN bloqueado. Docentes no aprobados no crean operaciones', { schema: { oneOf: [ref('Publication'), ref('RequestCreate')] }, success: 201 })
operation('/api/items', 'patch', 'Editar publicación o resolver solicitud/préstamo', 'Propietario o participante según acción; resource=request selecciona flujo de solicitudes', { schema: { oneOf: [ref('PublicationPatch'), ref('RequestAction')] } })
operation('/api/items', 'delete', 'Eliminar publicación sin historial', 'items.publish y propiedad. 409 ITEM_HAS_LOAN_HISTORY si tiene solicitudes/préstamos', { schema: object({ id: uuid }, ['id']) })
for (const [route, schema, permission, identifier] of [['schools', 'School', 'careers.manage', 'id'], ['careers', 'Career', 'careers.manage', 'id'], ['categories', 'Category', 'categories.manage', 'key']]) {
  operation(`/api/${route}`, 'get', `Listar ${route}`, route === 'categories' ? 'Público; action=photos requiere categories.manage y UNSPLASH_ACCESS_KEY' : 'Público', { publicRead: true, ...(route === 'categories' ? { parameters: [query('action', 'photos: búsqueda privada de fotos'), query('q', 'Término para búsqueda de fotos')] } : {}) })
  operation(`/api/${route}`, 'post', `Crear ${route}`, permission, { schema, success: 201 })
  operation(`/api/${route}/{${identifier}}`, 'patch', `Editar ${route}`, permission, { schema: `${schema}Patch` })
  operation(`/api/${route}/{${identifier}}`, 'delete', `Eliminar ${route} sin referencias bloqueantes`, `${permission}; 409 si está en uso`)
}
operation('/api/roles', 'get', 'Listar roles y permisos', 'Sesión activa')
operation('/api/roles', 'post', 'Crear rol', 'roles.manage', { schema: 'RoleCreate', success: 201 })
operation('/api/roles/{id}', 'patch', 'Editar permisos/descripción de rol', 'roles.manage; protección del último administrador', { schema: 'RolePatch' })
operation('/api/roles/{id}', 'delete', 'Eliminar rol no protegido ni asignado', 'roles.manage; ADMIN/STUDENT/PROFESSOR no se eliminan')
operation('/api/permissions', 'get', 'Listar permisos conocidos', 'roles.manage')
operation('/api/users', 'get', 'Buscar y paginar usuarios', 'users.manage', { parameters: [query('q', 'Búsqueda por nombre/correo'), query('page', 'Página desde 1; tamaño fijo 25', 'integer')] })
operation('/api/users/{id}', 'patch', 'Actualizar rol o estado activo', 'users.manage; último admin protegido; asignar PROFESSOR requiere acreditación aprobada', { schema: 'UserPatch' })
operation('/api/users/{id}/reset-password', 'post', 'Solicitar correo de recuperación para usuario', 'users.manage. 200 significa solicitud aceptada, no entrega confirmada. Destino APP_URL + /auth/reset-password; requiere allowlist Supabase')
operation('/api/messages', 'get', 'Consultar bandeja o mensajes de hilo', 'Participantes; ADMIN bloqueado', { parameters: [query('view', 'inbox: bandeja'), query('page', 'Bandeja desde 0', 'integer'), query('requestId', 'UUID: hilo de solicitud, excluyente con conversationId'), query('conversationId', 'UUID: consulta de objeto'), query('before', 'UUID del cursor en el mismo hilo')] })
operation('/api/messages', 'post', 'Iniciar consulta o enviar mensaje', 'Participantes, audiencia y estado del hilo; ADMIN bloqueado', { schema: { oneOf: [object({ action: { type: 'string', enum: ['start'] }, itemId: uuid }, ['action', 'itemId']), object({ requestId: uuid, conversationId: uuid, content: string(2000, { minLength: 1 }) }, ['content'])] } })
paths['/api/messages'].post.responses['201'] = paths['/api/messages'].post.responses['200']
operation('/api/payments', 'get', 'Consultar pago simulado de solicitud', 'Participantes de la solicitud; ADMIN bloqueado', { parameters: [query('requestId', 'UUID de solicitud', 'string', true)] })
operation('/api/payments', 'post', 'Simular resultado de pago', 'Solo solicitante de alquiler pendiente; no procesa dinero real', { schema: 'PaymentSimulation' })
operation('/api/teacher-verifications/me', 'get', 'Consultar acreditación propia', 'Cuenta activa; credencial privada e historial')
operation('/api/teacher-verifications/me', 'post', 'Enviar/re-enviar acreditación', 'Cuenta activa; archivo existente propio JPEG/PNG/WebP hasta 5 MB; expectedVersion para edición concurrente', { schema: 'TeacherSubmit' })
operation('/api/teacher-verifications/me/credential', 'get', 'Obtener URL firmada de credencial propia', 'Cuenta activa; URL temporal, no pública')
operation('/api/admin/teacher-verifications', 'get', 'Listar acreditaciones para revisión', 'teachers.review', { parameters: [query('status', 'DRAFT/PENDING/NEEDS_CORRECTION/REJECTED/APPROVED/ALL; por defecto PENDING'), query('schoolId', 'UUID escuela'), query('search', 'Nombre/correo'), query('page', 'Desde 1', 'integer'), query('pageSize', '1–50; por defecto 10', 'integer')] })
operation('/api/admin/teacher-verifications/{id}', 'get', 'Consultar expediente docente', 'teachers.review')
operation('/api/admin/teacher-verifications/{id}/decision', 'post', 'Aprobar, rechazar o pedir corrección', 'teachers.review; expectedVersion obligatorio. Rechazo/corrección requieren motivo de al menos 5 caracteres', { schema: 'TeacherDecision' })

// Fail if a route is added to Express without updating this inventory.
const appSource = readFileSync('server/app.ts', 'utf8')
const registered = [...appSource.matchAll(/app\.all\('([^']+)'/g)].map(([, route]) => route.replace(/:(\w+)/g, '{$1}')).sort()
if (JSON.stringify(registered) !== JSON.stringify(Object.keys(paths).sort())) throw new Error('OpenAPI route inventory differs from server/app.ts')
const spec = { openapi: '3.0.3', info: { title: 'LendIt UJAP API', version: '1.0.0', description: 'Inventario de rutas y esquemas iniciales derivado del backend. No es un contrato exhaustivo de DTOs ni evidencia de ejecución. Supabase Auth y Storage son servicios externos y no se inventan endpoints /api/login o /api/register.' }, servers: [{ url: 'http://localhost:8787', description: 'Desarrollo local; ejecutar pnpm dev:api' }, { url: 'https://lendit-ujap.vercel.app', description: 'Producción: no ejecutar mutaciones de demostración con cuentas personales' }], paths, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas } }
mkdirSync('contracts', { recursive: true })
writeFileSync('contracts/openapi.json', JSON.stringify(spec, null, 2) + '\n')
console.log(`OpenAPI generado: ${registered.length} rutas, ${Object.values(paths).reduce((n, methods) => n + Object.keys(methods).length, 0)} operaciones. Inventario coincide con router.`)
