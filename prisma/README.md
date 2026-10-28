# Modelado y Base de Datos Prisma (`prisma/`)

Esta carpeta define el esquema de base de datos relacional PostgreSQL para LendIt UJAP, las migraciones de base de datos y la configuración de generación del cliente Prisma.

---

## Archivos y Directorios

### 1. `schema.prisma`
Archivo principal de definición de datos de Prisma ORM. Utiliza el generador `prisma-client` y el adaptador `@prisma/adapter-pg`.

#### Enumeraciones (Enums)
- `ItemStatus`: Estados de disponibilidad de un artículo (`AVAILABLE`, `PAUSED`, `LENT`, `REJECTED`).
- `ItemMode`: Modalidad de publicación (`LOAN` para préstamos gratuitos, `RENTAL` para alquiler con cobro).
- `LoanRequestStatus`: Estado de la solicitud de préstamo (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED`).
- `LoanStatus`: Ciclo de vida del préstamo efectivo (`ACTIVE`, `RETURNED`, `OVERDUE`, `CANCELLED`).
- `PaymentStatus`: Estado de pagos asociados a alquileres (`PENDING`, `SIMULATED_PAID`, `FAILED`, `REFUNDED`).
- `Currency`: Monedas soportadas para transacciones (`USD`, `EUR`, `VES`).

#### Modelos de Datos

| Modelo | Descripción | Relaciones Clave |
|---|---|---|
| `Role` | Roles dinámicos del sistema (`ADMIN`, `STUDENT`, `PROFESSOR` y personalizados). | Relacionado con `User`, `RolePermission` e `ItemVisibility`. |
| `Permission` | Catálogo de permisos del sistema (`items.publish`, `items.rent`, `users.manage`, `roles.manage`, `categories.manage`, `careers.manage`, `profile.update`). | Relacionado con `RolePermission`. |
| `RolePermission` | Tabla intermedia de muchos a muchos entre roles y permisos. | Llave compuesta `[roleId, permissionId]`. |
| `School` | Facultades / Escuelas universitarias (e.g. Ingeniería, Ciencias Sociales). | Contiene múltiples `Career`. |
| `Career` | Carreras académicas asociadas a una escuela. | Vinculado a `School` y múltiples `User`. |
| `Category` | Categorías de clasificación de objetos (calculadoras, libros, herramientas, etc.). | Posee clave única (`key`), etiqueta, icono emoji y múltiples `Item`. |
| `User` | Perfil de usuario en LendIt vinculado al identificador `authUserId` de Supabase Auth. Contiene nombre, teléfono, carrera, rol, reputación y estado activo. | Vinculado a `Role`, `Career`, artículos propios (`Item`), solicitudes (`LoanRequest`), préstamos y reseñas. |
| `Item` | Objeto publicado para préstamo o alquiler. Posee código único `#UJAP-XXXXXXXX`, título, categoría, duración, modalidad, precio y estado. | Vinculado a `User` (dueño), `Category`, solicitudes, préstamos e `ItemVisibility`. |
| `ItemVisibility` | Control de audiencia. Permite restringir qué roles pueden visualizar o pedir un artículo en específico. | Llave compuesta `[itemId, roleId]`. |
| `LoanRequest` | Solicitud formal de préstamo entre un solicitante y un artículo en un rango de fechas (`startsAt` a `endsAt`). | Vinculado a `Item`, `User` (solicitante), `Loan` y `Payment`. |
| `Loan` | Préstamo activo o finalizado originado tras la aprobación de una solicitud. | Vinculado a `Item`, `User` (dueño), `User` (prestatario), `LoanRequest` y `Review`. |
| `Review` | Calificación de reputación (1 a 5 estrellas) emitida exclusivamente tras culminar un préstamo. | Llave única `[loanId, authorId]`. |
| `Payment` | Registro financiero simulado o real de las operaciones de alquiler. | Vinculado a `User`, `LoanRequest` y `Loan`. |
| `QrLoginChallenge` | Desafíos criptográficos temporales para inicio de sesión rápido mediante código QR. | Token hasheado (`tokenHash`) con expiración y consumo único. |

---

### 2. `migrations/`
Contiene el historial cronológico de migraciones SQL aplicadas mediante Prisma Migrate:
- Inicialización de esquemas y triggers de sincronización entre `auth.users` y `public.User`.
- Creación de índices para optimizar consultas de préstamos, estados y audiencias de artículos.
- Actualización de políticas de eliminación en cascada y claves foráneas.
