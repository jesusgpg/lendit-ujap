import { z } from 'zod'
import { Prisma } from '../generated/prisma/client.js'
import { prisma } from './_lib/prisma.js'
import { getBCVExchangeRates } from './_lib/bcvRates.js'
import {
  createAuthenticatedSupabaseClient,
  extractBearerToken,
  getAuthenticatedProfile,
  isAdministrativeProfile,
  statusForProfileError,
  type ApiRequest,
  type ApiResponse,
  type AuthenticatedProfile,
} from './_lib/auth.js'
import { addNotification } from './_lib/notifications.js'

const mobilePaymentFields = z.object({
  proofPath: z.string().trim().min(1).max(255),
  reference: z.string().trim().min(4).max(60),
  bank: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{6,28}$/),
  nationalId: z.string().trim().toUpperCase().regex(/^[VE]-?\d{5,10}$/),
}).transform(value => ({
  ...value,
  phone: value.phone.replace(/[ ()]/g, ''),
  nationalId: value.nationalId.replace(/^([VE])(?=\d)/, '$1-'),
}))

const mobileRentalSchema = z.object({
  action: z.literal('mobile-rental'),
  requestId: z.string().uuid(),
}).and(mobilePaymentFields)

const topUpSchema = z.object({
  action: z.literal('wallet-top-up'),
  idempotencyKey: z.string().uuid(),
  amount: z.number().min(1).max(100000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7),
  currency: z.enum(['USD', 'EUR', 'VES']),
}).and(mobilePaymentFields)

const walletRentalSchema = z.object({
  action: z.literal('wallet-rental'),
  requestId: z.string().uuid(),
})

const centralAccountSchema = z.object({
  holder: z.string().trim().min(2).max(120),
  bank: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{6,28}$/),
  nationalId: z.string().trim().toUpperCase().regex(/^[VE]-?\d{5,10}$/),
}).transform(value => ({
  ...value,
  phone: value.phone.replace(/[ ()]/g, ''),
  nationalId: value.nationalId.replace(/^([VE])(?=\d)/, '$1-'),
}))

const requestQuerySchema = z.object({ requestId: z.string().uuid() })

function queryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function serializePayment(payment: {
  id: string
  requestId: string | null
  userId: string
  amount: { toString: () => string }
  currency: string
  status: string
  provider: string | null
  providerReference: string | null
  transferAmountVES: { toString: () => string } | null
  exchangeRate: { toString: () => string } | null
  exchangeRateDate: string | null
  exchangeRateSource: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: payment.id,
    requestId: payment.requestId,
    userId: payment.userId,
    amount: Number(payment.amount.toString()),
    currency: payment.currency,
    status: payment.status,
    provider: payment.provider,
    providerReference: payment.providerReference,
    transferAmountVES: payment.transferAmountVES ? Number(payment.transferAmountVES.toString()) : null,
    exchangeRate: payment.exchangeRate ? Number(payment.exchangeRate.toString()) : null,
    exchangeRateDate: payment.exchangeRateDate,
    exchangeRateSource: payment.exchangeRateSource,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  }
}

function serializeWalletTransaction(transaction: {
  id: string
  type: string
  amount: { toString: () => string }
  account: { currency: string }
  description: string | null
  createdAt: Date
}) {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: Number(transaction.amount.toString()),
    currency: transaction.account.currency,
    description: transaction.description,
    createdAt: transaction.createdAt.toISOString(),
  }
}

async function centralAccount() {
  const configured = await prisma.centralPaymentSettings.findUnique({ where: { id: 'central' } })
  if (configured) return {
    holder: configured.holder,
    bank: configured.bank,
    phone: configured.phone,
    nationalId: configured.nationalId,
  }

  // Compatibility fallback for deployments that already provide the receiver
  // details as environment variables. Admin settings take precedence.
  const holder = process.env.LENDIT_MOBILE_HOLDER?.trim() ?? ''
  const bank = process.env.LENDIT_MOBILE_BANK?.trim() ?? ''
  const phone = process.env.LENDIT_MOBILE_PHONE?.trim() ?? ''
  const nationalId = process.env.LENDIT_MOBILE_NATIONAL_ID?.trim() ?? ''
  if (!holder || !bank || !phone || !nationalId) return null
  return { holder, bank, phone, nationalId }
}

async function loadAccount(profile: AuthenticatedProfile, res: ApiResponse) {
  const [accounts, transactions, exchangeRates, recipient] = await Promise.all([
    prisma.walletAccount.findMany({ where: { userId: profile.id }, orderBy: { currency: 'asc' } }),
    prisma.walletTransaction.findMany({
      where: { userId: profile.id },
      include: { account: { select: { currency: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    getBCVExchangeRates().catch(() => null),
    centralAccount(),
  ])

  return res.status(200).json({
    ok: true,
    wallet: {
      accounts: accounts.map(account => ({
        currency: account.currency,
        balance: Number(account.balance.toString()),
      })),
      transactions: transactions.map(serializeWalletTransaction),
    },
    centralAccount: recipient,
    exchangeRates,
  })
}

async function mobileTransferSnapshot(amount: Prisma.Decimal, currency: string) {
  if (currency === 'VES') {
    return {
      transferAmountVES: amount,
      exchangeRate: null,
      exchangeRateDate: null,
      exchangeRateSource: null,
    }
  }

  let rates
  try {
    rates = await getBCVExchangeRates()
  } catch {
    throw new Error('BCV_RATE_UNAVAILABLE')
  }
  if (currency !== 'USD' && currency !== 'EUR') throw new Error('UNSUPPORTED_PAYMENT_CURRENCY')

  const rate = new Prisma.Decimal(rates[currency])
  return {
    transferAmountVES: amount.mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
    exchangeRate: rate,
    exchangeRateDate: rates.effectiveDate,
    exchangeRateSource: 'BCV',
  }
}

async function verifyProof(req: ApiRequest, profile: AuthenticatedProfile, proofPath: string) {
  const user = await prisma.user.findUnique({ where: { id: profile.id }, select: { authUserId: true } })
  const token = extractBearerToken(req)
  if (!user?.authUserId || !token || !proofPath.startsWith(`${user.authUserId}/`)) return false
  if (!/^[0-9a-f-]+\/payment-[0-9a-f-]+\.(jpg|png|webp)$/i.test(proofPath)) return false

  const client = createAuthenticatedSupabaseClient(token)
  const { data, error } = await client.storage.from('payment-proofs').createSignedUrl(proofPath, 60)
  return !error && Boolean(data?.signedUrl)
}

async function getPayment(req: ApiRequest, res: ApiResponse, profile: AuthenticatedProfile) {
  const requestId = queryValue(req.query?.requestId)
  const view = queryValue(req.query?.view)
  if (view === 'account') return loadAccount(profile, res)

  const parsed = requestQuerySchema.safeParse({ requestId })
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID_REQUEST_ID' })

  const loanRequest = await prisma.loanRequest.findUnique({
    where: { id: parsed.data.requestId },
    select: {
      id: true,
      requesterId: true,
      item: { select: { ownerId: true } },
      payment: true,
    },
  })
  if (!loanRequest) return res.status(404).json({ ok: false, error: 'REQUEST_NOT_FOUND' })

  const isAuthorized = loanRequest.requesterId === profile.id || loanRequest.item.ownerId === profile.id
  if (!isAuthorized) return res.status(403).json({ ok: false, error: 'FORBIDDEN' })

  return res.status(200).json({
    ok: true,
    payment: loanRequest.payment ? serializePayment(loanRequest.payment) : null,
  })
}

async function saveCentralAccount(req: ApiRequest, res: ApiResponse) {
  const parsed = centralAccountSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID_CENTRAL_PAYMENT_ACCOUNT' })
  const saved = await prisma.centralPaymentSettings.upsert({
    where: { id: 'central' },
    create: { id: 'central', ...parsed.data },
    update: parsed.data,
  })
  return res.status(200).json({ ok: true, centralAccount: {
    holder: saved.holder,
    bank: saved.bank,
    phone: saved.phone,
    nationalId: saved.nationalId,
    updatedAt: saved.updatedAt.toISOString(),
  } })
}

async function upsertWalletCredit(input: {
  tx: Prisma.TransactionClient
  paymentId: string
  userId: string
  amount: number
  currency: 'USD' | 'EUR' | 'VES'
  type: 'RENTAL_CREDIT' | 'WALLET_TOP_UP'
  description: string
}) {
  const account = await input.tx.walletAccount.upsert({
    where: { userId_currency: { userId: input.userId, currency: input.currency } },
    create: { userId: input.userId, currency: input.currency, balance: 0 },
    update: {},
  })
  const ledger = await input.tx.walletTransaction.createMany({
    data: [{
      accountId: account.id,
      userId: input.userId,
      paymentId: input.paymentId,
      type: input.type,
      amount: input.amount,
      description: input.description,
    }],
    skipDuplicates: true,
  })
  if (ledger.count > 0) {
    await input.tx.walletAccount.update({
      where: { id: account.id },
      data: { balance: { increment: input.amount } },
    })
  }
}

async function submitMobileRental(req: ApiRequest, res: ApiResponse, profile: AuthenticatedProfile) {
  const parsed = mobileRentalSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID_PAYMENT_DETAILS' })
  const { requestId, proofPath, reference, bank, phone, nationalId } = parsed.data
  if (!await centralAccount()) return res.status(503).json({ ok: false, error: 'PAYMENT_DESTINATION_NOT_CONFIGURED' })

  const loanRequest = await prisma.loanRequest.findUnique({
    where: { id: requestId },
    include: { item: { select: { title: true, mode: true, price: true, currency: true, ownerId: true } }, payment: true },
  })
  if (!loanRequest) return res.status(404).json({ ok: false, error: 'REQUEST_NOT_FOUND' })
  if (loanRequest.requesterId !== profile.id) return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  if (loanRequest.item.mode !== 'RENTAL' || loanRequest.item.price === null || !loanRequest.item.currency) {
    return res.status(400).json({ ok: false, error: 'NOT_A_RENTAL_REQUEST' })
  }
  if (loanRequest.status !== 'PENDING') return res.status(409).json({ ok: false, error: 'REQUEST_NOT_PENDING' })
  if (loanRequest.payment?.status === 'SIMULATED_PAID') {
    return res.status(200).json({ ok: true, payment: serializePayment(loanRequest.payment), idempotencyReplay: true })
  }
  if (!await verifyProof(req, profile, proofPath)) return res.status(422).json({ ok: false, error: 'PAYMENT_PROOF_REQUIRED' })
  const transferSnapshot = await mobileTransferSnapshot(loanRequest.item.price!, loanRequest.item.currency!)

  const payment = await prisma.$transaction(async tx => {
    const pending = await tx.loanRequest.updateMany({
      where: { id: requestId, requesterId: profile.id, status: 'PENDING' },
      data: { status: 'PENDING' },
    })
    if (!pending.count) throw new Error('REQUEST_NOT_PENDING')
    const saved = await tx.payment.upsert({
      where: { requestId },
      create: {
        userId: profile.id,
        requestId,
        purpose: 'RENTAL',
        amount: loanRequest.item.price!,
        currency: loanRequest.item.currency!,
        status: 'SIMULATED_PAID',
        provider: 'mobile-payment-simulation',
        providerReference: reference,
        proofPath,
        payerBank: bank,
        payerPhone: phone,
        payerNationalId: nationalId,
        ...transferSnapshot,
      },
      update: {
        purpose: 'RENTAL',
        amount: loanRequest.item.price!,
        currency: loanRequest.item.currency!,
        status: 'SIMULATED_PAID',
        provider: 'mobile-payment-simulation',
        providerReference: reference,
        proofPath,
        payerBank: bank,
        payerPhone: phone,
        payerNationalId: nationalId,
        ...transferSnapshot,
      },
    })
    await upsertWalletCredit({
      tx,
      paymentId: saved.id,
      userId: loanRequest.item.ownerId,
      amount: Number(loanRequest.item.price!.toString()),
      currency: loanRequest.item.currency!,
      type: 'RENTAL_CREDIT',
      description: `Alquiler: ${loanRequest.item.title}`,
    })
    await addNotification(tx, {
      userId: loanRequest.item.ownerId,
      type: 'PAYMENT_RECEIVED',
      title: 'Pago de alquiler recibido',
      message: `El alquiler de «${loanRequest.item.title}» ya está pagado. Puedes revisar la solicitud.`,
      href: '/solicitudes',
    })
    return saved
  })

  return res.status(200).json({ ok: true, payment: serializePayment(payment), approved: true })
}

async function submitWalletTopUp(req: ApiRequest, res: ApiResponse, profile: AuthenticatedProfile) {
  const parsed = topUpSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID_TOP_UP_DETAILS' })
  const { idempotencyKey, amount, currency, proofPath, reference, bank, phone, nationalId } = parsed.data
  if (!await centralAccount()) return res.status(503).json({ ok: false, error: 'PAYMENT_DESTINATION_NOT_CONFIGURED' })

  const prior = await prisma.payment.findUnique({ where: { idempotencyKey } })
  if (prior) {
    if (prior.userId !== profile.id || prior.purpose !== 'WALLET_TOP_UP' || Number(prior.amount.toString()) !== amount || prior.currency !== currency) {
      return res.status(409).json({ ok: false, error: 'IDEMPOTENCY_KEY_REUSED' })
    }
    if (prior.status === 'SIMULATED_PAID') return res.status(200).json({ ok: true, payment: serializePayment(prior), idempotencyReplay: true })
  }
  if (!await verifyProof(req, profile, proofPath)) return res.status(422).json({ ok: false, error: 'PAYMENT_PROOF_REQUIRED' })
  const transferSnapshot = await mobileTransferSnapshot(new Prisma.Decimal(amount), currency)

  const payment = await prisma.$transaction(async tx => {
    const saved = await tx.payment.upsert({
      where: { idempotencyKey },
      create: {
        userId: profile.id,
        idempotencyKey,
        purpose: 'WALLET_TOP_UP',
        amount,
        currency,
        status: 'SIMULATED_PAID',
        provider: 'mobile-payment-simulation',
        providerReference: reference,
        proofPath,
        payerBank: bank,
        payerPhone: phone,
        payerNationalId: nationalId,
        ...transferSnapshot,
      },
      update: {},
    })
    await upsertWalletCredit({
      tx,
      paymentId: saved.id,
      userId: profile.id,
      amount,
      currency,
      type: 'WALLET_TOP_UP',
      description: 'Recarga de saldo',
    })
    return saved
  })

  return res.status(200).json({ ok: true, payment: serializePayment(payment), approved: true })
}

async function submitWalletRental(req: ApiRequest, res: ApiResponse, profile: AuthenticatedProfile) {
  const parsed = walletRentalSchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'INVALID_REQUEST_ID' })
  const { requestId } = parsed.data
  const loanRequest = await prisma.loanRequest.findUnique({
    where: { id: requestId },
    include: { item: { select: { title: true, mode: true, price: true, currency: true, ownerId: true } }, payment: true },
  })
  if (!loanRequest) return res.status(404).json({ ok: false, error: 'REQUEST_NOT_FOUND' })
  if (loanRequest.requesterId !== profile.id) return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  if (loanRequest.item.mode !== 'RENTAL' || loanRequest.item.price === null || !loanRequest.item.currency) {
    return res.status(400).json({ ok: false, error: 'NOT_A_RENTAL_REQUEST' })
  }
  if (loanRequest.status !== 'PENDING') return res.status(409).json({ ok: false, error: 'REQUEST_NOT_PENDING' })
  if (loanRequest.payment?.status === 'SIMULATED_PAID') {
    return res.status(200).json({ ok: true, payment: serializePayment(loanRequest.payment), idempotencyReplay: true })
  }

  const payment = await prisma.$transaction(async tx => {
    const pending = await tx.loanRequest.updateMany({
      where: { id: requestId, requesterId: profile.id, status: 'PENDING' },
      data: { status: 'PENDING' },
    })
    if (!pending.count) throw new Error('REQUEST_NOT_PENDING')
    const account = await tx.walletAccount.findUnique({
      where: { userId_currency: { userId: profile.id, currency: loanRequest.item.currency! } },
    })
    if (!account || account.balance.lessThan(loanRequest.item.price!)) throw new Error('WALLET_INSUFFICIENT_FUNDS')

    const saved = await tx.payment.upsert({
      where: { requestId },
      create: {
        userId: profile.id,
        requestId,
        purpose: 'RENTAL',
        amount: loanRequest.item.price!,
        currency: loanRequest.item.currency!,
        status: 'SIMULATED_PAID',
        provider: 'wallet',
        providerReference: `WALLET-${Date.now().toString(36).toUpperCase()}`,
      },
      update: {
        purpose: 'RENTAL',
        amount: loanRequest.item.price!,
        currency: loanRequest.item.currency!,
        status: 'SIMULATED_PAID',
        provider: 'wallet',
        providerReference: `WALLET-${Date.now().toString(36).toUpperCase()}`,
      },
    })

    const debited = await tx.walletAccount.updateMany({
      where: { id: account.id, balance: { gte: loanRequest.item.price! } },
      data: { balance: { decrement: loanRequest.item.price! } },
    })
    if (debited.count !== 1) throw new Error('WALLET_INSUFFICIENT_FUNDS')
    await tx.walletTransaction.create({
      data: {
        accountId: account.id,
        userId: profile.id,
        paymentId: saved.id,
        type: 'RENTAL_DEBIT',
        amount: loanRequest.item.price!.mul(-1),
        description: `Alquiler: ${loanRequest.item.title}`,
      },
    })
    await upsertWalletCredit({
      tx,
      paymentId: saved.id,
      userId: loanRequest.item.ownerId,
      amount: Number(loanRequest.item.price!.toString()),
      currency: loanRequest.item.currency!,
      type: 'RENTAL_CREDIT',
      description: `Alquiler: ${loanRequest.item.title}`,
    })
    await addNotification(tx, {
      userId: loanRequest.item.ownerId,
      type: 'PAYMENT_RECEIVED',
      title: 'Pago de alquiler recibido',
      message: `El alquiler de «${loanRequest.item.title}» ya está pagado. Puedes revisar la solicitud.`,
      href: '/solicitudes',
    })
    return saved
  })

  return res.status(200).json({ ok: true, payment: serializePayment(payment), approved: true })
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }
  try {
    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) return res.status(statusForProfileError(error)).json({ ok: false, error })

    const view = queryValue(req.query?.view)
    const action = (req.body as { action?: unknown } | null)?.action
    if (req.method === 'GET' && view === 'admin-settings') {
      if (!profile.permissions.includes('payments.manage')) return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
      return res.status(200).json({ ok: true, centralAccount: await centralAccount() })
    }
    if (req.method === 'POST' && action === 'save-central-account') {
      if (!profile.permissions.includes('payments.manage')) return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
      return saveCentralAccount(req, res)
    }

    if (isAdministrativeProfile(profile)) return res.status(403).json({ ok: false, error: 'ADMIN_MARKETPLACE_FORBIDDEN' })

    if (req.method === 'GET') return getPayment(req, res, profile)
    if (action === 'mobile-rental') return submitMobileRental(req, res, profile)
    if (action === 'wallet-top-up') return submitWalletTopUp(req, res, profile)
    if (action === 'wallet-rental') return submitWalletRental(req, res, profile)
    return res.status(400).json({ ok: false, error: 'INVALID_PAYMENT_ACTION' })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    if (code === 'WALLET_INSUFFICIENT_FUNDS') return res.status(409).json({ ok: false, error: code })
    if (code === 'REQUEST_NOT_PENDING') return res.status(409).json({ ok: false, error: code })
    if (code === 'BCV_RATE_UNAVAILABLE') return res.status(503).json({ ok: false, error: code })
    if (code === 'UNSUPPORTED_PAYMENT_CURRENCY') return res.status(400).json({ ok: false, error: code })
    console.error('Payments API error:', code || 'unknown')
    return res.status(500).json({ ok: false, error: 'PAYMENTS_API_FAILED' })
  }
}
