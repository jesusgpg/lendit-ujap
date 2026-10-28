# Scripts de Utilidad y Mantenimiento (`scripts/`)

Esta carpeta contiene scripts ejecutables por línea de comandos para tareas de administración directa, mantenimiento y soporte operativo de la base de datos de LendIt UJAP.

---

## Archivos y Funciones

### 1. `promote-user.ts`
Script de terminal para cambiar el rol de un usuario ya existente en la base de datos a cualquiera de los roles disponibles (`ADMIN`, `STUDENT`, `PROFESSOR` o roles personalizados).

#### Modo de Uso
```bash
# Vía pnpm
pnpm db:promote usuario@ujap.edu.ve ADMIN

# Vía npm/tsx
npx tsx scripts/promote-user.ts usuario@ujap.edu.ve ADMIN
```

#### Flujo y Lógica del Script
1. **Lectura de Argumentos**:
   - Extrae el correo electrónico (`email`) y el nombre del rol destino (`roleName`) desde `process.argv`.
   - Si falta alguno de los argumentos, muestra la sintaxis de uso esperada y finaliza el proceso con código de error 1.
2. **Validación del Rol**:
   - Consulta `prisma.role.findUnique({ where: { name: roleName.toUpperCase() } })`.
   - Si el rol no existe, consulta y lista en consola todos los roles existentes en la tabla `Role` para guiar al operador y finaliza con código de error 1.
3. **Actualización del Usuario**:
   - Ejecuta `prisma.user.update` localizando al usuario por su correo normalizado en minúsculas y asignándole el nuevo `roleId`.
4. **Finalización**:
   - Imprime un mensaje confirmando el cambio (e.g. `usuario@ujap.edu.ve ahora es ADMIN.`).
   - Cierra ordenadamente la conexión con PostgreSQL mediante `await prisma.$disconnect()`.
