import { describe, expect, it } from 'vitest'
import { DRAFT_SAVED_TEXT, isDraftSaved, savedText, showSetupValue } from '@/lib/setupLabels'

describe('showSetupValue', () => {
  it('shows nothing as a dash and booleans as Yes or No', () => {
    expect(showSetupValue('zoneName', null)).toBe('—')
    expect(showSetupValue('description', '')).toBe('—')
    expect(showSetupValue('active', true)).toBe('Yes')
    expect(showSetupValue('active', false)).toBe('No')
  })
  it('shows a centre point as its two numbers, and a missing one as a dash', () => {
    expect(showSetupValue('center', { lat: 18.5, lng: 73.8 })).toBe('18.5, 73.8')
    expect(showSetupValue('center', {})).toBe('—')
  })
  it('names regions, and says None for an empty list', () => {
    const name = (id: string) => ({ r1: 'Pune', r2: 'Noida' } as Record<string, string>)[id] ?? id
    expect(showSetupValue('regionIds', ['r1', 'r2'], name)).toBe('Pune, Noida')
    expect(showSetupValue('regionIds', [], name)).toBe('None')
    expect(showSetupValue('regionIds', ['rX'], name)).toBe('rX')
  })
  it('shows numbers and text as they are', () => {
    expect(showSetupValue('passengerCapacity', 4)).toBe('4')
    expect(showSetupValue('name', 'Auto')).toBe('Auto')
  })
})

describe('draft saves', () => {
  it('recognises the draft answer and nothing else', () => {
    expect(isDraftSaved({ draft: true, drafts: [] })).toBe(true)
    expect(isDraftSaved({ id: 'r1', city: 'Pune' })).toBe(false)
    expect(isDraftSaved(null)).toBe(false)
    expect(isDraftSaved('draft')).toBe(false)
  })
  it('uses the draft wording for a draft and the live wording otherwise', () => {
    expect(savedText({ draft: true, drafts: [] }, () => 'live')).toBe(DRAFT_SAVED_TEXT)
    expect(savedText({ city: 'Pune' }, (r: { city: string }) => `${r.city} saved`)).toBe('Pune saved')
  })
})
