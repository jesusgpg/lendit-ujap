export function isInstitutionalEmail(email: string) {
  return /^[^\s@]+@ujap\.edu\.ve$/i.test(email.trim())
}

export function isAllowedCampusEmail(
  email: string,
  _options?: { development: boolean; allowlist: string; vercel?: boolean },
) {
  return isInstitutionalEmail(email)
}
