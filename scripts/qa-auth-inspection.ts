import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '../backend/_lib/prisma.js'

async function inspect() {
  console.log('=== INSPECCIÓN Y AUDITORÍA DE AUTENTICACIÓN LENDIT ===\n')

  const supabaseUrl = process.env.SUPABASE_URL
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY
  const appUrl = process.env.APP_URL

  console.log('1. Verificación de Variables de Entorno:')
  console.log('  SUPABASE_URL:', supabaseUrl ? 'CONFIGURADO' : 'FALTANTE')
  console.log('  SUPABASE_PUBLISHABLE_KEY:', supabasePublishableKey ? 'CONFIGURADO' : 'FALTANTE')
  console.log('  SUPABASE_SECRET_KEY:', supabaseSecretKey ? 'CONFIGURADO' : 'FALTANTE')
  console.log('  APP_URL:', appUrl ? `CONFIGURADO (${appUrl})` : 'FALTANTE')

  if (!supabaseUrl || !supabasePublishableKey || !supabaseSecretKey) {
    console.error('Error: Variables de Supabase incompletas.')
    process.exit(1)
  }

  const anonClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 2. Inspeccionar estado de fixtures autorizados en DB
  console.log('\n2. Inspección de Fixtures Autorizados en DB (sin exponer secretos):')
  const studentEmail = process.env.QA_STUDENT_EMAIL
  const teacherEmail = process.env.QA_TEACHER_EMAIL

  if (!studentEmail || !teacherEmail) {
    console.warn('  [AVISO] QA_STUDENT_EMAIL o QA_TEACHER_EMAIL no configurados en .env')
    return
  }

  console.log(`  Fixture Estudiante: ${studentEmail}`)
  console.log(`  Fixture Docente:    ${teacherEmail}`)

  const studentDb = await prisma.user.findUnique({
    where: { email: studentEmail },
    include: { role: true, school: true, career: true },
  })
  console.log('  Estudiante en DB:', studentDb ? {
    id: studentDb.id,
    authUserId: studentDb.authUserId,
    role: studentDb.role.name,
    hasPhoto: Boolean(studentDb.photoUrl),
    career: studentDb.career?.name,
    emailVerifiedAt: studentDb.emailVerifiedAt,
    isActive: studentDb.isActive,
  } : 'NO ENCONTRADO EN DB')

  const teacherDb = await prisma.user.findUnique({
    where: { email: teacherEmail },
    include: { role: true, school: true, career: true, teacherVerification: true },
  })
  console.log('  Docente en DB:', teacherDb ? {
    id: teacherDb.id,
    authUserId: teacherDb.authUserId,
    role: teacherDb.role.name,
    hasPhoto: Boolean(teacherDb.photoUrl),
    school: teacherDb.school?.name,
    teacherVerificationStatus: teacherDb.teacherVerification?.status,
    emailVerifiedAt: teacherDb.emailVerifiedAt,
    isActive: teacherDb.isActive,
  } : 'NO ENCONTRADO EN DB')

  // 3. Inspeccionar usuarios en Supabase Auth vía Admin API (solo metadatos / flags de confirmación)
  console.log('\n3. Inspección en Supabase Auth (Flags de confirmación y metadatos):')
  if (studentDb?.authUserId) {
    const { data: sAuth, error: sErr } = await adminClient.auth.admin.getUserById(studentDb.authUserId)
    if (sErr) console.log('  Error obteniendo estudiante en Auth:', sErr.message)
    else {
      console.log('  Estudiante en Supabase Auth:', {
        id: sAuth.user.id,
        email_confirmed_at: sAuth.user.email_confirmed_at,
        confirmed_at: sAuth.user.confirmed_at,
        metadata_keys: Object.keys(sAuth.user.user_metadata || {}),
        metadata_role: sAuth.user.user_metadata?.role,
      })
    }
  }

  if (teacherDb?.authUserId) {
    const { data: tAuth, error: tErr } = await adminClient.auth.admin.getUserById(teacherDb.authUserId)
    if (tErr) console.log('  Error obteniendo docente en Auth:', tErr.message)
    else {
      console.log('  Docente en Supabase Auth:', {
        id: tAuth.user.id,
        email_confirmed_at: tAuth.user.email_confirmed_at,
        confirmed_at: tAuth.user.confirmed_at,
        metadata_keys: Object.keys(tAuth.user.user_metadata || {}),
        metadata_role: tAuth.user.user_metadata?.role,
      })
    }
  }

  // 4. Probar autenticación directa vía signInWithPassword con fixtures
  console.log('\n4. Prueba de Login de Fixtures Autorizados:')
  const studentPw = process.env.QA_STUDENT_PASSWORD
  const teacherPw = process.env.QA_TEACHER_PASSWORD

  if (studentPw) {
    const { data: sLogin, error: sLoginErr } = await anonClient.auth.signInWithPassword({
      email: studentEmail,
      password: studentPw,
    })
    console.log('  Login Estudiante:', sLoginErr ? `FALLO: ${sLoginErr.message}` : `ÉXITO (Session obtenida: ${Boolean(sLogin.session)})`)
  }

  if (teacherPw) {
    const { data: tLogin, error: tLoginErr } = await anonClient.auth.signInWithPassword({
      email: teacherEmail,
      password: teacherPw,
    })
    console.log('  Login Docente:   ', tLoginErr ? `FALLO: ${tLoginErr.message}` : `ÉXITO (Session obtenida: ${Boolean(tLogin.session)})`)
  }

  // 5. Probar login con credenciales inválidas
  console.log('\n5. Pruebas Negativas de Login:')
  const { data: badLogin, error: badLoginErr } = await anonClient.auth.signInWithPassword({
    email: studentEmail,
    password: 'WrongPassword123!',
  })
  console.log('  Login con contraseña errónea:', badLoginErr ? `RECHAZADO CORRECTAMENTE: ${badLoginErr.message}` : 'INCORRECTO (Aceptado)')

  // 6. Estado de usuarios en DB y Supabase Auth
  console.log('\n6. Cuentas registradas en DB y Supabase Auth:')
  const dbUsers = await prisma.user.findMany({
    select: { id: true, email: true, authUserId: true, role: { select: { name: true } } },
  })
  console.log('  Usuarios en Prisma DB:')
  for (const u of dbUsers) {
    console.log(`    - ID: ${u.id} | Email: ${u.email} | Rol: ${u.role.name} | AuthID: ${u.authUserId}`)
  }

  const { data: authList } = await adminClient.auth.admin.listUsers()
  console.log('  Usuarios en Supabase Auth:')
  for (const u of authList?.users || []) {
    console.log(`    - AuthID: ${u.id} | Email: ${u.email} | Confirmed: ${u.email_confirmed_at} | RecoverySent: ${(u as any).recovery_sent_at ?? 'N/A'}`)
  }

  console.log('\n7. Búsqueda específica de authUserId de jpena13@ujap.edu.ve:')
  const jpena13Db = await prisma.user.findUnique({ where: { email: 'jpena13@ujap.edu.ve' } })
  if (jpena13Db?.authUserId) {
    const { data: directUser, error: directErr } = await adminClient.auth.admin.getUserById(jpena13Db.authUserId)
    console.log('  getUserById(authUserId de jpena13):', directErr ? `ERROR: ${directErr.message}` : directUser?.user?.email)
  } else {
    console.log('  jpena13 en DB no tiene authUserId o no existe.')
  }
}

inspect()
  .catch((err) => {
    console.error('Error fatal durante la inspección:', err)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
