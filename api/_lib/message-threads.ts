import { prisma } from './prisma.js'

export const threadInclude = {
  item: { select: { id: true, title: true, photoUrl: true, ownerId: true, owner: { select: { id: true, firstName: true, lastName: true, photoUrl: true, isActive: true } } } },
  requester: { select: { id: true, firstName: true, lastName: true, photoUrl: true, isActive: true } },
  messages: { orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }], take: 1 },
}
export const requestThreadInclude = {
  item: threadInclude.item, requester: threadInclude.requester,
  loan: { select: { status: true } }, chatMessages: threadInclude.messages,
}
type Person = { id: string; firstName: string; lastName: string; photoUrl: string | null; isActive: boolean }
type LastMessage = { senderId: string; content: string; createdAt: Date }
type ThreadSource = {
  id: string; requesterId: string; createdAt: Date
  item: { id: string; title: string; photoUrl: string | null; ownerId: string; owner: Person }
  requester: Person; status?: string; loan?: { status: string } | null
  messages?: LastMessage[]; chatMessages?: LastMessage[]
}
export function serializeThread(source: ThreadSource, kind: 'request' | 'inquiry', userId: string) {
  const person = source.item.ownerId === userId ? source.requester : source.item.owner
  const latest = (source.messages ?? source.chatMessages)?.[0]
  const activeRequest = (!source.loan && (source.status === 'PENDING' || source.status === 'APPROVED')) || source.loan?.status === 'ACTIVE'
  return {
    id: source.id, kind,
    item: { id: source.item.id, title: source.item.title, photoUrl: source.item.photoUrl },
    counterpart: { id: person.id, name: `${person.firstName} ${person.lastName}`, photo: person.photoUrl },
    status: kind === 'inquiry' ? 'INQUIRY' : source.loan?.status ?? source.status ?? '',
    canSend: person.isActive && (kind === 'inquiry' || activeRequest),
    latestMessage: latest ? { senderId: latest.senderId, content: latest.content, createdAt: latest.createdAt.toISOString() } : null,
    updatedAt: (latest?.createdAt ?? source.createdAt).toISOString(),
  }
}
export async function findThread(kind: 'request' | 'inquiry', id: string, userId: string) {
  const source = kind === 'inquiry'
    ? await prisma.itemConversation.findUnique({ where: { id }, include: threadInclude })
    : await prisma.loanRequest.findUnique({ where: { id }, include: requestThreadInclude })
  if (!source) return { error: 'THREAD_NOT_FOUND' as const }
  if (source.requesterId !== userId && source.item.ownerId !== userId) return { error: 'FORBIDDEN' as const }
  return { thread: serializeThread(source, kind, userId) }
}
export async function inbox(userId: string, page: number) {
  const rows = await prisma.$queryRaw<Array<{ id: string; kind: 'request' | 'inquiry' }>>`
    SELECT t.id, t.kind FROM (
      SELECT r.id, 'request' AS kind, COALESCE(m.latest, r."createdAt") AS activity
      FROM "LoanRequest" r JOIN "Item" i ON i.id = r."itemId"
      LEFT JOIN LATERAL (SELECT max("createdAt") AS latest FROM "ChatMessage" WHERE "requestId" = r.id) m ON true
      WHERE r."requesterId" = ${userId}::uuid OR i."ownerId" = ${userId}::uuid
      UNION ALL
      SELECT c.id, 'inquiry' AS kind, COALESCE(m.latest, c."createdAt") AS activity
      FROM "ItemConversation" c JOIN "Item" i ON i.id = c."itemId"
      LEFT JOIN LATERAL (SELECT max("createdAt") AS latest FROM "ChatMessage" WHERE "conversationId" = c.id) m ON true
      WHERE c."requesterId" = ${userId}::uuid OR i."ownerId" = ${userId}::uuid
    ) t ORDER BY activity DESC, id DESC LIMIT 51 OFFSET ${page * 50}
  `
  const shown = rows.slice(0, 50)
  const [requests, conversations] = await Promise.all([
    prisma.loanRequest.findMany({ where: { id: { in: shown.filter(r => r.kind === 'request').map(r => r.id) } }, include: requestThreadInclude }),
    prisma.itemConversation.findMany({ where: { id: { in: shown.filter(r => r.kind === 'inquiry').map(r => r.id) } }, include: threadInclude }),
  ])
  const mapped = new Map<string, ReturnType<typeof serializeThread>>([
    ...requests.map(r => [`request:${r.id}`, serializeThread(r, 'request', userId)] as const),
    ...conversations.map(c => [`inquiry:${c.id}`, serializeThread(c, 'inquiry', userId)] as const),
  ])
  return { threads: shown.map(row => mapped.get(`${row.kind}:${row.id}`)).filter(Boolean), hasMore: rows.length > 50 }
}
