export type ItemMode = 'LOAN' | 'RENTAL'
export type Currency = 'USD' | 'EUR' | 'VES'

export interface Article {
  id: string
  ownerId: string
  code: string
  title: string
  description?: string | null
  photoUrl?: string | null
  photoUrls?: string[]
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
  imagenUrl: string | null
  imagenAlt: string | null
  unsplashPhotoId: string | null
  photographerName: string | null
  photographerUrl: string | null
  unsplashUrl: string | null
}

export interface School {
  careerCount?: number
  id: string
  name: string
  imagenUrl?: string | null
  imagenAlt?: string | null
}

export interface Career {
  id: string
  name: string
  school: School | null
  imagenUrl?: string | null
  imagenAlt?: string | null
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

export type TeacherVerificationStatus = 'DRAFT' | 'PENDING' | 'NEEDS_CORRECTION' | 'REJECTED' | 'APPROVED'
export type TeacherDecisionAction = 'APPROVE' | 'REJECT' | 'REQUEST_CORRECTION'

export interface TeacherVerificationDecision {
  id: string
  action: TeacherDecisionAction
  reason: string | null
  adminName: string
  version: number
  createdAt: string
}

export interface TeacherVerification {
  id: string
  userId?: string
  applicant?: {
    id: string
    name: string
    email: string
    phone: string
    role: string
  }
  user?: {
    id: string
    name: string
    email: string
    phone: string
    photo?: string | null
    currentRole: string
  }
  schoolId: string
  schoolName?: string
  school?: { id: string; name: string }
  department: string | null
  careerId: string | null
  careerName?: string | null
  career?: { id: string; name: string } | null
  documentPath: string | null
  signedUrl?: string | null
  status: TeacherVerificationStatus
  version: number
  submittedVersion?: number | null
  submittedAt?: string | null
  submission?: {
    id: string
    version: number
    documentPath: string
    documentMime: string
    documentBytes: number
    documentSha256: string
    submittedAt: string
  } | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
  decisions?: TeacherVerificationDecision[]
}

export interface AuthUser {
  id: string
  name: string
  firstName: string
  lastName: string
  email: string
  career?: string | null
  careerId?: string | null
  school?: string | null
  schoolId?: string | null
  department?: string | null
  phone: string
  photo: string
  role: string
  permissions: string[]
  emailVerifiedAt?: string | null
  teacherVerification?: TeacherVerification | null
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
  role: 'STUDENT' | 'PROFESSOR'
  careerId?: string
  schoolId?: string
  department?: string
  phone: string
  photo: string | null
}

export interface NewArticleInput {
  title: string
  categoryKey: string
  duration: string
  description?: string
  photoUrl?: string
  photoUrls?: string[]
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
  photoUrls?: string[]
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
    id?: string
    status: PaymentStatus
    amount: number
    currency: Currency
    provider?: string | null
    providerReference?: string | null
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


export interface ChatMessage {
  id: string
  requestId: string | null
  conversationId?: string | null
  senderId: string
  content: string
  createdAt: string
}

export interface MessagesResponse {
  ok: boolean
  messages: ChatMessage[]
  nextCursor?: string | null
}

export interface MessageThread {
  id: string
  kind: 'request' | 'inquiry'
  item: { id: string; title: string; photoUrl: string | null }
  counterpart: { id: string; name: string; photo: string | null }
  status: string
  canSend: boolean
  latestMessage: { senderId: string; content: string; createdAt: string } | null
  updatedAt: string
}

export interface SendMessageResponse {
  ok: boolean
  message: ChatMessage
}


export interface PaymentRecord {
  id: string
  requestId: string | null
  userId: string
  amount: number
  currency: Currency
  status: PaymentStatus
  provider: string | null
  providerReference: string | null
  transferAmountVES: number | null
  exchangeRate: number | null
  exchangeRateDate: string | null
  exchangeRateSource: string | null
  createdAt?: string
  updatedAt?: string
}

export interface BCVExchangeRates {
  USD: number
  EUR: number
  effectiveDate: string
  updatedAt: string
  sourceUrl: string
}

export interface CentralPaymentAccount {
  holder: string
  bank: string
  phone: string
  nationalId: string
  updatedAt?: string
}

export interface WalletAccount {
  currency: Currency
  balance: number
}

export type WalletTransactionType = 'RENTAL_CREDIT' | 'RENTAL_DEBIT' | 'WALLET_TOP_UP' | 'RENTAL_REFUND' | 'RENTAL_REVERSAL'

export interface WalletTransaction {
  id: string
  type: WalletTransactionType
  amount: number
  currency: Currency
  description: string | null
  createdAt: string
}

export interface PaymentsAccountResponse {
  ok: boolean
  wallet: { accounts: WalletAccount[]; transactions: WalletTransaction[] }
  centralAccount: CentralPaymentAccount | null
  exchangeRates: BCVExchangeRates | null
}

export interface MobilePaymentSubmission {
  proofPath: string
  reference: string
  bank: string
  phone: string
  nationalId: string
}

export interface MobileRentalPaymentPayload extends MobilePaymentSubmission {
  action: 'mobile-rental'
  requestId: string
}

export interface WalletTopUpPayload extends MobilePaymentSubmission {
  action: 'wallet-top-up'
  idempotencyKey: string
  amount: number
  currency: Currency
}

export interface WalletRentalPaymentPayload {
  action: 'wallet-rental'
  requestId: string
}
