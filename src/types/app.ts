export interface ItemCategory {
  id: string
  label: string
}

export interface Article {
  id: string
  code: string
  title: string
  category: string
  duration: string
  status: 'available' | 'lent'
  returnTime?: string
}

export interface Category {
  id: string
  label: string
  icon: string
  blurb: string
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
  name: string
  email: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface NewArticleInput {
  title: string
  category: string
  duration: string
}
