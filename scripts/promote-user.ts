// Cambia el rol de un usuario ya registrado a cualquier rol existente en la tabla Role
// (STUDENT, PROFESSOR, ADMIN, o uno creado desde el panel de administración).
// Uso: pnpm db:promote correo@ujap.edu.ve ADMIN
import 'dotenv/config'
import { prisma } from '../api/_lib/prisma.ts'

const [, , email, roleName] = process.argv

if (!email || !roleName) {
  console.error('Uso: pnpm db:promote correo@ujap.edu.ve NOMBRE_DEL_ROL')
  process.exit(1)
}

const role = await prisma.role.findUnique({ where: { name: roleName.trim().toUpperCase() } })
if (!role) {
  const existing = await prisma.role.findMany({ select: { name: true } })
  console.error(`Rol "${roleName}" no existe. Roles disponibles: ${existing.map((r) => r.name).join(', ')}`)
  process.exit(1)
}

const user = await prisma.user.update({
  where: { email: email.trim().toLowerCase() },
  data: { roleId: role.id },
  include: { role: true },
})

console.log(`${user.email} ahora es ${user.role.name}.`)
await prisma.$disconnect()
