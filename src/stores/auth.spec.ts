import { describe, expect, it } from 'vitest'
import { isInstitutionalEmail, isValidEmail } from './auth'

describe('email access rules', () => {
  it('accepts only the institutional UJAP domain for community accounts', () => {
    expect(isInstitutionalEmail('estudiante@ujap.edu.ve')).toBe(true)
    expect(isInstitutionalEmail('ESTUDIANTE@UJAP.EDU.VE')).toBe(true)
    expect(isInstitutionalEmail('estudiante@gmail.com')).toBe(false)
    expect(isInstitutionalEmail('estudiante@sub.ujap.edu.ve')).toBe(false)
  })

  it('accepts valid public email addresses for the admin entry point', () => {
    expect(isValidEmail('admin@gmail.com')).toBe(true)
    expect(isValidEmail('admin@ujap.edu.ve')).toBe(true)
    expect(isValidEmail('admin@')).toBe(false)
  })
})
