import { z } from 'zod'
import { prisma } from './_lib/prisma.js'
import {
  getAuthenticatedProfile,
  isAdministrativeProfile,
  statusForProfileError,
  type ApiRequest,
  type ApiResponse,
  type AuthenticatedProfile,
} from './_lib/auth.js'

const querySchema = z.object({
  requestId: z.string().uuid(),
})

const simulatePaymentSchema = z.object({
  requestId: z.string().uuid(),
  outcome: z.enum(['success', 'failure']).default('success'),
  paymentMethod: z.enum(['campus_balance', 'fake_card', 'fake_mobile_pay']).default('campus_balance'),
})

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
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  try {
    const { profile, error } = await getAuthenticatedProfile(req)
    if (!profile) {
      return res.status(statusForProfileError(error)).json({ ok: false, error })
    }

    if (isAdministrativeProfile(profile)) return res.status(403).json({ ok: false, error: 'ADMIN_MARKETPLACE_FORBIDDEN' })
    if (req.method === 'GET') {
      return await getPayment(req, res, profile)
    }

    return await simulatePayment(req, res, profile)
  } catch (error) {
    console.error('Payments API error:', error instanceof Error ? error.message : 'unknown')
    return res.status(500).json({ ok: false, error: 'PAYMENTS_API_FAILED' })
  }
}

async function getPayment(req: ApiRequest, res: ApiResponse, profile: AuthenticatedProfile) {
  const parsed = querySchema.safeParse({ requestId: queryValue(req.query?.requestId) })
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'INVALID_REQUEST_ID' })
  }

  const loanRequest = await prisma.loanRequest.findUnique({
    where: { id: parsed.data.requestId },
    select: {
      id: true,
      requesterId: true,
      item: { select: { ownerId: true } },
      payment: true,
    },
  })

  if (!loanRequest) {
    return res.status(404).json({ ok: false, error: 'REQUEST_NOT_FOUND' })
  }

  const isAuthorized =
    loanRequest.requesterId === profile.id ||
    loanRequest.item.ownerId === profile.id ||
    profile.permissions.includes('users.manage')

  if (!isAuthorized) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  return res.status(200).json({
    ok: true,
    payment: loanRequest.payment ? serializePayment(loanRequest.payment) : null,
  })
}

async function simulatePayment(req: ApiRequest, res: ApiResponse, profile: AuthenticatedProfile) {
  const parsed = simulatePaymentSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'INVALID_PAYMENT_PAYLOAD' })
  }

  const { requestId, outcome, paymentMethod } = parsed.data

  const loanRequest = await prisma.loanRequest.findUnique({
    where: { id: requestId },
    include: {
      item: {
        select: {
          id: true,
          title: true,
          mode: true,
          price: true,
          currency: true,
          ownerId: true,
        },
      },
      payment: true,
    },
  })

  if (!loanRequest) {
    return res.status(404).json({ ok: false, error: 'REQUEST_NOT_FOUND' })
  }

  // Enforce requester authorization: only the person requesting the rental can pay for it
  if (loanRequest.requesterId !== profile.id) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  // Must be a rental request with a defined price and currency
  if (loanRequest.item.mode !== 'RENTAL' || loanRequest.item.price === null || !loanRequest.item.currency) {
    return res.status(400).json({ ok: false, error: 'NOT_A_RENTAL_REQUEST' })
  }

  // Request must still be in PENDING state to accept payment
  if (loanRequest.status !== 'PENDING') {
    return res.status(409).json({ ok: false, error: 'REQUEST_NOT_PENDING' })
  }

  // Idempotency: if already SIMULATED_PAID
  if (loanRequest.payment?.status === 'SIMULATED_PAID') {
    if (outcome === 'success') {
      return res.status(200).json({
        ok: true,
        payment: serializePayment(loanRequest.payment),
        idempotencyReplay: true,
        message: 'El pago ya se encontraba registrado como SIMULATED_PAID.',
      })
    }
    return res.status(409).json({
      ok: false,
      error: 'PAYMENT_ALREADY_COMPLETED',
      message: 'No se puede simular un fallo en un pago que ya fue completado con éxito.',
    })
  }

  const randomRefPart = crypto.randomUUID().slice(0, 8).toUpperCase()
  const timestampPart = Date.now().toString(36).toUpperCase()

  if (outcome === 'success') {
    const reference = `SIM-${timestampPart}-${randomRefPart}`
    const payment = await prisma.payment.upsert({
      where: { requestId },
      create: {
        userId: profile.id,
        requestId: loanRequest.id,
        amount: loanRequest.item.price,
        currency: loanRequest.item.currency,
        status: 'SIMULATED_PAID',
        provider: `simulation:${paymentMethod}`,
        providerReference: reference,
      },
      update: {
        amount: loanRequest.item.price,
        currency: loanRequest.item.currency,
        status: 'SIMULATED_PAID',
        provider: `simulation:${paymentMethod}`,
        providerReference: reference,
      },
    })

    return res.status(200).json({
      ok: true,
      payment: serializePayment(payment),
      message: 'Pago simulado completado con éxito.',
    })
  }

  // Failure simulation
  const failReference = `SIM-FAIL-${timestampPart}-${randomRefPart}`
  const payment = await prisma.payment.upsert({
    where: { requestId },
    create: {
      userId: profile.id,
      requestId: loanRequest.id,
      amount: loanRequest.item.price,
      currency: loanRequest.item.currency,
      status: 'FAILED',
      provider: `simulation:${paymentMethod}`,
      providerReference: failReference,
    },
    update: {
      amount: loanRequest.item.price,
      currency: loanRequest.item.currency,
      status: 'FAILED',
      provider: `simulation:${paymentMethod}`,
      providerReference: failReference,
    },
  })

  return res.status(200).json({
    ok: true,
    payment: serializePayment(payment),
    simulatedFailure: true,
    message: 'Simulación: El pago simulado fue rechazado de forma segura (fondos insuficientes o pasarela demo).',
  })
}
