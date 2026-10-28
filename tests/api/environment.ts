import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer, type Server } from 'node:http'
import { randomUUID } from 'node:crypto'

// No dotenv: override all remote targets before dynamically importing the app.
export async function setupEnvironment() {
  const root = mkdtempSync(path.join(tmpdir(), 'lendit-supertest-'))
  const data = path.join(root, 'data')
  const bin = process.env.QA_POSTGRES_BIN ?? (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '/usr/lib/postgresql/18/bin')
  const executable = (name: string) => path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''))
  function command(name: string, args: string[]) {
    const result = spawnSync(executable(name), args, { encoding: 'utf8', windowsHide: true, ...(name === 'pg_ctl' ? { stdio: 'ignore' as const } : {}) })
    if (result.error || result.status !== 0) throw new Error(`${name} failed. Check QA_POSTGRES_BIN and PostgreSQL installation. ${result.error?.message ?? result.stderr ?? ''}`)
  }
  let started = false
  let identityServer: Server | undefined
  let prisma: typeof import('../../backend/_lib/prisma.js')['prisma'] | undefined
  const identities = new Map<string, { id: string; email: string; user_metadata: Record<string, unknown> }>()
  async function cleanup() {
    if (identityServer) await new Promise<void>(resolve => identityServer!.close(() => resolve()))
    await prisma?.$disconnect()
    if (started) command('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop'])
    const resolved = path.resolve(root)
    if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('lendit-supertest-')) throw new Error('Unsafe cleanup path')
    rmSync(resolved, { recursive: true, force: true })
  }
  try {
    const reservation = createServer()
    await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve))
    const address = reservation.address()
    if (!address || typeof address === 'string') throw new Error('Port allocation failed')
    const port = address.port
    await new Promise<void>(resolve => reservation.close(() => resolve()))
    command('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale'])
    command('pg_ctl', ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-p ${port} -h 127.0.0.1`, '-w', 'start'])
    started = true
    process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${port}/postgres`
    process.env.DIRECT_URL = process.env.DATABASE_URL
    const schema = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push'], { encoding: 'utf8', windowsHide: true })
    if (schema.status !== 0) throw new Error(`Isolated schema setup failed: ${schema.stderr}`)
    identityServer = createServer((req, res) => {
      const user = identities.get((req.headers.authorization ?? '').replace(/^Bearer /, ''))
      res.setHeader('Content-Type', 'application/json')
      res.statusCode = user ? 200 : 401
      res.end(JSON.stringify(user ? { ...user, aud: 'authenticated', role: 'authenticated', app_metadata: {}, created_at: new Date().toISOString() } : { message: 'Invalid test identity' }))
    })
    await new Promise<void>(resolve => identityServer!.listen(0, '127.0.0.1', resolve))
    const identityAddress = identityServer.address()
    if (!identityAddress || typeof identityAddress === 'string') throw new Error('Identity port allocation failed')
    process.env.SUPABASE_URL = `http://127.0.0.1:${identityAddress.port}`
    process.env.SUPABASE_PUBLISHABLE_KEY = 'local-test-publishable-key'
    process.env.UNSPLASH_ACCESS_KEY = ''
    prisma = (await import('../../backend/_lib/prisma.js')).prisma
    const app = (await import('../../server/app.js')).default
    function identity(label: string, metadata: Record<string, unknown> = {}, emailOverride?: string) {
      const user = { id: randomUUID(), email: emailOverride ?? `${label}@ujap.edu.ve`, user_metadata: metadata }
      const token = randomUUID()
      identities.set(token, user)
      return { ...user, token }
    }
    const permissions = ['roles.manage', 'users.manage', 'categories.manage', 'careers.manage', 'profile.update', 'items.publish', 'items.rent', 'reviews.create']
    for (const key of permissions) await prisma.permission.create({ data: { key } })
    async function role(name: string, keys: string[]) {
      const found = await prisma!.permission.findMany({ where: { key: { in: keys } } })
      return prisma!.role.create({ data: { name, permissions: { create: found.map(p => ({ permissionId: p.id })) } } })
    }
    const adminRole = await role('ADMIN', permissions)
    const studentRole = await role('STUDENT', permissions.slice(4))
    const professorRole = await role('PROFESSOR', permissions.slice(4))
    const school = await prisma.school.create({ data: { name: 'Escuela QA' } })
    const career = await prisma.career.create({ data: { name: 'Carrera QA', schoolId: school.id } })
    await prisma.category.create({ data: { key: 'laboratorio-qa', label: 'Laboratorio QA' } })
    async function account(label: string, roleId: string, active = true) {
      const auth = identity(label)
      const profile = await prisma!.user.create({ data: { authUserId: auth.id, email: auth.email, firstName: label, lastName: 'Fixture', phone: '00000000000', roleId, schoolId: school.id, careerId: career.id, isActive: active } })
      return { ...auth, profile }
    }
    const admin = await account('admin-qa', adminRole.id)
    const student = await account('student-qa', studentRole.id)
    const other = await account('other-qa', studentRole.id)
    const disabled = await account('disabled-qa', studentRole.id, false)
    const applicant = await account('applicant-qa', studentRole.id)
    await prisma.teacherVerification.create({ data: { userId: applicant.profile.id, schoolId: school.id, status: 'PENDING' } })
    return { app, prisma, identity, admin, student, other, disabled, applicant, school, career, adminRole, studentRole, professorRole, cleanup }
  } catch (error) {
    await cleanup()
    throw error
  }
}
