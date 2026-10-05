import { describe, expect, it } from 'vitest'
import { BUSINESS_LOGIN, PLATFORM_LOGIN, isPlatformPath, loginPathFor } from './portal'
import { GST_STATES, isGstin, stateOfGstin } from './gstStates'

describe('sign-in addresses', () => {
  it('the platform owner and businesses have separate sign-ins', () => {
    expect(loginPathFor('super_admin')).toBe(PLATFORM_LOGIN)
    for (const r of ['client_admin', 'operations', 'support', 'finance'] as const) expect(loginPathFor(r)).toBe(BUSINESS_LOGIN)
    expect(PLATFORM_LOGIN).not.toBe(BUSINESS_LOGIN)
  })

  it('knows which pages belong to the platform owner', () => {
    for (const p of ['/platform', '/platform-team', '/platform-audit', '/platform-settings', '/businesses', '/businesses/app_x', '/plans', '/revenue']) expect(isPlatformPath(p), p).toBe(true)
    for (const p of ['/', '/drivers', '/trips', '/riders/abc', '/account', '/settings', '/team', '/login']) expect(isPlatformPath(p), p).toBe(false)
  })
})

describe('GSTIN helpers', () => {
  it('accepts a real-looking GSTIN and reads its state', () => {
    expect(isGstin('27AAPFU0939F1ZV')).toBe(true)
    expect(isGstin(' 29abcde1234f1z5 ')).toBe(true)
    expect(stateOfGstin('29ABCDE1234F1Z5')).toBe('29')
    expect(GST_STATES['29']).toBe('Karnataka')
  })

  it('refuses malformed ones', () => {
    for (const bad of ['', '27AAPFU0939F1Z', '99AAPFU0939F1ZV', 'ABAAPFU0939F1ZV', '27AAPFU0939F1AV']) expect(isGstin(bad), bad).toBe(false)
    expect(stateOfGstin('nope')).toBe('')
  })
})
