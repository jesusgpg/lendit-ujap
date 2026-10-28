import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setupEnvironment } from './environment.js'

describe('LendIt UJAP — endpoints HTTP con Supertest y PostgreSQL aislado', () => {
  let env: Awaited<ReturnType<typeof setupEnvironment>>
  const publication = { title: 'Microscopio QA', categoryKey: 'laboratorio-qa', duration: '1 día', mode: 'LOAN' }
  beforeAll(async () => { env = await setupEnvironment() })
  afterAll(async () => { await env?.cleanup() })
  it('API-001 | GET /api/health → 200 y conexión real a PostgreSQL', async () => {
    const response = await request(env.app).get('/api/health').expect(200)
    expect(response.body).toEqual({ ok: true, database: 'up' })
  })
  it('API-002 | GET ruta inexistente → 404 JSON', async () => {
    const response = await request(env.app).get('/api/no-existe').expect(404)
    expect(response.body.error).toBe('API_NOT_FOUND')
  })
  it('API-003 | PUT /api/me → 405 método no permitido', async () => {
    const response = await request(env.app).put('/api/me').expect(405)
    expect(response.body.error).toBe('METHOD_NOT_ALLOWED')
  })
  it('API-004 | GET /api/me sin sesión → 401', async () => {
    const response = await request(env.app).get('/api/me').expect(401)
    expect(response.body.error).toBe('UNAUTHORIZED')
  })
  it('API-005 | GET /api/me con token inválido → 401', async () => {
    const response = await request(env.app).get('/api/me').auth('invalid-fixture', { type: 'bearer' }).expect(401)
    expect(response.body.error).toBe('UNAUTHORIZED')
  })
  it('API-006 | GET /api/me con cuenta desactivada → 403 sin devolver perfil', async () => {
    const response = await request(env.app).get('/api/me').auth(env.disabled.token, { type: 'bearer' }).expect(403)
    expect(response.body.error).toBe('ACCOUNT_DISABLED')
    expect(response.body.user).toBeUndefined()
  })
  it('API-007 | GET /api/me devuelve el perfil propio sin contraseña', async () => {
    const response = await request(env.app).get('/api/me').auth(env.student.token, { type: 'bearer' }).expect(200)
    expect(response.body.user).toMatchObject({ id: env.student.profile.id, email: env.student.email, role: 'STUDENT' })
    expect(response.body.user).not.toHaveProperty('password')
  })
  it('API-008 | GET /api/me con perfil faltante → 409 PROFILE_REQUIRED', async () => {
    const identity = env.identity('sin-perfil')
    const response = await request(env.app).get('/api/me').auth(identity.token, { type: 'bearer' }).expect(409)
    expect(response.body.error).toBe('PROFILE_REQUIRED')
  })
  it('API-009 | PATCH /api/me crea perfil desde identidad y no concede ADMIN por metadata', async () => {
    const identity = env.identity('alta-qa', { firstName: 'Alta', lastName: 'QA', phone: '00000000000', careerId: env.career.id, schoolId: env.school.id, role: 'ADMIN' })
    const response = await request(env.app).patch('/api/me').auth(identity.token, { type: 'bearer' }).send({}).expect(200)
    expect(response.body.user.role).toBe('STUDENT')
    const persisted = await env.prisma.user.findUnique({ where: { authUserId: identity.id } })
    expect(persisted?.roleId).toBe(env.studentRole.id)
  })
  it('API-010 | PATCH /api/me con carrera inexistente → 400 y sin alterar perfil', async () => {
    const response = await request(env.app).patch('/api/me').auth(env.student.token, { type: 'bearer' }).send({ careerId: randomUUID() }).expect(400)
    expect(response.body.error).toBe('CAREER_NOT_FOUND')
    expect((await env.prisma.user.findUniqueOrThrow({ where: { id: env.student.profile.id } })).careerId).toBe(env.career.id)
  })
  it('API-011 | PATCH /api/me persiste datos válidos', async () => {
    await request(env.app).patch('/api/me').auth(env.student.token, { type: 'bearer' }).send({ firstName: 'Nombre actualizado' }).expect(200)
    expect((await env.prisma.user.findUniqueOrThrow({ where: { id: env.student.profile.id } })).firstName).toBe('Nombre actualizado')
  })
  it('API-012 | GET /api/users como estudiante → 403', async () => {
    const response = await request(env.app).get('/api/users').auth(env.student.token, { type: 'bearer' }).expect(403)
    expect(response.body.error).toBe('FORBIDDEN')
  })
  it('API-013 | GET /api/users como admin con búsqueda y paginación', async () => {
    const response = await request(env.app).get('/api/users').query({ q: env.other.email }).auth(env.admin.token, { type: 'bearer' }).expect(200)
    expect(response.body.total).toBe(1)
    expect(response.body.users[0].id).toBe(env.other.profile.id)
    expect(response.body.pageSize).toBe(25)
  })
  it('API-014 | PATCH /api/roles/:id con permiso desconocido → 400 sin cambiar permisos', async () => {
    const before = await env.prisma.rolePermission.count({ where: { roleId: env.adminRole.id } })
    const response = await request(env.app).patch(`/api/roles/${env.adminRole.id}`).auth(env.admin.token, { type: 'bearer' }).send({ permissionKeys: ['inventado.manage'] }).expect(400)
    expect(response.body.error).toBe('UNKNOWN_PERMISSION')
    expect(await env.prisma.rolePermission.count({ where: { roleId: env.adminRole.id } })).toBe(before)
  })
  it('API-015 | PATCH /api/users/:id no puede desactivar el último admin → 409', async () => {
    const response = await request(env.app).patch(`/api/users/${env.admin.profile.id}`).auth(env.admin.token, { type: 'bearer' }).send({ isActive: false }).expect(409)
    expect(response.body.error).toBe('LAST_ADMIN')
    expect((await env.prisma.user.findUniqueOrThrow({ where: { id: env.admin.profile.id } })).isActive).toBe(true)
  })
  it('API-016 | PATCH /api/roles/:id no puede retirar roles.manage del último admin → 409', async () => {
    const response = await request(env.app).patch(`/api/roles/${env.adminRole.id}`).auth(env.admin.token, { type: 'bearer' }).send({ permissionKeys: ['users.manage'] }).expect(409)
    expect(response.body.error).toBe('LAST_ADMIN')
  })
  it('API-017 | POST /api/items como admin → 403', async () => {
    const response = await request(env.app).post('/api/items').auth(env.admin.token, { type: 'bearer' }).send(publication).expect(403)
    expect(response.body.error).toBe('ADMIN_MARKETPLACE_FORBIDDEN')
  })
  it('API-018 | POST /api/items como docente pendiente → 403', async () => {
    const response = await request(env.app).post('/api/items').auth(env.applicant.token, { type: 'bearer' }).send(publication).expect(403)
    expect(response.body.error).toBe('TEACHER_VERIFICATION_REQUIRED')
  })
  it('API-019 | POST /api/items incompleto → 400 sin insertar datos', async () => {
    const before = await env.prisma.item.count()
    const response = await request(env.app).post('/api/items').auth(env.student.token, { type: 'bearer' }).send({ title: 'X' }).expect(400)
    expect(response.body.error).toBe('INVALID_ITEM')
    expect(await env.prisma.item.count()).toBe(before)
  })
  it('API-020 | CRUD /api/items: crear, impedir edición ajena, actualizar y eliminar', async () => {
    const created = await request(env.app).post('/api/items').auth(env.student.token, { type: 'bearer' }).send(publication).expect(201)
    const id = created.body.item.id
    expect((await env.prisma.item.findUniqueOrThrow({ where: { id } })).ownerId).toBe(env.student.profile.id)
    await request(env.app).patch('/api/items').auth(env.other.token, { type: 'bearer' }).send({ id, title: 'No autorizado' }).expect(403)
    expect((await env.prisma.item.findUniqueOrThrow({ where: { id } })).title).toBe(publication.title)
    await request(env.app).patch('/api/items').auth(env.student.token, { type: 'bearer' }).send({ id, title: 'Microscopio actualizado' }).expect(200)
    expect((await env.prisma.item.findUniqueOrThrow({ where: { id } })).title).toBe('Microscopio actualizado')
    await request(env.app).delete('/api/items').auth(env.student.token, { type: 'bearer' }).send({ id }).expect(200)
    expect(await env.prisma.item.findUnique({ where: { id } })).toBeNull()
  })
  it('API-021 | GET /api/items oculta audiencia docente al estudiante', async () => {
    const created = await request(env.app).post('/api/items').auth(env.other.token, { type: 'bearer' }).send({ ...publication, restrictedToRoles: ['PROFESSOR'] }).expect(201)
    const response = await request(env.app).get('/api/items').auth(env.student.token, { type: 'bearer' }).expect(200)
    expect(response.body.items.some((item: { id: string }) => item.id === created.body.item.id)).toBe(false)
  })
  it('API-022 | GET /api/admin/teacher-verifications sin teachers.review → 403', async () => {
    const response = await request(env.app).get('/api/admin/teacher-verifications').auth(env.student.token, { type: 'bearer' }).expect(403)
    expect(response.body.error).toBe('FORBIDDEN')
  })
})
