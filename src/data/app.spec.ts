import { describe, expect, it } from 'vitest'
import { getAppName, getAppTagline } from './app'

describe('app data', () => {
  it('returns the app name', () => {
    expect(getAppName()).toBe('LendIt UJAP')
  })

  it('returns a non-empty tagline', () => {
    expect(getAppTagline().length).toBeGreaterThan(0)
  })
})
