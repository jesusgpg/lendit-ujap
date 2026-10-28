import { describe, expect, it } from 'vitest'
import { isInstitutionalEmail, isAllowedCampusEmail } from './emailPolicy'

describe('shared/emailPolicy suite', () => {
  describe('isInstitutionalEmail — pureza semántica', () => {
    it('acepta correos institucionales válidos @ujap.edu.ve', () => {
      expect(isInstitutionalEmail('estudiante@ujap.edu.ve')).toBe(true)
      expect(isInstitutionalEmail('docente.qa@ujap.edu.ve')).toBe(true)
      expect(isInstitutionalEmail('ESTUDIANTE@UJAP.EDU.VE')).toBe(true)
      expect(isInstitutionalEmail('  alumno@ujap.edu.ve  ')).toBe(true)
    })

    it('rechaza correos personales y no institucionales', () => {
      expect(isInstitutionalEmail('jesusp2095@hotmail.com')).toBe(false)
      expect(isInstitutionalEmail('usuario@gmail.com')).toBe(false)
      expect(isInstitutionalEmail('estudiante@ujap.com')).toBe(false)
      expect(isInstitutionalEmail('estudiante@sub.ujap.edu.ve')).toBe(false)
      expect(isInstitutionalEmail('')).toBe(false)
      expect(isInstitutionalEmail('   ')).toBe(false)
      expect(isInstitutionalEmail('invalido')).toBe(false)
    })
  })

  describe('isAllowedCampusEmail — desarrollo, producción, Vercel, allowlist y dominios', () => {
    const qaEmail = 'jesusp2095@hotmail.com'
    const allowlist = 'jesusp2095@hotmail.com, qa.dev@example.com'

    describe('Dominio institucional', () => {
      it('acepta institucional en desarrollo con allowlist', () => {
        expect(isAllowedCampusEmail('estudiante@ujap.edu.ve', {
          development: true,
          allowlist,
        })).toBe(true)
      })

      it('acepta institucional en producción con allowlist', () => {
        expect(isAllowedCampusEmail('estudiante@ujap.edu.ve', {
          development: false,
          allowlist,
        })).toBe(true)
      })

      it('acepta institucional en Vercel', () => {
        expect(isAllowedCampusEmail('estudiante@ujap.edu.ve', {
          development: true,
          vercel: true,
          allowlist,
        })).toBe(true)
      })

      it('acepta institucional con allowlist vacía', () => {
        expect(isAllowedCampusEmail('estudiante@ujap.edu.ve', {
          development: false,
          allowlist: '',
        })).toBe(true)
      })
    })

    describe('Correos personales en desarrollo local', () => {
      it('acepta correo personal presente en allowlist (coincidencia exacta)', () => {
        expect(isAllowedCampusEmail(qaEmail, {
          development: true,
          allowlist,
        })).toBe(true)
      })

      it('normaliza trim y lowercase en correo y allowlist', () => {
        expect(isAllowedCampusEmail('  JESUSP2095@HOTMAIL.COM  ', {
          development: true,
          allowlist: '  jesusp2095@hotmail.com  , otro@example.com',
        })).toBe(true)

        expect(isAllowedCampusEmail('qa.dev@example.com', {
          development: true,
          allowlist: '  QA.DEV@EXAMPLE.COM  ',
        })).toBe(true)
      })

      it('rechaza correo personal ausente en allowlist', () => {
        expect(isAllowedCampusEmail('intruso@gmail.com', {
          development: true,
          allowlist,
        })).toBe(false)
      })

      it('rechaza coincidencias parciales o subcadenas', () => {
        expect(isAllowedCampusEmail('jesusp2095@hotmail.com.ve', {
          development: true,
          allowlist: 'jesusp2095@hotmail.com',
        })).toBe(false)

        expect(isAllowedCampusEmail('fakejesusp2095@hotmail.com', {
          development: true,
          allowlist: 'jesusp2095@hotmail.com',
        })).toBe(false)
      })

      it('rechaza correo vacío o con formato inválido', () => {
        expect(isAllowedCampusEmail('', {
          development: true,
          allowlist,
        })).toBe(false)

        expect(isAllowedCampusEmail('   ', {
          development: true,
          allowlist,
        })).toBe(false)

        expect(isAllowedCampusEmail('no-email', {
          development: true,
          allowlist: 'no-email',
        })).toBe(false)
      })
    })

    describe('Entorno de producción — NUNCA excepción', () => {
      it('rechaza correo personal aunque esté en allowlist si development es false', () => {
        expect(isAllowedCampusEmail(qaEmail, {
          development: false,
          allowlist,
        })).toBe(false)
      })

      it('rechaza cualquier correo personal en producción', () => {
        expect(isAllowedCampusEmail('otro@gmail.com', {
          development: false,
          allowlist,
        })).toBe(false)
      })
    })

    describe('Entorno Vercel — NUNCA excepción para QA personal', () => {
      it('rechaza correo personal si vercel es true incluso con development true', () => {
        expect(isAllowedCampusEmail(qaEmail, {
          development: true,
          vercel: true,
          allowlist,
        })).toBe(false)
      })

      it('rechaza correo personal si vercel es true y development false', () => {
        expect(isAllowedCampusEmail(qaEmail, {
          development: false,
          vercel: true,
          allowlist,
        })).toBe(false)
      })
    })

    describe('Allowlist vacía', () => {
      it('rechaza correo personal si allowlist está vacía en desarrollo', () => {
        expect(isAllowedCampusEmail(qaEmail, {
          development: true,
          allowlist: '',
        })).toBe(false)
      })

      it('rechaza correo personal si allowlist contiene solo espacios o comas', () => {
        expect(isAllowedCampusEmail(qaEmail, {
          development: true,
          allowlist: '   ,  ,   ',
        })).toBe(false)
      })
    })
  })
})
