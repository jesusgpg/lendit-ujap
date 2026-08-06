import { describe, expect, it } from 'vitest'
import { getAppName, getAppTagline, getItemCategories } from './app'

describe('app definitions', () => {
  it('returns the app name', () => {
    expect(getAppName()).toBe('LendIt UJAP')
  })

  it('returns a non-empty tagline', () => {
    expect(getAppTagline().length).toBeGreaterThan(0)
  })

  it('returns the item categories', () => {
    expect(getItemCategories()).toEqual([
      { id: 'calculadoras', label: 'Calculadoras' },
      { id: 'cargadores', label: 'Cargadores' },
      { id: 'equipo', label: 'Equipo' },
    ])
  })
})
