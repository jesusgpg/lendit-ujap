import { z } from 'zod'
import { prisma } from './prisma.js'
import { hasPermission, type ApiRequest, type ApiResponse, type AuthenticatedProfile } from './auth.js'
import { canManageOwnedResource, canSeeRestrictedItem, requestDateError } from './workflowRules.js'

const newRequestSchema = z.object({
  resource: z.literal('request'),
  itemId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  message: z.string().trim().max(600).optional(),
})

const requestActionSchema = z.object({
  resource: z.literal('request'),
  action: z.enum(['approve', 'reject', 'cancel', 'return']),
  requestId: z.string().uuid().optional(),
  loanId: z.string().uuid().optional(),
})

const requestInclude = {
  item: {
    select: {
      id: true,
      code: true,
      title: true,
      ownerId: true,
      owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      mode: true,
      price: true,
      currency: true,
      category: { select: { label: true, icon: true } },
    },
  },
  requester: { select: { id: true, firstName: true, lastName: true, email: true } },
  payment: { select: { status: true, amount: true, currency: true } },
  loan: { select: { id: true, status: true, returnedAt: true } },
} as const

type RequestRecord = {
  id: string
  item: {
    id: string
    code: string
    title: string
    ownerId: string
    owner: { id: string; firstName: string; lastName: string; email: string }
    mode: string
    price: { toString: () => string } | null
    currency: string | null
    category: { label: string; icon: string | null }
  }
  requester: { id: string; firstName: string; lastName: string; email: string }
  startsAt: Date
  endsAt: Date
  message: string | null
  status: string
  payment: { status: string; amount: { toString: () => string }; currency: string } | null
  loan: { id: string; status: string; returnedAt: Date | null } | null
  createdAt: Date
}

class RequestWorkflowError extends Error {
  readonly statusCode: number
  readonly errorCode: string

  constructor(
    statusCode: number,
    errorCode: string,
  ) {
    super(errorCode)
    this.statusCode = statusCode
    this.errorCode = errorCode
  }
}

function serializeRequest(request: RequestRecord, profileId: string) {
  return {
    id: request.id,
    item: {
      id: request.item.id,
      code: request.item.code,
      title: request.item.title,
      category: request.item.category.label,
      categoryIcon: request.item.category.icon,
      owner: {
        id: request.item.owner.id,
        name: `${request.item.owner.firstName} ${request.item.owner.lastName}`.trim(),
        email: request.item.owner.email,
      },
      mode: request.item.mode === 'RENTAL' ? 'RENTAL' : 'LOAN',
      price: request.item.price === null ? null : Number(request.item.price.toString()),
      currency: request.item.currency,
    },
    requester: {
      id: request.requester.id,
      name: `${request.requester.firstName} ${request.requester.lastName}`.trim(),
      email: request.requester.email,
    },
    startsAt: request.startsAt.toISOString(),
    endsAt: request.endsAt.toISOString(),
    message: request.message,
    status: request.status,
    isOwner: request.item.ownerId === profileId,
    payment: request.payment
      ? {
          status: request.payment.status,
          amount: Number(request.payment.amount.toString()),
          currency: request.payment.currency,
        }
      : null,
    loan: request.loan
      ? {
          id: request.loan.id,
          status: request.loan.status,
          returnedAt: request.loan.returnedAt?.toISOString() ?? null,
        }
      : null,
    createdAt: request.createdAt.toISOString(),
  }
}

function parseDateRange(startsAt: string, endsAt: string) {
  const starts = new Date(startsAt)
  const ends = new Date(endsAt)
  const error = requestDateError(starts, ends)
  if (error) throw new RequestWorkflowError(400, error)

  return { starts, ends }
}

async function findRequest(requestId: string) {
  return prisma.loanRequest.findUnique({ where: { id: requestId }, include: requestInclude })
}

export async function listRequests(profile: AuthenticatedProfile, res: ApiResponse) {
  try {
    const requests = await prisma.loanRequest.findMany({
      where: {
        OR: [{ requesterId: profile.id }, { item: { ownerId: profile.id } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: requestInclude,
    })

    return res.status(200).json({
      ok: true,
      requests: requests.map((request) => serializeRequest(request, profile.id)),
    })
  } catch (error) {
    console.error('Requests list failed', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'REQUESTS_API_FAILED' })
  }
}

export async function handleRequestMutation(req: ApiRequest, res: ApiResponse, profile: AuthenticatedProfile) {
  try {
    if (!hasPermission(profile, 'items.rent')) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
    }

    if (req.method === 'POST') {
      return await createRequest(req, res, profile)
    }
    if (req.method === 'PATCH') {
      return await updateRequest(req, res, profile)
    }
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  } catch (error) {
    if (error instanceof RequestWorkflowError) {
      return res.status(error.statusCode).json({ ok: false, error: error.errorCode })
    }
    console.error('Request workflow failed', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'REQUESTS_API_FAILED' })
  }
}

async function createRequest(req: ApiRequest, res: ApiResponse, profile: AuthenticatedProfile) {
  const parsed = newRequestSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'INVALID_REQUEST' })
  }

  const { starts, ends } = parseDateRange(parsed.data.startsAt, parsed.data.endsAt)
  const item = await prisma.item.findUnique({
    where: { id: parsed.data.itemId },
    select: {
      id: true,
      ownerId: true,
      status: true,
      mode: true,
      price: true,
      currency: true,
      visibleToRoles: { select: { roleId: true } },
    },
  })
  if (!item) {
    return res.status(404).json({ ok: false, error: 'ITEM_NOT_FOUND' })
  }
  if (item.ownerId === profile.id) {
    return res.status(400).json({ ok: false, error: 'CANNOT_REQUEST_OWN_ITEM' })
  }
  if (item.status !== 'AVAILABLE') {
    return res.status(409).json({ ok: false, error: 'ITEM_NOT_AVAILABLE' })
  }
  if (!canSeeRestrictedItem(item.visibleToRoles.map(({ roleId }) => roleId), profile.roleId)) {
    return res.status(403).json({ ok: false, error: 'ITEM_NOT_VISIBLE' })
  }

  const conflict = await prisma.loanRequest.findFirst({
    where: {
      itemId: item.id,
      status: { in: ['PENDING', 'APPROVED'] },
      startsAt: { lt: ends },
      endsAt: { gt: starts },
    },
    select: { id: true },
  })
  if (conflict) {
    return res.status(409).json({ ok: false, error: 'ITEM_REQUESTED_IN_RANGE' })
  }

  const request = await prisma.$transaction(async (transaction) => {
    const created = await transaction.loanRequest.create({
      data: {
        itemId: item.id,
        requesterId: profile.id,
        startsAt: starts,
        endsAt: ends,
        message: parsed.data.message || null,
      },
    })

    if (item.mode === 'RENTAL' && item.price !== null && item.currency !== null) {
      await transaction.payment.create({
        data: {
          userId: profile.id,
          requestId: created.id,
          amount: item.price,
          currency: item.currency,
          status: 'SIMULATED_PAID',
          provider: 'simulation',
          providerReference: `SIM-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
        },
      })
    }

    return transaction.loanRequest.findUniqueOrThrow({ where: { id: created.id }, include: requestInclude })
  })

  return res.status(201).json({ ok: true, request: serializeRequest(request, profile.id) })
}

async function updateRequest(req: ApiRequest, res: ApiResponse, profile: AuthenticatedProfile) {
  const parsed = requestActionSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'INVALID_REQUEST_ACTION' })
  }

  if (parsed.data.action === 'return') {
    if (!parsed.data.loanId) {
      return res.status(400).json({ ok: false, error: 'INVALID_REQUEST_ACTION' })
    }
    return await returnLoan(parsed.data.loanId, res, profile)
  }
  if (!parsed.data.requestId) {
    return res.status(400).json({ ok: false, error: 'INVALID_REQUEST_ACTION' })
  }

  const request = await findRequest(parsed.data.requestId)
  if (!request) {
    return res.status(404).json({ ok: false, error: 'REQUEST_NOT_FOUND' })
  }

  const isRequester = request.requester.id === profile.id
  const canManage = canManageOwnedResource(request.item.ownerId, profile.id, profile.permissions)
  if ((parsed.data.action === 'approve' || parsed.data.action === 'reject') && !canManage) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }
  if (parsed.data.action === 'cancel' && !isRequester) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }
  if (request.status !== 'PENDING') {
    return res.status(409).json({ ok: false, error: 'REQUEST_ALREADY_PROCESSED' })
  }

  if (parsed.data.action === 'approve') {
    return await approveRequest(parsed.data.requestId, res, profile)
  }
  return await rejectOrCancelRequest(parsed.data.requestId, parsed.data.action, res, profile)
}

async function approveRequest(requestId: string, res: ApiResponse, profile: AuthenticatedProfile) {
  const request = await findRequest(requestId)
  if (!request || !canManageOwnedResource(request.item.ownerId, profile.id, profile.permissions)) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }

  try {
    const approved = await prisma.$transaction(async (transaction) => {
      const current = await transaction.loanRequest.findUnique({
        where: { id: requestId },
        include: requestInclude,
      })
      if (!current || current.status !== 'PENDING') {
        throw new RequestWorkflowError(409, 'REQUEST_ALREADY_PROCESSED')
      }

      const conflict = await transaction.loanRequest.findFirst({
        where: {
          itemId: current.itemId,
          id: { not: current.id },
          status: { in: ['PENDING', 'APPROVED'] },
          startsAt: { lt: current.endsAt },
          endsAt: { gt: current.startsAt },
        },
        select: { id: true },
      })
      if (conflict) {
        throw new RequestWorkflowError(409, 'ITEM_REQUESTED_IN_RANGE')
      }

       // Claim the item conditionally so concurrent approvals cannot create two active loans.
       const claimedItem = await transaction.item.updateMany({
         where: { id: current.itemId, status: 'AVAILABLE' },
         data: { status: 'LENT' },
       })
       if (!claimedItem.count) {
         throw new RequestWorkflowError(409, 'ITEM_NOT_AVAILABLE')
       }

      const updated = await transaction.loanRequest.update({
        where: { id: current.id },
        data: { status: 'APPROVED' },
      })
      const loan = await transaction.loan.create({
        data: {
          itemId: current.itemId,
          ownerId: current.item.ownerId,
          borrowerId: current.requester.id,
          requestId: current.id,
          startsAt: current.startsAt,
          endsAt: current.endsAt,
          status: 'ACTIVE',
        },
      })
       if (current.payment) {
        await transaction.payment.update({ where: { requestId: current.id }, data: { loanId: loan.id } })
      }

      const competing = await transaction.loanRequest.findMany({
        where: {
          itemId: current.itemId,
          id: { not: current.id },
          status: 'PENDING',
          startsAt: { lt: current.endsAt },
          endsAt: { gt: current.startsAt },
        },
        select: { id: true },
      })
      if (competing.length) {
        const ids = competing.map(({ id }) => id)
        await transaction.loanRequest.updateMany({ where: { id: { in: ids } }, data: { status: 'REJECTED' } })
        await transaction.payment.updateMany({
          where: { requestId: { in: ids } },
          data: { status: 'REFUNDED' },
        })
      }

      return transaction.loanRequest.findUniqueOrThrow({ where: { id: updated.id }, include: requestInclude })
    })

    return res.status(200).json({ ok: true, request: serializeRequest(approved, profile.id) })
  } catch (error) {
    if (error instanceof RequestWorkflowError) {
      return res.status(error.statusCode).json({ ok: false, error: error.errorCode })
    }
    throw error
  }
}

async function rejectOrCancelRequest(
  requestId: string,
  action: 'reject' | 'cancel',
  res: ApiResponse,
  profile: AuthenticatedProfile,
) {
  const request = await findRequest(requestId)
  if (!request) {
    return res.status(404).json({ ok: false, error: 'REQUEST_NOT_FOUND' })
  }
  const status = action === 'reject' ? 'REJECTED' : 'CANCELLED'

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const result = await transaction.loanRequest.updateMany({
        where: { id: requestId, status: 'PENDING' },
        data: { status },
      })
      if (!result.count) {
        throw new RequestWorkflowError(409, 'REQUEST_ALREADY_PROCESSED')
      }
      await transaction.payment.updateMany({
        where: { requestId },
        data: { status: 'REFUNDED' },
      })
      return transaction.loanRequest.findUniqueOrThrow({ where: { id: requestId }, include: requestInclude })
    })

    return res.status(200).json({ ok: true, request: serializeRequest(updated, profile.id) })
  } catch (error) {
    if (error instanceof RequestWorkflowError) {
      return res.status(error.statusCode).json({ ok: false, error: error.errorCode })
    }
    throw error
  }
}

async function returnLoan(loanId: string, res: ApiResponse, profile: AuthenticatedProfile) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { id: true, ownerId: true, borrowerId: true, itemId: true, requestId: true, status: true },
  })
  if (!loan) {
    return res.status(404).json({ ok: false, error: 'LOAN_NOT_FOUND' })
  }
  if (loan.ownerId !== profile.id && loan.borrowerId !== profile.id) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }
  if (loan.status !== 'ACTIVE') {
    return res.status(409).json({ ok: false, error: 'LOAN_ALREADY_CLOSED' })
  }

  const request = await prisma.$transaction(async (transaction) => {
    const returned = await transaction.loan.updateMany({
      where: { id: loan.id, status: 'ACTIVE' },
      data: { status: 'RETURNED', returnedAt: new Date() },
    })
    if (!returned.count) {
      throw new RequestWorkflowError(409, 'LOAN_ALREADY_CLOSED')
    }

    await transaction.item.update({ where: { id: loan.itemId }, data: { status: 'AVAILABLE' } })
    if (!loan.requestId) return null
    return transaction.loanRequest.findUniqueOrThrow({ where: { id: loan.requestId }, include: requestInclude })
  })

  return res.status(200).json({
    ok: true,
    request: request ? serializeRequest(request, profile.id) : null,
  })
}
