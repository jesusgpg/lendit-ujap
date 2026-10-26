import 'dotenv/config'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '../backend/_lib/prisma.ts'

const BASE_URL = 'http://localhost:8787'

const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
])

type TestResult = { name: string; duration: number; passed: boolean; skipped?: boolean; details?: string }
const results: TestResult[] = []
const PROTECTED_USER_IDS = new Set<string>()
const testItemIds: string[] = []

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now()
  process.stdout.write(`  ⏳ ${name}...`)
  try {
    await fn()
    const duration = Date.now() - start
    results.push({ name, duration, passed: true })
    console.log(`\r  ✓ [PASS] ${name} (${duration}ms)`)
  } catch (err) {
    const duration = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    results.push({ name, duration, passed: false, details: msg })
    console.log(`\r  ✗ [FAIL] ${name} (${duration}ms): ${msg}`)
  }
}

function skipTest(name: string, reason: string) {
  results.push({ name, duration: 0, passed: true, skipped: true, details: reason })
  console.log(`  ⚠ [PENDIENTE / OMITIDO POR SEGURIDAD] ${name}\n      Motivo: ${reason}`)
}

function expectEqual(actual: unknown, expected: unknown, label = 'assertion') {
  if (actual !== expected) {
    throw new Error(`Expected ${label} to be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function expectTrue(condition: boolean, label = 'condition') {
  if (!condition) {
    throw new Error(`Expected ${label} to be true`)
  }
}

async function request(path: string, options: RequestInit = {}, token?: string) {
  const method = (options.method || 'GET').toUpperCase()

  // STRICT SECURITY GUARD: Block any mutation directed to protected personal accounts
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    for (const id of PROTECTED_USER_IDS) {
      if (path.includes(id)) {
        throw new Error(`SECURITY FATAL: Blocked attempted mutation against protected account ${id} on path ${path}`)
      }
    }
  }

  const headers = new Headers(options.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
      const text = await res.text()
      let json: any = null
      try {
        json = JSON.parse(text)
      } catch {
        json = null
      }
      return { status: res.status, headers: res.headers, text, json }
    } catch (err) {
      if (attempt === 3) throw err
      await new Promise((r) => setTimeout(r, 300 * attempt))
    }
  }
  throw new Error('Request unreachable')
}

async function main() {
  console.log('=== SUITE COMPLETA DE QA: VALIDACIÓN DOCENTE Y MUTACIONES SEGURAS ===\n')

  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseAnon = process.env.SUPABASE_PUBLISHABLE_KEY!
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY!

  const teacherEmail = process.env.QA_TEACHER_EMAIL!
  const teacherPassword = process.env.QA_TEACHER_PASSWORD!
  const studentEmail = process.env.QA_STUDENT_EMAIL!
  const studentPassword = process.env.QA_STUDENT_PASSWORD!

  // Distinct Supabase clients to avoid cross-contamination of auth sessions
  const teacherClient = createClient(supabaseUrl, supabaseAnon)
  const studentClient = createClient(supabaseUrl, supabaseAnon)
  const adminClient = createClient(supabaseUrl, supabaseAnon)
  const serviceClient = createClient(supabaseUrl, supabaseSecret)

  // 1. Authenticate users
  const { data: teacherAuth, error: tErr } = await teacherClient.auth.signInWithPassword({
    email: teacherEmail,
    password: teacherPassword,
  })
  if (tErr || !teacherAuth.session) throw new Error(`Teacher login failed: ${tErr?.message}`)
  const teacherToken = teacherAuth.session.access_token
  const teacherAuthId = teacherAuth.user.id

  const { data: studentAuth, error: sErr } = await studentClient.auth.signInWithPassword({
    email: studentEmail,
    password: studentPassword,
  })
  if (sErr || !studentAuth.session) throw new Error(`Student login failed: ${sErr?.message}`)
  const studentToken = studentAuth.session.access_token
  const studentAuthId = studentAuth.user.id

  // Admin token generated via magiclink token_hash without modifying password
  const adminDbUser = await prisma.user.findFirstOrThrow({
    where: { role: { name: 'ADMIN' }, isActive: true },
    select: { id: true, email: true, authUserId: true },
  })

  // Load and register protected personal user IDs in blacklist
  const protectedUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: ['jesusp2095@gmail.com', 'jpena@ujap.edu.ve', 'jpena13@ujap.edu.ve'] } },
        { role: { name: 'ADMIN' } },
      ],
    },
    select: { id: true, email: true },
  })
  for (const u of protectedUsers) {
    PROTECTED_USER_IDS.add(u.id)
  }

  const { data: adminMagicLink, error: adminLinkErr } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email: adminDbUser.email,
  })
  if (adminLinkErr || !adminMagicLink.properties?.hashed_token) {
    throw new Error(`Admin link gen failed: ${adminLinkErr?.message}`)
  }
  const { data: adminAuth, error: adminVerifyErr } = await adminClient.auth.verifyOtp({
    token_hash: adminMagicLink.properties.hashed_token,
    type: 'magiclink',
  })
  if (adminVerifyErr || !adminAuth.session) {
    throw new Error(`Admin session failed: ${adminVerifyErr?.message}`)
  }
  const adminToken = adminAuth.session.access_token

  console.log(`Usuarios autenticados:`)
  console.log(`  Admin:   ${adminDbUser.email} (DB ID: ${adminDbUser.id}) [PROTEGIDO]`)
  console.log(`  Docente: ${teacherEmail} (Auth: ${teacherAuthId})`)
  console.log(`  Alumno:  ${studentEmail} (Auth: ${studentAuthId})`)
  console.log(`  Cuentas protegidas contra mutación: ${PROTECTED_USER_IDS.size}\n`)

  // Preload DB schools and careers
  const schools = await prisma.school.findMany({ include: { careers: true } })
  const school1 = schools[0]
  const school2 = schools.length > 1 ? schools[1] : schools[0]
  const career1 = school1.careers[0]
  const careerSchool2 = school2.careers[0]

  const category = await prisma.category.findFirstOrThrow({ select: { id: true, key: true } })

  // Initialize teacher QA fixture to a clean initial state (DRAFT)
  const studentRole = await prisma.role.findUniqueOrThrow({ where: { name: 'STUDENT' } })
  await prisma.user.updateMany({
    where: { email: teacherEmail },
    data: { roleId: studentRole.id },
  })
  await prisma.teacherVerification.updateMany({
    where: { user: { email: teacherEmail } },
    data: {
      status: 'DRAFT',
      rejectionReason: null,
      documentPath: null,
    },
  })

  // =========================================================================
  console.log('--- 1. Validación de Perfil y Rechazo de Incompatibilidades ---')
  // =========================================================================

  await test('Estudiante requiere carrera (carrera no puede quedar vacía o nula)', async () => {
    const res = await request('/api/me', {
      method: 'PATCH',
      body: JSON.stringify({ careerId: null }),
    }, studentToken)
    expectTrue(res.status === 400 || res.status === 422, 'status is 400 or 422')
    expectTrue(
      res.json?.error === 'CAREER_REQUIRED' || res.json?.error === 'CAREER_REQUIRED_FOR_STUDENT',
      'error code indicates career required'
    )
  })

  await test('Rechazo cuando carrera no pertenece a la escuela indicada (mismatch)', async () => {
    const res = await request('/api/me', {
      method: 'PATCH',
      body: JSON.stringify({
        schoolId: school1.id,
        careerId: careerSchool2.id,
      }),
    }, teacherToken)
    expectEqual(res.status, 400, 'status')
    expectEqual(res.json?.error, 'CAREER_SCHOOL_MISMATCH', 'error code')
  })

  await test('Rechazo de documentPath con path traversal (..) o fuera de la carpeta propia', async () => {
    const res = await request('/api/teacher-verifications/me', {
      method: 'POST',
      body: JSON.stringify({
        schoolId: school1.id,
        documentPath: `../other-folder/secret.png`,
      }),
    }, teacherToken)
    expectEqual(res.status, 400, 'status')
    expectEqual(res.json?.error, 'INVALID_DOCUMENT_PATH', 'error code')
  })

  // =========================================================================
  console.log('\n--- 2. Aislamiento de Storage y Validación de Contenido Real ---')
  // =========================================================================

  await test('Rechazo cuando el archivo referenciado NO existe realmente en storage', async () => {
    const fakePath = `${teacherAuthId}/non-existent-file-${Date.now()}.png`
    const res = await request('/api/teacher-verifications/me', {
      method: 'POST',
      body: JSON.stringify({
        schoolId: school1.id,
        documentPath: fakePath,
      }),
    }, teacherToken)
    expectEqual(res.status, 400, 'status')
    expectEqual(res.json?.error, 'CREDENTIAL_DOCUMENT_NOT_FOUND', 'error code')
  })

  const badPath = `${teacherAuthId}/bad-content-${Date.now()}.png`
  await test('Rechazo de archivo que no sea imagen real (contenido inválido/texto)', async () => {
    await serviceClient.storage
      .from('teacher-credentials')
      .upload(badPath, Buffer.from('ESTO ES TEXTO NO UNA IMAGEN'), {
        contentType: 'image/png',
        upsert: true,
      })

    const res = await request('/api/teacher-verifications/me', {
      method: 'POST',
      body: JSON.stringify({
        schoolId: school1.id,
        documentPath: badPath,
      }),
    }, teacherToken)
    expectEqual(res.status, 400, 'status')
    expectEqual(res.json?.error, 'INVALID_IMAGE_CONTENT', 'error code')
  })

  const validPath = `${teacherAuthId}/valid-credential-${Date.now()}.png`
  let currentVerificationVersion = 1
  await test('Carga de imagen PNG válida y creación de TeacherCredentialSubmission con SHA256', async () => {
    const { error: upErr } = await serviceClient.storage
      .from('teacher-credentials')
      .upload(validPath, VALID_PNG_BUFFER, {
        contentType: 'image/png',
        upsert: true,
      })
    if (upErr) throw upErr

    const currentRecord = await prisma.teacherVerification.findFirst({
      where: { user: { authUserId: teacherAuthId } },
      orderBy: { version: 'desc' },
    })
    const expectedVer = currentRecord?.version ?? 1

    const res = await request('/api/teacher-verifications/me', {
      method: 'POST',
      body: JSON.stringify({
        schoolId: school1.id,
        department: 'Cátedra de Arquitectura',
        careerId: career1.id,
        documentPath: validPath,
        expectedVersion: expectedVer,
      }),
    }, teacherToken)

    expectEqual(res.status, 200, 'status')
    expectEqual(res.json?.verification?.status, 'PENDING', 'status is PENDING')
    currentVerificationVersion = res.json?.verification?.version
    expectTrue(currentVerificationVersion >= 1, 'Version is valid')

    // Verify TeacherCredentialSubmission snapshot in DB
    const submission = await prisma.teacherCredentialSubmission.findFirst({
      where: {
        verificationId: res.json?.verification?.id,
        version: currentVerificationVersion,
      },
    })
    expectTrue(!!submission, 'Submission snapshot exists in DB')
    expectEqual(submission?.documentMime, 'image/png', 'Mime is image/png')
    expectEqual(submission?.documentBytes, VALID_PNG_BUFFER.length, 'Bytes match')

    const expectedHash = crypto.createHash('sha256').update(VALID_PNG_BUFFER).digest('hex')
    expectEqual(submission?.documentSha256, expectedHash, 'SHA256 matches')
  })

  await test('Aislamiento Storage RLS: Alumno no puede descargar la credencial privada del profesor', async () => {
    const { data, error } = await studentClient.storage
      .from('teacher-credentials')
      .download(validPath)
    expectTrue(!data || !!error, 'Student cannot download teacher credential directly')
  })

  // =========================================================================
  console.log('\n--- 3. Ciclo de Vida: Corrección, Rechazo, Reenvío y Concurrencia CAS ---')
  // =========================================================================

  await test('Intento de reenvío mientras está PENDING es rechazado con 409 ALREADY_PENDING', async () => {
    const res = await request('/api/teacher-verifications/me', {
      method: 'POST',
      body: JSON.stringify({
        schoolId: school1.id,
        documentPath: validPath,
        expectedVersion: currentVerificationVersion,
      }),
    }, teacherToken)
    expectEqual(res.status, 409, 'status')
    expectEqual(res.json?.error, 'ALREADY_PENDING', 'error code')
  })

  await test('Usuario sin permiso teachers.review recibe 403 FORBIDDEN en endpoints de revisión', async () => {
    const res = await request('/api/admin/teacher-verifications', { method: 'GET' }, studentToken)
    expectEqual(res.status, 403, 'status')
  })

  let verificationId = ''
  await test('Admin solicita corrección con motivo explicativo -> pasa a NEEDS_CORRECTION', async () => {
    const listRes = await request('/api/admin/teacher-verifications?status=PENDING', { method: 'GET' }, adminToken)
    expectEqual(listRes.status, 200, 'list status')
    const item = listRes.json?.data?.find((d: any) => d.applicant?.email === teacherEmail)
    expectTrue(!!item, 'Item in pending list')
    verificationId = item.id

    const decRes = await request(`/api/admin/teacher-verifications/${verificationId}/decision`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'REQUEST_CORRECTION',
        reason: 'La imagen presenta brillo excesivo en la esquina superior.',
        expectedVersion: item.version,
      }),
    }, adminToken)
    expectEqual(decRes.status, 200, 'decision status')
    const decisionStatus1 = decRes.json?.status ?? decRes.json?.verification?.status
    expectEqual(decisionStatus1, 'NEEDS_CORRECTION', 'status is NEEDS_CORRECTION')
    currentVerificationVersion = decRes.json?.version ?? decRes.json?.verification?.version
  })

  await test('Docente corrige datos y reenvía a revisión -> pasa a PENDING con versión incrementada', async () => {
    const res = await request('/api/teacher-verifications/me', {
      method: 'POST',
      body: JSON.stringify({
        schoolId: school1.id,
        department: 'Cátedra de Arquitectura del Software',
        documentPath: validPath,
        expectedVersion: currentVerificationVersion,
      }),
    }, teacherToken)
    expectEqual(res.status, 200, 'resubmit status')
    expectEqual(res.json?.verification?.status, 'PENDING', 'status is PENDING')
    currentVerificationVersion = res.json?.verification?.version
  })

  await test('Admin rechaza postulación con motivo -> pasa a REJECTED', async () => {
    const decRes = await request(`/api/admin/teacher-verifications/${verificationId}/decision`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'REJECT',
        reason: 'El documento no corresponde a la credencial institucional docente vigente.',
        expectedVersion: currentVerificationVersion,
      }),
    }, adminToken)
    expectEqual(decRes.status, 200, 'reject status')
    const decisionStatus2 = decRes.json?.status ?? decRes.json?.verification?.status
    expectEqual(decisionStatus2, 'REJECTED', 'status is REJECTED')
    currentVerificationVersion = decRes.json?.version ?? decRes.json?.verification?.version
  })

  await test('Docente subsana rechazo y reenvía -> pasa a PENDING nuevamente', async () => {
    const res = await request('/api/teacher-verifications/me', {
      method: 'POST',
      body: JSON.stringify({
        schoolId: school1.id,
        department: 'Cátedra de Arquitectura del Software',
        careerId: career1.id,
        documentPath: validPath,
        expectedVersion: currentVerificationVersion,
      }),
    }, teacherToken)
    expectEqual(res.status, 200, 'resubmit status')
    expectEqual(res.json?.verification?.status, 'PENDING', 'status is PENDING')
    currentVerificationVersion = res.json?.verification?.version
  })

  await test('Concurrencia real CAS: Decisiones concurrentes con la misma expectedVersion -> una gana, otra 409', async () => {
    const [d1, d2] = await Promise.all([
      request(`/api/admin/teacher-verifications/${verificationId}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'APPROVE',
          reason: 'Aprobación concurrente 1.',
          expectedVersion: currentVerificationVersion,
        }),
      }, adminToken),
      request(`/api/admin/teacher-verifications/${verificationId}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'APPROVE',
          reason: 'Aprobación concurrente 2.',
          expectedVersion: currentVerificationVersion,
        }),
      }, adminToken),
    ])

    const statuses = [d1.status, d2.status].sort()
    expectEqual(statuses[0], 200, 'First concurrent decision succeeds (200)')
    expectEqual(statuses[1], 409, 'Second concurrent decision receives conflict (409)')

    // Verify final state is APPROVED and role is PROFESSOR
    const meRes = await request('/api/me', { method: 'GET' }, teacherToken)
    expectEqual(meRes.json?.user?.role, 'PROFESSOR', 'Teacher role is now PROFESSOR')
    expectEqual(meRes.json?.user?.teacherVerification?.status, 'APPROVED', 'Verification status is APPROVED')
  })

  // =========================================================================
  console.log('\n--- 4. Audiencias de Publicaciones y Restricciones de Solicitantes ---')
  // =========================================================================

  let studentOnlyItemId = ''
  let professorOnlyItemId = ''
  let publicItemId = ''

  await test('Crear ítems con audiencias: Solo Estudiantes, Solo Profesores y Pública', async () => {
    // 1. Student publishes student-only item
    const res1 = await request('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        title: `Guía Exclusiva Estudiantes QA ${Date.now()}`,
        categoryKey: category.key,
        duration: '3 días',
        mode: 'LOAN',
        restrictedToRoles: ['STUDENT'],
      }),
    }, studentToken)
    expectEqual(res1.status, 201, 'Student item create status')
    studentOnlyItemId = res1.json?.item?.id
    testItemIds.push(studentOnlyItemId)

    // 2. Professor publishes professor-only item
    const res2 = await request('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        title: `Proyector Docente QA ${Date.now()}`,
        categoryKey: category.key,
        duration: '1 día',
        mode: 'LOAN',
        restrictedToRoles: ['PROFESSOR'],
      }),
    }, teacherToken)
    expectEqual(res2.status, 201, 'Teacher item create status')
    professorOnlyItemId = res2.json?.item?.id
    testItemIds.push(professorOnlyItemId)

    // 3. Student publishes public item
    const res3 = await request('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        title: `Calculadora Científica Pública QA ${Date.now()}`,
        categoryKey: category.key,
        duration: '5 días',
        mode: 'LOAN',
        restrictedToRoles: [],
      }),
    }, studentToken)
    expectEqual(res3.status, 201, 'Public item create status')
    publicItemId = res3.json?.item?.id
    testItemIds.push(publicItemId)
  })

  await test('Estudiante en catálogo NO ve ítem exclusivo de profesores', async () => {
    const res = await request('/api/items', { method: 'GET' }, studentToken)
    expectEqual(res.status, 200, 'catalog status')
    const found = res.json?.items?.some((i: any) => i.id === professorOnlyItemId)
    expectEqual(found, false, 'professor item not in student catalog')
  })

  await test('Profesor en catálogo NO ve ítem exclusivo de estudiantes', async () => {
    const res = await request('/api/items', { method: 'GET' }, teacherToken)
    expectEqual(res.status, 200, 'catalog status')
    const found = res.json?.items?.some((i: any) => i.id === studentOnlyItemId)
    expectEqual(found, false, 'student item not in teacher catalog')
  })

  await test('Estudiante intentando pedir ítem de profesores vía HTTP directo recibe 403', async () => {
    const startsAt = new Date(Date.now() + 3600000).toISOString()
    const endsAt = new Date(Date.now() + 86400000 * 2).toISOString()
    const res = await request('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        resource: 'request',
        itemId: professorOnlyItemId,
        startsAt,
        endsAt,
      }),
    }, studentToken)
    expectEqual(res.status, 403, 'status')
  })

  await test('Profesor intentando pedir ítem de estudiantes vía HTTP directo recibe 403', async () => {
    const startsAt = new Date(Date.now() + 3600000).toISOString()
    const endsAt = new Date(Date.now() + 86400000 * 2).toISOString()
    const res = await request('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        resource: 'request',
        itemId: studentOnlyItemId,
        startsAt,
        endsAt,
      }),
    }, teacherToken)
    expectEqual(res.status, 403, 'status')
  })

  // =========================================================================
  console.log('\n--- 5. Interacciones Bidireccionales Completas Hasta Devolución ---')
  // =========================================================================

  // Caso 1: Profesor solicita PRÉSTAMO a Estudiante -> Aprobación -> Devolución
  let loanId1 = ''
  await test('Profesor pide préstamo a Estudiante -> Aprobación -> Devolución exitosa', async () => {
    const startsAt = new Date(Date.now() + 3600000).toISOString()
    const endsAt = new Date(Date.now() + 86400000 * 2).toISOString()

    const reqRes = await request('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        resource: 'request',
        itemId: publicItemId,
        startsAt,
        endsAt,
        message: 'Hola, requiero la calculadora para el laboratorio.',
      }),
    }, teacherToken)
    expectEqual(reqRes.status, 201, 'Request created')
    const requestId = reqRes.json?.request?.id

    const appRes = await request('/api/items', {
      method: 'PATCH',
      body: JSON.stringify({
        resource: 'request',
        action: 'approve',
        requestId,
      }),
    }, studentToken)
    expectEqual(appRes.status, 200, 'Request approved')
    loanId1 = appRes.json?.request?.loan?.id
    expectTrue(!!loanId1, 'Active loan created')

    const retRes = await request('/api/items', {
      method: 'PATCH',
      body: JSON.stringify({
        resource: 'request',
        action: 'return',
        loanId: loanId1,
      }),
    }, teacherToken)
    expectEqual(retRes.status, 200, 'Return status')
    expectEqual(retRes.json?.request?.loan?.status, 'RETURNED', 'Loan status is RETURNED')

    const itemDb = await prisma.item.findUniqueOrThrow({ where: { id: publicItemId } })
    expectEqual(itemDb.status, 'AVAILABLE', 'Item back to AVAILABLE')
  })

  // Caso 2: Estudiante solicita PRÉSTAMO a Profesor -> Aprobación -> Devolución
  await test('Estudiante pide préstamo a Profesor -> Aprobación -> Devolución exitosa', async () => {
    // 1. Profesor publica ítem en modo préstamo
    const pubRes = await request('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        title: `Libro de Algoritmos Docente QA ${Date.now()}`,
        categoryKey: category.key,
        duration: '4 días',
        mode: 'LOAN',
        restrictedToRoles: [],
      }),
    }, teacherToken)
    expectEqual(pubRes.status, 201, 'Teacher loan item created')
    const teacherLoanItemId = pubRes.json?.item?.id
    testItemIds.push(teacherLoanItemId)

    // 2. Estudiante solicita préstamo
    const startsAt = new Date(Date.now() + 3600000).toISOString()
    const endsAt = new Date(Date.now() + 86400000 * 3).toISOString()
    const reqRes = await request('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        resource: 'request',
        itemId: teacherLoanItemId,
        startsAt,
        endsAt,
        message: 'Profesor, solicito el libro para estudiar la unidad.',
      }),
    }, studentToken)
    expectEqual(reqRes.status, 201, 'Loan request created')
    const requestId = reqRes.json?.request?.id

    // 3. Profesor aprueba
    const appRes = await request('/api/items', {
      method: 'PATCH',
      body: JSON.stringify({
        resource: 'request',
        action: 'approve',
        requestId,
      }),
    }, teacherToken)
    expectEqual(appRes.status, 200, 'Loan approved by professor')
    const loanId = appRes.json?.request?.loan?.id
    expectTrue(!!loanId, 'Loan active')

    // 4. Devolución
    const retRes = await request('/api/items', {
      method: 'PATCH',
      body: JSON.stringify({
        resource: 'request',
        action: 'return',
        loanId,
      }),
    }, studentToken)
    expectEqual(retRes.status, 200, 'Loan returned')
    expectEqual(retRes.json?.request?.loan?.status, 'RETURNED', 'Loan is RETURNED')
  })

  // Caso 3: Estudiante solicita ALQUILER a Profesor con pago simulado -> Aprobación -> Devolución
  let rentalItemId = ''
  let rentalRequestId = ''
  let loanId2 = ''
  await test('Estudiante pide alquiler a Profesor con pago simulado -> Aprobación -> Devolución', async () => {
    // 1. Profesor publica objeto en modo alquiler
    const pubRes = await request('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        title: `Osciloscopio Portátil QA ${Date.now()}`,
        categoryKey: category.key,
        duration: '2 días',
        mode: 'RENTAL',
        price: 15.00,
        currency: 'USD',
      }),
    }, teacherToken)
    expectEqual(pubRes.status, 201, 'Rental item created')
    rentalItemId = pubRes.json?.item?.id
    testItemIds.push(rentalItemId)

    // 2. Estudiante solicita alquiler
    const startsAt = new Date(Date.now() + 3600000).toISOString()
    const endsAt = new Date(Date.now() + 86400000 * 2).toISOString()
    const rentReqRes = await request('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        resource: 'request',
        itemId: rentalItemId,
        startsAt,
        endsAt,
        message: 'Alquiler para práctica de electrónica.',
      }),
    }, studentToken)
    expectEqual(rentReqRes.status, 201, 'Rental request created')
    rentalRequestId = rentReqRes.json?.request?.id

    // 3. Estudiante simula el pago
    const payRes = await request('/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        requestId: rentalRequestId,
        outcome: 'success',
        paymentMethod: 'campus_balance',
      }),
    }, studentToken)
    expectEqual(payRes.status, 200, 'Payment simulation status')
    expectEqual(payRes.json?.payment?.status, 'SIMULATED_PAID', 'SIMULATED_PAID')

    // 4. Profesor aprueba alquiler pagado (préstamo activo)
    const appRes = await request('/api/items', {
      method: 'PATCH',
      body: JSON.stringify({
        resource: 'request',
        action: 'approve',
        requestId: rentalRequestId,
      }),
    }, teacherToken)
    expectEqual(appRes.status, 200, 'Rental approval')
    loanId2 = appRes.json?.request?.loan?.id
    expectTrue(!!loanId2, 'Loan created')
  })

  // Caso 4: Profesor solicita ALQUILER a Estudiante con pago simulado -> Aprobación -> Devolución
  await test('Profesor pide alquiler a Estudiante con pago simulado -> Aprobación -> Devolución', async () => {
    // 1. Estudiante publica objeto en alquiler
    const pubRes = await request('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        title: `Multímetro Digital Estudiante QA ${Date.now()}`,
        categoryKey: category.key,
        duration: '1 día',
        mode: 'RENTAL',
        price: 8.00,
        currency: 'USD',
      }),
    }, studentToken)
    expectEqual(pubRes.status, 201, 'Student rental item created')
    const studentRentalItemId = pubRes.json?.item?.id
    testItemIds.push(studentRentalItemId)

    // 2. Profesor solicita alquiler
    const startsAt = new Date(Date.now() + 3600000).toISOString()
    const endsAt = new Date(Date.now() + 86400000 * 2).toISOString()
    const rentReqRes = await request('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        resource: 'request',
        itemId: studentRentalItemId,
        startsAt,
        endsAt,
        message: 'Alquiler docente para demostración práctica en cátedra.',
      }),
    }, teacherToken)
    expectEqual(rentReqRes.status, 201, 'Rental request created by teacher')
    const reqId = rentReqRes.json?.request?.id

    // 3. Profesor simula el pago
    const payRes = await request('/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        requestId: reqId,
        outcome: 'success',
        paymentMethod: 'campus_balance',
      }),
    }, teacherToken)
    expectEqual(payRes.status, 200, 'Teacher payment status')
    expectEqual(payRes.json?.payment?.status, 'SIMULATED_PAID', 'SIMULATED_PAID')

    // 4. Estudiante aprueba alquiler pagado
    const appRes = await request('/api/items', {
      method: 'PATCH',
      body: JSON.stringify({
        resource: 'request',
        action: 'approve',
        requestId: reqId,
      }),
    }, studentToken)
    expectEqual(appRes.status, 200, 'Student approval status')
    const loanId = appRes.json?.request?.loan?.id
    expectTrue(!!loanId, 'Loan active')

    // 5. Devolución
    const retRes = await request('/api/items', {
      method: 'PATCH',
      body: JSON.stringify({
        resource: 'request',
        action: 'return',
        loanId,
      }),
    }, teacherToken)
    expectEqual(retRes.status, 200, 'Return status')
    expectEqual(retRes.json?.request?.loan?.status, 'RETURNED', 'Loan is RETURNED')
  })

  // =========================================================================
  console.log('\n--- 6. Chat Bidireccional y Preservación Tras Suspensión ---')
  // =========================================================================

  await test('Estudiante y profesor intercambian mensajes en el chat del acuerdo activo', async () => {
    // Student sends message
    const m1 = await request('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        requestId: rentalRequestId,
        content: 'Profesor, ¿a qué hora podemos encontrarnos en el laboratorio?',
      }),
    }, studentToken)
    expectEqual(m1.status, 201, 'Student message status')

    // Professor replies
    const m2 = await request('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        requestId: rentalRequestId,
        content: 'Nos vemos a las 2:00 PM frente al cubículo.',
      }),
    }, teacherToken)
    expectEqual(m2.status, 201, 'Professor message status')

    // Verify messages persistence
    const listRes = await request(`/api/messages?requestId=${rentalRequestId}`, { method: 'GET' }, studentToken)
    expectEqual(listRes.status, 200, 'Chat history status')
    expectTrue(listRes.json?.messages?.length >= 2, 'At least 2 messages persisted')
  })

  await test('Suspensión docente por edición de perfil: se suspende rol y bloquea nuevas operaciones', async () => {
    // Professor modifies department
    const patchRes = await request('/api/me', {
      method: 'PATCH',
      body: JSON.stringify({
        department: 'Departamento Cambiado a Inteligencia Artificial',
      }),
    }, teacherToken)
    expectEqual(patchRes.status, 200, 'Profile update status')
    expectEqual(patchRes.json?.user?.role, 'STUDENT', 'Role demoted to base STUDENT upon profile change')
    expectEqual(patchRes.json?.user?.teacherVerification?.status, 'NEEDS_CORRECTION', 'Verification suspended to NEEDS_CORRECTION')

    // Verify new marketplace operations are blocked
    const newPubRes = await request('/api/items', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Intento de publicación suspendido',
        categoryKey: category.key,
        duration: '1 día',
        mode: 'LOAN',
      }),
    }, teacherToken)
    expectEqual(newPubRes.status, 403, 'New item publish blocked (403)')
    expectEqual(newPubRes.json?.error, 'TEACHER_VERIFICATION_REQUIRED', 'Blocked code')

    // Verify chat in existing agreement STILL works after suspension!
    const postChatRes = await request('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        requestId: rentalRequestId,
        content: 'Confirmación post-suspensión: el chat del acuerdo existente sigue funcionando perfectamente.',
      }),
    }, teacherToken)
    expectEqual(postChatRes.status, 201, 'Chat on existing thread still permitted')

    // Devolución del alquiler aún tras la suspensión
    const retRes = await request('/api/items', {
      method: 'PATCH',
      body: JSON.stringify({
        resource: 'request',
        action: 'return',
        loanId: loanId2,
      }),
    }, studentToken)
    expectEqual(retRes.status, 200, 'Rental return succeeds during suspension')
    expectEqual(retRes.json?.request?.loan?.status, 'RETURNED', 'Loan status is RETURNED')
  })

  // Restore teacher to approved for clean state
  await test('Restaurar acreditación docente a APPROVED', async () => {
    const listRes = await request('/api/admin/teacher-verifications?status=NEEDS_CORRECTION', { method: 'GET' }, adminToken)
    const item = listRes.json?.data?.find((d: any) => d.applicant?.email === teacherEmail)
    if (item) {
      await request(`/api/admin/teacher-verifications/${item.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'APPROVE',
          reason: 'Restauración aprobada para QA.',
          expectedVersion: item.version,
        }),
      }, adminToken)
    }
  })

  // =========================================================================
  console.log('\n--- 7. Verificación de Seguridad y Protección del Administrador ---')
  // =========================================================================

  await test('Verificación de solo lectura: Administrador del sistema permanece activo con rol ADMIN', async () => {
    const adminCheck = await prisma.user.findUniqueOrThrow({
      where: { id: adminDbUser.id },
      include: { role: true },
    })
    expectEqual(adminCheck.role.name, 'ADMIN', 'Admin user role is ADMIN')
    expectEqual(adminCheck.isActive, true, 'Admin remains active')
  })

  skipTest(
    'Concurrencia HTTP en protección del último administrador',
    'Requiere entorno de ejecución con base de datos efímera aislada. En el entorno actual (base de datos compartida remota) está estrictamente prohibido mutar o simular degradaciones contra administradores para no comprometer la cuenta real ni arriesgar la persistencia administrativa.'
  )

  // Cleanup test items created during this run
  if (testItemIds.length) {
    await prisma.chatMessage.deleteMany({ where: { request: { itemId: { in: testItemIds } } } })
    await prisma.payment.deleteMany({ where: { request: { itemId: { in: testItemIds } } } })
    await prisma.loan.deleteMany({ where: { itemId: { in: testItemIds } } })
    await prisma.loanRequest.deleteMany({ where: { itemId: { in: testItemIds } } })
    await prisma.itemVisibility.deleteMany({ where: { itemId: { in: testItemIds } } })
    await prisma.item.deleteMany({ where: { id: { in: testItemIds } } })
  }

  // Summary
  console.log('\n======================================================')
  console.log('RESUMEN DE PRUEBAS DE QA EJECUTADAS')
  console.log('======================================================')
  const passedCount = results.filter((r) => r.passed && !r.skipped).length
  const pendingCount = results.filter((r) => r.skipped).length
  const failedCount = results.filter((r) => !r.passed).length
  console.log(`Total casos evaluados: ${results.length}`)
  console.log(`  - Pruebas ejecutadas y aprobadas: ${passedCount}`)
  console.log(`  - Casos marcados PENDIENTE (entorno aislado requerido): ${pendingCount}`)
  console.log(`  - Pruebas fallidas: ${failedCount}`)

  if (failedCount > 0) {
    console.error('ALERTA: Se detectaron fallos en la suite.')
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error('Fatal runner error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
