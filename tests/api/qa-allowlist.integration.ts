import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setupEnvironment } from './environment.js'

describe('LendIt UJAP — QA Personal Email Allowlist (API /api/me & middleware)', () => {
  let env: Awaited<ReturnType<typeof setupEnvironment>>
  const originalNodeEnv = process.env.NODE_ENV
  const originalVercel = process.env.VERCEL
  const originalAllowlist = process.env.QA_EMAIL_ALLOWLIST

  const authorizedQaEmail = 'qa.student@example.com'
  const nonAllowlistedEmail = 'intruso.qa@example.com'
  const publication = { title: 'Tester Multímetro QA', categoryKey: 'laboratorio-qa', duration: '1 día', mode: 'LOAN' }

  let materializedQaUser: ReturnType<typeof env.identity>

  beforeAll(async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.VERCEL
    process.env.QA_EMAIL_ALLOWLIST = `${authorizedQaEmail}, otro.dev@example.com`
    env = await setupEnvironment()
  })

  afterAll(async () => {
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv
    } else {
      delete process.env.NODE_ENV
    }
    if (originalVercel !== undefined) {
      process.env.VERCEL = originalVercel
    } else {
      delete process.env.VERCEL
    }
    if (originalAllowlist !== undefined) {
      process.env.QA_EMAIL_ALLOWLIST = originalAllowlist
    } else {
      delete process.env.QA_EMAIL_ALLOWLIST
    }
    await env?.cleanup()
  })

  it('QA-API-001 | GET /api/me con correo personal NO en allowlist → 403 INSTITUTIONAL_EMAIL_REQUIRED', async () => {
    const intruder = env.identity('intruso', {}, nonAllowlistedEmail)
    const response = await request(env.app)
      .get('/api/me')
      .auth(intruder.token, { type: 'bearer' })
      .expect(403)

    expect(response.body.error).toBe('INSTITUTIONAL_EMAIL_REQUIRED')
  })

  it('QA-API-002 | GET /api/me con correo QA en allowlist y sin perfil previo → 409 PROFILE_REQUIRED', async () => {
    const qaUser = env.identity('qa-unmaterialized', {}, authorizedQaEmail)
    const response = await request(env.app)
      .get('/api/me')
      .auth(qaUser.token, { type: 'bearer' })
      .expect(409)

    expect(response.body.error).toBe('PROFILE_REQUIRED')
  })

  it('QA-API-003 | PATCH /api/me materializa usuario QA sin elevar rol a ADMIN', async () => {
    materializedQaUser = env.identity(
      'qa-new-student',
      {
        firstName: 'Estudiante',
        lastName: 'QA',
        phone: '04141234567',
        careerId: env.career.id,
        schoolId: env.school.id,
        role: 'ADMIN', // Intento de elevación por metadata que debe ser ignorado
      },
      authorizedQaEmail,
    )

    const response = await request(env.app)
      .patch('/api/me')
      .auth(materializedQaUser.token, { type: 'bearer' })
      .send({})
      .expect(200)

    expect(response.body.ok).toBe(true)
    expect(response.body.user.email).toBe(authorizedQaEmail)
    expect(response.body.user.role).toBe('STUDENT')

    // Verificar en la base de datos real que no tiene rol ADMIN
    const persisted = await env.prisma.user.findUnique({
      where: { authUserId: materializedQaUser.id },
      include: { role: true },
    })
    expect(persisted).not.toBeNull()
    expect(persisted?.role.name).toBe('STUDENT')
    expect(persisted?.roleId).toBe(env.studentRole.id)
  })

  it('QA-API-004 | GET /api/me de usuario QA materializado devuelve el perfil sin contraseña', async () => {
    const response = await request(env.app)
      .get('/api/me')
      .auth(materializedQaUser.token, { type: 'bearer' })
      .expect(200)

    expect(response.body.user.email).toBe(authorizedQaEmail)
    expect(response.body.user.role).toBe('STUDENT')
    expect(response.body.user).not.toHaveProperty('password')
  })

  it('QA-API-005 | Middleware getAuthenticatedProfile permite operaciones a usuario QA materializado', async () => {
    const response = await request(env.app)
      .post('/api/items')
      .auth(materializedQaUser.token, { type: 'bearer' })
      .send(publication)
      .expect(201)

    expect(response.body.ok).toBe(true)
    expect(response.body.item.title).toBe(publication.title)
  })

  it('QA-API-006 | Middleware rechaza usuario con correo personal no allowlisteado en /api/items', async () => {
    const intruder = env.identity('intruder-publisher', {}, nonAllowlistedEmail)
    await env.prisma.user.create({
      data: {
        authUserId: intruder.id,
        email: nonAllowlistedEmail,
        firstName: 'Intruso',
        lastName: 'Malicioso',
        phone: '04120003399',
        roleId: env.studentRole.id,
        schoolId: env.school.id,
        careerId: env.career.id,
      },
    })

    const response = await request(env.app)
      .post('/api/items')
      .auth(intruder.token, { type: 'bearer' })
      .send(publication)
      .expect(403)

    expect(response.body.error).toBe('INSTITUTIONAL_EMAIL_REQUIRED')
  })

  it('QA-API-007 | NUNCA excepción en producción: NODE_ENV=production rechaza correo QA allowlisteado', async () => {
    process.env.NODE_ENV = 'production'
    try {
      const response = await request(env.app)
        .get('/api/me')
        .auth(materializedQaUser.token, { type: 'bearer' })
        .expect(403)

      expect(response.body.error).toBe('INSTITUTIONAL_EMAIL_REQUIRED')
    } finally {
      process.env.NODE_ENV = 'development'
    }
  })

  it('QA-API-008 | NUNCA excepción en Vercel: VERCEL=1 rechaza correo QA allowlisteado', async () => {
    process.env.VERCEL = '1'
    try {
      const response = await request(env.app)
        .get('/api/me')
        .auth(materializedQaUser.token, { type: 'bearer' })
        .expect(403)

      expect(response.body.error).toBe('INSTITUTIONAL_EMAIL_REQUIRED')
    } finally {
      delete process.env.VERCEL
    }
  })

  it('QA-API-009 | Allowlist vacía rechaza correo QA personal', async () => {
    const saved = process.env.QA_EMAIL_ALLOWLIST
    process.env.QA_EMAIL_ALLOWLIST = ''
    try {
      const response = await request(env.app)
        .get('/api/me')
        .auth(materializedQaUser.token, { type: 'bearer' })
        .expect(403)

      expect(response.body.error).toBe('INSTITUTIONAL_EMAIL_REQUIRED')
    } finally {
      process.env.QA_EMAIL_ALLOWLIST = saved
    }
  })
})
