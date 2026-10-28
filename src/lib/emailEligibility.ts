import { isAllowedCampusEmail } from '../../shared/emailPolicy'

export function isEligibleCampusEmail(email: string) {
  return isAllowedCampusEmail(email, {
    development: import.meta.env.DEV && !import.meta.env.PROD,
    allowlist: import.meta.env.VITE_QA_EMAIL_ALLOWLIST ?? '',
  })
}
