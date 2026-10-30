# Scripts de Utilidad y Mantenimiento (`scripts/`)

Esta carpeta alberga scripts ejecutables por línea de comandos para operaciones de administración directa, diagnóstico y mantenimiento de la base de datos de LendIt UJAP.

---

## 1. Scripts Disponibles

### `promote-user.ts` — Promoción Manual de Roles de Usuario
Permite cambiar el rol de un usuario registrado en la base de datos a cualquier rol existente en la tabla `Role` (`STUDENT`, `PROFESSOR`, `ADMIN` o roles personalizados creados desde el panel administrativo).

#### Sintaxis y Modo de Uso
```bash
# Vía script de package.json
npm run db:promote <correo_del_usuario> <NOMBRE_DEL_ROL>

# Ejemplo de asignación de Administrador
npm run db:promote admin@ujap.edu.ve ADMIN

# Ejemplo de asignación de Profesor
npm run db:promote profesor@ujap.edu.ve PROFESSOR
```

#### Flujo de Ejecución Detallado
1. **Inicialización**:
   - Carga variables de entorno mediante `import 'dotenv/config'` para leer la conexión a la base de datos `DATABASE_URL`.
   - Inicializa el cliente Prisma importado de `../backend/_lib/prisma.ts`.
2. **Validación de Parámetros de Entrada**:
   - Extrae `email` y `roleName` desde `process.argv`.
   - Si falta alguno de los dos argumentos, imprime en consola la instrucción de uso y finaliza con código de salida `1`:
     ```text
     Uso: pnpm db:promote correo@ujap.edu.ve NOMBRE_DEL_ROL
     ```
3. **Verificación de Rol en Base de Datos**:
   - Busca el rol transformando el nombre a mayúsculas:
     ```typescript
     const role = await prisma.role.findUnique({ where: { name: roleName.trim().toUpperCase() } })
     ```
   - Si el rol no existe, consulta todos los roles vigentes en la base de datos y los imprime para orientar al administrador antes de abortar la ejecución:
     ```text
     Rol "DECANO" no existe. Roles disponibles: ADMIN, STUDENT, PROFESSOR
     ```
4. **Actualización del Registro del Usuario**:
   - Ejecuta `prisma.user.update` buscando por el correo normalizado en minúsculas y actualizando la clave foránea `roleId`:
     ```typescript
     const user = await prisma.user.update({
       where: { email: email.trim().toLowerCase() },
       data: { roleId: role.id },
       include: { role: true },
     })
     ```
5. **Cierre de Conexión**:
   - Imprime el mensaje de éxito: `<email> ahora es <role.name>.`
   - Cierra ordenadamente el pool de conexiones de Prisma con `await prisma.$disconnect()`.

---

## 2. Guía para Nuevos Scripts de Mantenimiento

Al agregar nuevos scripts en esta carpeta, se deben seguir las siguientes buenas prácticas:
- Importar `import 'dotenv/config'` en la primera línea para cargar las credenciales locales de `.env`.
- Reutilizar la instancia compartida de Prisma desde `../backend/_lib/prisma.ts`.
- Cerrar explícitamente la conexión con `await prisma.$disconnect()` al finalizar o en bloques `finally`.
- Validar argumentos de línea de comandos antes de ejecutar operaciones destructivas.
