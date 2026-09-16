export type ItemMode = 'LOAN' | 'RENTAL'
export type Currency = 'USD' | 'EUR' | 'VES'

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

export interface Category {
  key: string
  label: string
  icon: string | null
  blurb: string | null
}

export interface School {
  id: string
  name: string
}

export interface Career {
  id: string
  name: string
  school: School | null
}

export interface Role {
  id: string
  name: string
  description?: string | null
  permissions: string[]
}

export interface Step {
  n: string
  title: string
  text: string
}

export interface TrustPoint {
  title: string
  text: string
}

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

export type LoginMode = 'institutional' | 'admin'

export interface LoginCredentials {
  email: string
  password: string
  mode?: LoginMode
}

export interface RegisterInput {
  firstName: string
  lastName: string
  email: string
  password: string
  careerId: string
  role: 'STUDENT' | 'PROFESSOR'
  phone: string
  photo: string | null
}

export interface NewArticleInput {
  title: string
  categoryKey: string
  duration: string
  description?: string
  photoUrl?: string
  mode: ItemMode
  price?: number
  currency?: Currency
  restrictedToRoles: string[]
}

export interface UpdateArticleInput {
  title?: string
  categoryKey?: string
  duration?: string
  description?: string
  photoUrl?: string | null
  mode?: ItemMode
  price?: number
  currency?: Currency
  status?: 'available' | 'paused'
  restrictedToRoles?: string[]
}

export type LoanRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'
export type LoanStatus = 'ACTIVE' | 'RETURNED' | 'OVERDUE' | 'CANCELLED'
export type PaymentStatus = 'PENDING' | 'SIMULATED_PAID' | 'FAILED' | 'REFUNDED'

export interface LoanRequest {
  id: string
  item: {
    id: string
    code: string
    title: string
    category: string
    categoryIcon: string | null
    owner: {
      id: string
      name: string
      email: string
    }
    mode: ItemMode
    price: number | null
    currency: Currency | null
  }
  requester: {
    id: string
    name: string
    email: string
  }
  startsAt: string
  endsAt: string
  message: string | null
  status: LoanRequestStatus
  isOwner: boolean
  payment: {
    status: PaymentStatus
    amount: number
    currency: Currency
  } | null
  loan: {
    id: string
    status: LoanStatus
    returnedAt: string | null
  } | null
  createdAt: string
}

export interface NewLoanRequestInput {
  itemId: string
  startsAt: string
  endsAt: string
  message?: string
}
