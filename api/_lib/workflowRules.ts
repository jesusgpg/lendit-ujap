export function canManageOwnedResource(ownerId: string, actorId: string, permissions: string[]) {
  return ownerId === actorId || permissions.includes('users.manage')
}

export function canSeeRestrictedItem(visibleRoleIds: string[], actorRoleId: string) {
  return visibleRoleIds.length === 0 || visibleRoleIds.includes(actorRoleId)
}

export function rangesOverlap(start: Date, end: Date, otherStart: Date, otherEnd: Date) {
  return start < otherEnd && end > otherStart
}

export function requestDateError(startsAt: Date, endsAt: Date, now = new Date()) {
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
    return 'INVALID_REQUEST_DATES'
  }
  if (startsAt.getTime() < now.getTime() - 60_000 || endsAt <= startsAt) {
    return 'INVALID_REQUEST_DATES'
  }
  if (endsAt.getTime() - startsAt.getTime() > 1000 * 60 * 60 * 24 * 90) {
    return 'REQUEST_RANGE_TOO_LONG'
  }
  return null
}
