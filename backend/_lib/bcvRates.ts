export interface BCVExchangeRates {
  USD: number
  EUR: number
  effectiveDate: string
  updatedAt: string
  sourceUrl: string
}

const RATE_URL = 'https://bcv.today/api/v1/rate.json'
const SOURCE_URL = 'https://bcv.today/api/'
const CACHE_MS = 15 * 60 * 1000
const MAX_EFFECTIVE_AGE_DAYS = 7
const MAX_FUTURE_DAYS = 2

let cachedRates: BCVExchangeRates | null = null
let cacheExpiresAt = 0

function isValidRate(value: unknown): value is number | string {
  return (typeof value === 'number' || typeof value === 'string')
    && Number.isFinite(Number(value))
    && Number(value) > 0
}

function caracasDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function validateEffectiveDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(timestamp)) return false
  const today = Date.parse(`${caracasDate()}T00:00:00.000Z`)
  const deltaDays = Math.round((today - timestamp) / 86_400_000)
  return deltaDays <= MAX_EFFECTIVE_AGE_DAYS && deltaDays >= -MAX_FUTURE_DAYS
}

export async function getBCVExchangeRates(): Promise<BCVExchangeRates> {
  if (cachedRates && Date.now() < cacheExpiresAt) return cachedRates

  try {
    const response = await fetch(RATE_URL, {
      headers: { accept: 'application/json', 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('BCV_RATE_HTTP_ERROR')
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object') throw new Error('BCV_RATE_INVALID_RESPONSE')

    const data = payload as Record<string, unknown>
    const effectiveDate = data.effective_date ?? data.date
    if (!isValidRate(data.USD) || !isValidRate(data.EUR) || !validateEffectiveDate(effectiveDate)) {
      throw new Error('BCV_RATE_INVALID_OR_STALE')
    }

    const updatedAt = typeof data.updated_at === 'string' && Number.isFinite(Date.parse(data.updated_at))
      ? data.updated_at
      : new Date().toISOString()

    cachedRates = {
      USD: Number(data.USD),
      EUR: Number(data.EUR),
      effectiveDate: String(effectiveDate),
      updatedAt,
      sourceUrl: SOURCE_URL,
    }
    cacheExpiresAt = Date.now() + CACHE_MS
    return cachedRates
  } catch {
    throw new Error('BCV_RATE_UNAVAILABLE')
  }
}
