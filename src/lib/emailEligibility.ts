import { isInstitutionalEmail } from '../../shared/emailPolicy'

export function isEligibleCampusEmail(email: string) {
  return isInstitutionalEmail(email)
}
