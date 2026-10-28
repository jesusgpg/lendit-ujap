import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setupEnvironment } from './environment.js'

describe('LendIt UJAP — bloqueo de correos personales', () => {
  let env: Awaited<ReturnType<typeof setupEnvironment>>
  const originalNodeEnv = process.env.NODE_ENV
  const originalVercel = process.env.VERCEL
  const originalAllowlist = process.env.QA_EMAIL_ALLOWLIST

  beforeAll(async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.VERCEL
    process.env.QA_EMAIL_ALLOWLIST = 'qa.student@gmail.com,qa.student@hotmail.com'
    env = await setupEnvironment()
  })

  afterAll(async () => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    if (originalVercel === undefined) delete process.env.VERCEL
    else process.env.VERCEL = originalVercel
    if (originalAllowlist === undefined) delete process.env.QA_EMAIL_ALLOWLIST
    else process.env.QA_EMAIL_ALLOWLIST = originalAllowlist
    await env?.cleanup()
  })

  it.each(['qa.student@gmail.com', 'qa.student@hotmail.com', 'qa.student@outlook.com'])(
    'GET /api/me rechaza %s incluso si está en la antigua lista QA',
    async email => {
      const identity = env.identity('personal-email', {}, email)
      const response = await request(env.app)
        .get('/api/me')
        .auth(identity.token, { type: 'bearer' })
        .expect(403)

      expect(response.body.error).toBe('INSTITUTIONAL_EMAIL_REQUIRED')
    },
  )

  it('no materializa un perfil cuando intentan registrarse con Gmail', async () => {
    const identity = env.identity('gmail-signup', {
      firstName: 'Cuenta',
      lastName: 'Personal',
      phone: '04140000000',
      role: 'ADMIN',
    }, 'qa.student@gmail.com')

    const response = await request(env.app)
      .patch('/api/me')
      .auth(identity.token, { type: 'bearer' })
      .send({})
      .expect(403)

    expect(response.body.error).toBe('INSTITUTIONAL_EMAIL_REQUIRED')
    expect(await env.prisma.user.findUnique({ where: { authUserId: identity.id } })).toBeNull()
  })

  it('rechaza operaciones incluso si existe un perfil legado con Hotmail', async () => {
    const identity = env.identity('hotmail-legacy', {}, 'legacy@hotmail.com')
    await env.prisma.user.create({
      data: {
        authUserId: identity.id,
        email: identity.email,
        firstName: 'Cuenta',
        lastName: 'Legada',
        phone: '04140000001',
        roleId: env.studentRole.id,
        schoolId: env.school.id,
        careerId: env.career.id,
      },
    })

    const response = await request(env.app)
      .post('/api/items')
      .auth(identity.token, { type: 'bearer' })
      .send({ title: 'Multímetro de prueba', categoryKey: 'laboratorio-qa', duration: '1 día', mode: 'LOAN' })
      .expect(403)

    expect(response.body.error).toBe('INSTITUTIONAL_EMAIL_REQUIRED')
  })

  it('permite materializar el perfil con correo @ujap.edu.ve', async () => {
    const identity = env.identity('institutional-student', {
      firstName: 'Estudiante',
      lastName: 'UJAP',
      phone: '04140000002',
      careerId: env.career.id,
      schoolId: env.school.id,
    }, 'alumno.prueba@ujap.edu.ve')

    const response = await request(env.app)
      .patch('/api/me')
      .auth(identity.token, { type: 'bearer' })
      .send({})
      .expect(200)

    expect(response.body.user.email).toBe('alumno.prueba@ujap.edu.ve')
    expect(response.body.user.role).toBe('STUDENT')
  })
})
