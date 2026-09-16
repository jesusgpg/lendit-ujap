import { describe, expect, it } from 'vitest'
import { canManageOwnedResource, canSeeRestrictedItem, rangesOverlap, requestDateError } from './workflowRules.js'

describe('workflow authorization rules', () => {
  it('allows the owner or a user administrator to manage a resource', () => {
    expect(canManageOwnedResource('owner', 'owner', [])).toBe(true)
    expect(canManageOwnedResource('owner', 'admin', ['users.manage'])).toBe(true)
    expect(canManageOwnedResource('owner', 'other', [])).toBe(false)
  })

  it('only exposes restricted items to matching roles', () => {
    expect(canSeeRestrictedItem([], 'STUDENT')).toBe(true)
    expect(canSeeRestrictedItem(['STUDENT'], 'STUDENT')).toBe(true)
    expect(canSeeRestrictedItem(['PROFESSOR'], 'STUDENT')).toBe(false)
  })

  it('detects overlapping request windows', () => {
    const start = new Date('2026-09-20T10:00:00Z')
    const end = new Date('2026-09-20T12:00:00Z')
    expect(rangesOverlap(start, end, new Date('2026-09-20T11:00:00Z'), new Date('2026-09-20T13:00:00Z'))).toBe(true)
    expect(rangesOverlap(start, end, new Date('2026-09-20T12:00:00Z'), new Date('2026-09-20T13:00:00Z'))).toBe(false)
  })

  it('rejects invalid, past, and excessively long request windows', () => {
    const now = new Date('2026-09-20T10:00:00Z')
    expect(requestDateError(new Date('invalid'), new Date('2026-09-20T11:00:00Z'), now)).toBe('INVALID_REQUEST_DATES')
    expect(requestDateError(new Date('2026-09-20T09:00:00Z'), new Date('2026-09-20T11:00:00Z'), now)).toBe(
      'INVALID_REQUEST_DATES',
    )
    expect(requestDateError(new Date('2026-09-20T10:00:00Z'), new Date('2026-12-21T10:00:00Z'), now)).toBe(
      'REQUEST_RANGE_TOO_LONG',
    )
  })
})
