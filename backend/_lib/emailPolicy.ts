import { isInstitutionalEmail } from '../../shared/emailPolicy.js'

export function isEligibleCampusEmail(email: string) {
  return isInstitutionalEmail(email)
}
