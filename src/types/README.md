# Tipos e Interfaces de TypeScript (`src/types/`)

Esta carpeta centraliza las definiciones de tipos e interfaces TypeScript puras utilizadas en toda la aplicación cliente, garantizando seguridad de tipos y coherencia con el modelo de datos de la API.

---

## Archivos e Interfaces

### 1. `app.ts`

#### Tipos Primitivos y Uniones
- `ItemMode`: Modalidad del objeto (`'LOAN'` para préstamo gratuito, `'RENTAL'` para alquiler tarifado).
- `Currency`: Monedas admitidas (`'USD'`, `'EUR'`, `'VES'`).
- `LoginMode`: Modo de acceso al sistema (`'institutional'` o `'admin'`).
- `LoanRequestStatus`: Estados posibles de una solicitud (`'PENDING'`, `'APPROVED'`, `'REJECTED'`, `'CANCELLED'`, `'EXPIRED'`).
- `LoanStatus`: Estados del préstamo activo (`'ACTIVE'`, `'RETURNED'`, `'OVERDUE'`, `'CANCELLED'`).
- `PaymentStatus`: Estados de transacción simulada (`'PENDING'`, `'SIMULATED_PAID'`, `'FAILED'`, `'REFUNDED'`).

#### Interfaces Principales

| Interfaz | Propiedades Destacadas | Descripción |
|---|---|---|
| `Article` | `id`, `ownerId`, `code`, `title`, `description`, `photoUrl`, `category`, `categoryKey`, `categoryIcon`, `duration`, `mode`, `price`, `currency`, `status`, `restrictedToRoles`, `returnTime`, `publishedAt` | Representación completa de un objeto publicado para préstamo o alquiler. |
| `Category` | `key`, `label`, `icon`, `blurb` | Categoría temática del catálogo (ej. Libros, Electrónica). |
| `School` | `id`, `name` | Facultad o escuela universitaria dentro de la estructura UJAP. |
| `Career` | `id`, `name`, `school` | Carrera universitaria asociada opcionalmente a una facultad. |
| `Role` | `id`, `name`, `description`, `permissions` | Rol del sistema con su lista de permisos concedidos. |
| `AuthUser` | `id`, `name`, `firstName`, `lastName`, `email`, `career`, `careerId`, `phone`, `photo`, `role`, `permissions`, `emailVerifiedAt` | Perfil del usuario autenticado en la sesión actual. |
| `LoginCredentials` | `email`, `password`, `mode` | Credenciales provistas en el formulario de inicio de sesión. |
| `RegisterInput` | `firstName`, `lastName`, `email`, `password`, `careerId`, `role`, `phone`, `photo` | Datos requeridos para registrar una nueva cuenta de estudiante o profesor. |
| `NewArticleInput` | `title`, `categoryKey`, `duration`, `description`, `photoUrl`, `mode`, `price`, `currency`, `restrictedToRoles` | Carga útil para crear un nuevo artículo. |
| `UpdateArticleInput` | Propiedades parciales de `NewArticleInput` más `status` (`'available'` \| `'paused'`) | Carga útil para actualizar propiedades de un artículo existente. |
| `LoanRequest` | `id`, `item`, `requester`, `startsAt`, `endsAt`, `message`, `status`, `isOwner`, `payment`, `loan`, `createdAt` | Solicitud formal de préstamo con detalles anidados de las partes y pagos. |
| `NewLoanRequestInput` | `itemId`, `startsAt`, `endsAt`, `message` | Datos requeridos para solicitar un objeto en un rango de fechas. |
| `Step` | `n`, `title`, `text` | Elemento informativo de los pasos del flujo "Cómo funciona". |
| `TrustPoint` | `title`, `text` | Bloque informativo de los pilares de confianza de la comunidad. |

---

### 2. `index.ts`
Re-exporta todas las definiciones de tipos para permitir importaciones unificadas (`import type { Article } from '@/types'`).
