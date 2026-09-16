export interface Article {
  id: string
  code: string
  title: string
  category: string
  categoryKey: string
  categoryIcon: string | null
  duration: string
  status: 'available' | 'lent' | 'paused' | 'rejected'
  restrictedToRoles: string[]
  returnTime?: string
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
  restrictedToRoles: string[]
}
