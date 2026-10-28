export function isInstitutionalEmail(email: string) {
  return /^[^\s@]+@ujap\.edu\.ve$/i.test(email.trim())
}

export function isAllowedCampusEmail(
  email: string,
  options: { development: boolean; allowlist: string; vercel?: boolean },
) {
  if (isInstitutionalEmail(email)) return true
  const normalized = email.trim().toLowerCase()
  if (!options.development || options.vercel || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false
  return options.allowlist.split(',').some(value => value.trim().toLowerCase() === normalized)
}
