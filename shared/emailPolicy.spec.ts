import { describe, expect, it } from 'vitest'
import { isInstitutionalEmail, isAllowedCampusEmail } from './emailPolicy'

describe('política de correo institucional', () => {
  it('acepta únicamente direcciones del dominio ujap.edu.ve', () => {
    expect(isInstitutionalEmail('estudiante@ujap.edu.ve')).toBe(true)
    expect(isInstitutionalEmail('DOCENTE@UJAP.EDU.VE')).toBe(true)
    expect(isInstitutionalEmail('  alumno@ujap.edu.ve  ')).toBe(true)
    expect(isAllowedCampusEmail('docente@ujap.edu.ve')).toBe(true)
  })

  it.each([
    'jesusp2095@hotmail.com',
    'usuario@gmail.com',
    'persona@outlook.com',
    'alumno@ujap.com',
    'alumno@sub.ujap.edu.ve',
    '',
    'invalido',
  ])('rechaza correo no institucional: %s', email => {
    expect(isInstitutionalEmail(email)).toBe(false)
    expect(isAllowedCampusEmail(email, {
      development: true,
      allowlist: email,
    })).toBe(false)
  })
})
