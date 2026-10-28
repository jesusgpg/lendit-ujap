import { isAllowedCampusEmail } from '../../shared/emailPolicy.js'

export function isEligibleCampusEmail(email: string) {
  return isAllowedCampusEmail(email, {
    development: process.env.NODE_ENV === 'development',
    vercel: Boolean(process.env.VERCEL),
    allowlist: process.env.QA_EMAIL_ALLOWLIST ?? '',
  })
}
