/** Isolated PostgreSQL + real HTTP handlers. Never loads .env or contacts Supabase. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer, type Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import express from 'express'

const root = mkdtempSync(path.join(tmpdir(), 'lendit-admin-qa-'))
const data = path.join(root, 'data')
const bin = process.env.QA_POSTGRES_BIN ?? 'C:/Program Files/PostgreSQL/18/bin'
const port = 55439
let started = false
let authServer: Server | undefined
let apiServer: Server | undefined
let db: { $disconnect(): Promise<void> } | undefined
function command(executable: string, args: string[], env = process.env) {
  const result = spawnSync(executable, args, { env, encoding: 'utf8', windowsHide: true, ...(executable.endsWith('pg_ctl.exe') ? { stdio: 'ignore' as const } : {}) })
  if (result.error || result.status !== 0) throw new Error(`${path.basename(executable)} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`)
}
async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return `http://127.0.0.1:${address.port}`
}
async function close(server?: Server) {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
}

try {
  command(path.join(bin, 'initdb.exe'), ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale'])
  command(path.join(bin, 'pg_ctl.exe'), ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-p ${port} -h 127.0.0.1`, '-w', 'start'])
  started = true
  // Override inherited remote URLs before importing any application module.
  process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${port}/postgres`
  process.env.DIRECT_URL = process.env.DATABASE_URL
  process.env.NODE_ENV = 'test'
  command(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push'], process.env)

  const identities = new Map<string, string>()
  authServer = createServer((req, res) => {
    const id = identities.get((req.headers.authorization ?? '').replace(/^Bearer /, ''))
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = id ? 200 : 401
    res.end(JSON.stringify(id ? { id, aud: 'authenticated', role: 'authenticated', email: `${id}@ujap.edu.ve`, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } : { message: 'Unauthorized' }))
  })
  process.env.SUPABASE_URL = await listen(authServer)
  process.env.SUPABASE_PUBLISHABLE_KEY = 'isolated-test-key'
  const { prisma } = await import('../api/_lib/prisma.js')
  db = prisma
  const { default: users } = await import('../api/users/[id].js')
  const { default: roles } = await import('../api/roles/[id].js')
  const app = express()
  app.use(express.json())
  for (const [route, handler] of [['users', users], ['roles', roles]] as const) {
    app.patch(`/api/${route}/:id`, async (req, res) => {
      await handler({ method: req.method, headers: req.headers, body: req.body, query: { id: String(req.params.id) } }, res)
    })
  }
  apiServer = createServer(app)
  const base = await listen(apiServer)
  const manageRoles = await prisma.permission.create({ data: { key: 'roles.manage' } })
  const manageUsers = await prisma.permission.create({ data: { key: 'users.manage' } })
  const student = await prisma.role.create({ data: { name: 'STUDENT' } })
  async function admin(label: string) {
    const role = await prisma.role.create({ data: { name: label, permissions: { create: [{ permissionId: manageRoles.id }, { permissionId: manageUsers.id }] } } })
    const authUserId = randomUUID()
    const user = await prisma.user.create({ data: { authUserId, email: `${label}@ujap.edu.ve`, firstName: label, lastName: 'Fixture', phone: '000', roleId: role.id } })
    const token = randomUUID()
    identities.set(token, authUserId)
    return { user, role, token }
  }
  const a = await admin('QA_A')
  const b = await admin('QA_B')
  async function reset() {
    for (const fixture of [a, b]) {
      await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: fixture.role.id, permissionId: manageRoles.id } }, create: { roleId: fixture.role.id, permissionId: manageRoles.id }, update: {} })
      await prisma.user.update({ where: { id: fixture.user.id }, data: { roleId: fixture.role.id, isActive: true } })
    }
  }
  async function request(route: string, token: string, body: unknown) {
    const response = await fetch(`${base}${route}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { status: response.status, body: await response.json() as { error?: string } }
  }
  async function count() {
    return prisma.user.count({ where: { isActive: true, role: { permissions: { some: { permission: { key: 'roles.manage' } } } } } })
  }
  // Acquire the same transaction lock first: both requests authenticate while there
  // are two admins, then wait behind the barrier. This exercises the DB race itself.
  async function race(first: () => ReturnType<typeof request>, second: () => ReturnType<typeof request>) {
    let release!: () => void
    let locked!: () => void
    const ready = new Promise<void>(resolve => { locked = resolve })
    const gate = new Promise<void>(resolve => { release = resolve })
    const barrier = prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(727001)')
      locked()
      await gate
    }, { timeout: 10000 })
    await ready
    const pending = [first(), second()]
    await new Promise(resolve => setTimeout(resolve, 250))
    release()
    await barrier
    const results = await Promise.all(pending)
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409])
    assert.equal(results.find(r => r.status === 409)?.body.error, 'LAST_ADMIN')
    assert.equal(await count(), 1)
  }
  let checks = 0
  await prisma.user.update({ where: { id: b.user.id }, data: { isActive: false } })
  for (const body of [{ isActive: false }, { roleId: student.id }]) {
    const result = await request(`/api/users/${a.user.id}`, a.token, body)
    assert.equal(result.status, 409)
    assert.equal(result.body.error, 'LAST_ADMIN')
    assert.equal(await count(), 1)
    checks++
  }
  const remove = await request(`/api/roles/${a.role.id}`, a.token, { permissionKeys: ['users.manage'] })
  assert.equal(remove.status, 409)
  assert.equal(remove.body.error, 'LAST_ADMIN')
  assert.equal(await count(), 1)
  checks++
  for (let iteration = 0; iteration < 5; iteration++) {
    for (const scenario of ['deactivate', 'demote', 'permissions', 'mixed']) {
      await reset()
      const userBody = scenario === 'demote' ? { roleId: student.id } : { isActive: false }
      await race(
        () => request(scenario === 'permissions' ? `/api/roles/${a.role.id}` : `/api/users/${a.user.id}`, a.token, scenario === 'permissions' ? { permissionKeys: ['users.manage'] } : userBody),
        () => request(['permissions', 'mixed'].includes(scenario) ? `/api/roles/${b.role.id}` : `/api/users/${b.user.id}`, b.token, ['permissions', 'mixed'].includes(scenario) ? { permissionKeys: ['users.manage'] } : userBody),
      )
      checks++
      console.log(`PASS ${scenario} race ${iteration + 1}: HTTP 200 + 409 LAST_ADMIN, exactly one active admin`)
    }
  }
  console.log(`PASS: ${checks} checks; real HTTP handlers + temporary PostgreSQL; identity provider simulated locally; no remote services used.`)
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await close(apiServer)
  await close(authServer)
  await db?.$disconnect()
  if (started) command(path.join(bin, 'pg_ctl.exe'), ['-D', data, '-m', 'immediate', '-w', 'stop'])
  const resolved = path.resolve(root)
  if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('lendit-admin-qa-')) throw new Error('Unsafe cleanup path')
  rmSync(resolved, { recursive: true, force: true })
}
