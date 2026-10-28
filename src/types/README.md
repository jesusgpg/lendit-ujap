# Tipos e Interfaces de TypeScript (`src/types/`)

Esta carpeta centraliza los contratos de datos e interfaces estáticas de TypeScript utilizados en toda la aplicación cliente, garantizando consistencia semántica y seguridad de tipos en componentes, almacenes de Pinia y llamadas a la API.

---

## 1. Módulos y Re-exportación

- `app.ts`: Contiene la totalidad de las definiciones de tipos e interfaces de la aplicación.
- `index.ts`: Re-exporta todos los tipos para simplificar importaciones en el proyecto (`export * from './app'`).

---

## 2. Tipos Primitivos y Enumeraciones

```typescript
export type ItemMode = 'LOAN' | 'RENTAL'
export type Currency = 'USD' | 'EUR' | 'VES'
export type LoginMode = 'institutional' | 'admin'
export type LoanRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'
export type LoanStatus = 'ACTIVE' | 'RETURNED' | 'OVERDUE' | 'CANCELLED'
export type PaymentStatus = 'PENDING' | 'SIMULATED_PAID' | 'FAILED' | 'REFUNDED'
```

---

## 3. Interfaces del Dominio de Negocio

### `Article` — Objeto en Préstamo o Alquiler
Representa la entidad completa de un artículo en el catálogo.

```typescript
export interface Article {
  id: string
  ownerId: string
  code: string
  title: string
  description?: string | null
  photoUrl?: string | null
  category: string
  categoryKey: string
  categoryIcon: string | null
  duration: string
  mode: ItemMode
  price: number | null
  currency: Currency | null
  status: 'available' | 'lent' | 'paused' | 'rejected'
  restrictedToRoles: string[]
  returnTime?: string
  publishedAt?: string
}
```

| Propiedad | Tipo | Descripción |
|---|---|---|
| `id` | `string` | UUID primario del artículo. |
| `ownerId` | `string` | Identificador del usuario propietario. |
| `code` | `string` | Código de inventario legible (ej. `#UJAP-3E9F8B1A`). |
| `title` | `string` | Título del objeto (ej. "Calculadora Texas Instruments"). |
| `mode` | `'LOAN' \| 'RENTAL'` | Préstamo gratuito (`LOAN`) o alquiler con cobro (`RENTAL`). |
| `price` / `currency` | `number \| null`, `Currency \| null` | Precio monetario y divisa para alquileres. |
| `status` | `'available' \| 'lent' \| 'paused' \| 'rejected'` | Disponibilidad del objeto en la red. |
| `restrictedToRoles` | `string[]` | Nombres de roles autorizados para pedir este artículo (vacío = público). |

---

### `AuthUser` — Perfil del Usuario Autenticado
Perfil institucional y carnet digital devuelto por `/api/me`.

```typescript
export interface AuthUser {
  id: string
  name: string
  firstName: string
  lastName: string
  email: string
  career: string
  careerId: string
  phone: string
  photo: string
  role: string
  permissions: string[]
  emailVerifiedAt?: string | null
}
```

| Propiedad | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador del usuario en la tabla `User`. |
| `name` | `string` | Nombre completo formateado (`${firstName} ${lastName}`). |
| `email` | `string` | Correo institucional verificado (`@ujap.edu.ve`). |
| `career` / `careerId` | `string`, `string` | Nombre de la carrera académica y su UUID foráneo. |
| `role` | `string` | Nombre técnico del rol (ej. `STUDENT`, `PROFESSOR`, `ADMIN`). |
| `permissions` | `string[]` | Matriz de permisos concedidos (ej. `['items.publish', 'items.rent']`). |

---

### `LoanRequest` — Solicitud de Préstamo
Representa una solicitud emitida por un estudiante hacia el dueño de un objeto.

```typescript
export interface LoanRequest {
  id: string
  item: {
    id: string
    code: string
    title: string
    category: string
    categoryIcon: string | null
    owner: { id: string; name: string; email: string }
    mode: ItemMode
    price: number | null
    currency: Currency | null
  }
  requester: { id: string; name: string; email: string }
  startsAt: string
  endsAt: string
  message: string | null
  status: LoanRequestStatus
  isOwner: boolean
  payment: { status: PaymentStatus; amount: number; currency: Currency } | null
  loan: { id: string; status: LoanStatus; returnedAt: string | null } | null
  createdAt: string
}
```

---

### Interfaces de Formularios e Inputs

#### `RegisterInput`
Datos requeridos para dar de alta a un nuevo miembro del campus:
- `firstName`: Nombre (mínimo 2 caracteres).
- `lastName`: Apellidos (mínimo 2 caracteres).
- `email`: Correo institucional `@ujap.edu.ve`.
- `password`: Contraseña ($\ge 6$ caracteres).
- `careerId`: UUID de la carrera seleccionada.
- `role`: Tipo de registro (`'STUDENT'` o `'PROFESSOR'`).
- `phone`: Teléfono de contacto.
- `photo`: Imagen en base64 procesada por `PhotoDropzone`.

#### `NewArticleInput` y `UpdateArticleInput`
Estructuras para publicar o editar artículos en el catálogo:
- `title`: Título del objeto.
- `categoryKey`: Clave de la categoría.
- `duration`: Plazo propuesto.
- `description`: Detalles adicionales opcionales.
- `photoUrl`: URL de la imagen en Supabase Storage.
- `mode`: `'LOAN'` o `'RENTAL'`.
- `price` / `currency`: Valores financieros para alquileres.
- `restrictedToRoles`: Roles de audiencia permitida.
- `status` *(en `UpdateArticleInput`)*: Permite alternar entre `'available'` y `'paused'`.
