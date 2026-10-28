import { describe, expect, it } from 'vitest'
import type { AdminUser, Role } from './types'
import {
  EMPTY_FILTERS, canRefund, canResolveCash, filtersToQuery, findingLabel, fmtMinor, hasFilters, newIdempotencyKey, parseMinor, paymentState, paymentsAccess,
  minorToInput, remainingRefundable, summarise, validateCashResolution, validateFindingNote, validatePaymentSettings, validateRefund, validateWeather, type AdminPayment,
} from './payments'

const user = (role: Role): AdminUser => ({ id: 'u1', name: 'S', email: 's@x.test', role, tenantId: 't1' } as AdminUser)
const pay = (over: Partial<AdminPayment> = {}): AdminPayment => ({
  payment_id: 'pay_1', trip_id: 'T1', purpose: 'FARE', method: 'UPI', status: 'SUCCEEDED', refund_status: 'NONE', amount_minor: 20000, currency: 'INR', refunded_minor: 0,
  cash_state: null, awaiting_verification: false, expires_at: null, created_at: '2026-10-28T06:00:00Z', paid_at: '2026-10-28T06:01:00Z', driver_id: 'D1', rider_id: 'U1',
  provider: 'MOCK', provider_order_id: 'o1', ledger_txn_id: 'led_1', commission_snapshot: { commissionMinor: 3000, netMinor: 17000 }, cash: null, flags: [], history: [], refund: null, ...over,
})

describe('who may see and change payments', () => {
  it('finance and client admins may do both; operations and support neither', () => {
    expect(paymentsAccess(user('finance'))).toEqual({ view: true, manage: true })
    expect(paymentsAccess(user('client_admin'))).toEqual({ view: true, manage: true })
    expect(paymentsAccess(user('operations'))).toEqual({ view: false, manage: false })
    expect(paymentsAccess(user('support'))).toEqual({ view: false, manage: false })
    expect(paymentsAccess(user('super_admin'))).toEqual({ view: false, manage: false })
    expect(paymentsAccess(null)).toEqual({ view: false, manage: false })
  })
})

describe('money', () => {
  it('shows minor units in the currency, and a missing amount as a dash, never zero', () => {
    expect(fmtMinor(20050, 'INR').replace(/\s/g, '')).toMatch(/200\.50/)
    expect(fmtMinor(0, 'INR')).toMatch(/0\.00/)
    expect(fmtMinor(null, 'INR')).toBe('—')
    expect(fmtMinor(undefined, 'INR')).toBe('—')
    expect(fmtMinor(500, 'JPY')).toMatch(/500/)
  })

  it('puts an amount into a text box so that reading it back gives the same amount', () => {
    expect(minorToInput(20050, 'INR')).toBe('200.50')
    expect(minorToInput(500, 'JPY')).toBe('500')
    for (const m of [0, 1, 99, 20050, 123456789]) expect(parseMinor(minorToInput(m, 'INR'), 'INR')).toBe(m)
  })

  it('reads a typed amount into whole minor units without rounding, and refuses everything else', () => {
    expect(parseMinor('200', 'INR')).toBe(20000)
    expect(parseMinor('200.5', 'INR')).toBe(20050)
    expect(parseMinor(' 200.05 ', 'INR')).toBe(20005)
    expect(parseMinor('0', 'INR')).toBe(0)
    for (const bad of ['', 'abc', '-5', '10.555', '1e3', '1,000', '.', '12.', '99999999999']) expect(parseMinor(bad, 'INR'), bad).toBeNull()
    expect(parseMinor('500', 'JPY')).toBe(500)
    expect(parseMinor('500.5', 'JPY')).toBeNull()
  })
})

describe('reading a payment', () => {
  it('a cash dispute outranks the generic status, and cash states are in plain words', () => {
    expect(paymentState(pay({ method: 'CASH', status: 'PENDING', cash_state: 'DISPUTED' }))).toEqual({ label: 'In dispute', kind: 'bad' })
    expect(paymentState(pay({ method: 'CASH', status: 'PENDING', cash_state: 'PENDING' }))).toEqual({ label: 'Waiting for the driver', kind: 'warn' })
    expect(paymentState(pay({ method: 'CASH', status: 'SUCCEEDED', cash_state: 'CONFIRMED' }))).toEqual({ label: 'Driver confirmed', kind: 'ok' })
    expect(paymentState(pay())).toEqual({ label: 'Paid', kind: 'ok' })
    expect(paymentState(pay({ status: 'PENDING' }))).toEqual({ label: 'Waiting', kind: 'warn' })
  })

  it('what can still be refunded counts reservations for refunds still pending', () => {
    expect(remainingRefundable(pay())).toBe(20000)
    expect(remainingRefundable(pay({ refunded_minor: 5000, refund: null }))).toBe(15000)
    expect(remainingRefundable(pay({ refunded_minor: 0, refund: { reservedMinor: 20000, processedMinor: 0, commissionMinor: 3000, netMinor: 17000 } }))).toBe(0)
    expect(remainingRefundable(pay({ refunded_minor: 99999 }))).toBe(0)
  })

  it('only a paid online fare with something left can be refunded; only a disputed cash payment can be resolved', () => {
    expect(canRefund(pay())).toBe(true)
    expect(canRefund(pay({ status: 'PENDING' }))).toBe(false)
    expect(canRefund(pay({ method: 'CASH', cash_state: 'CONFIRMED' }))).toBe(false)
    expect(canRefund(pay({ purpose: 'COMMISSION' }))).toBe(false)
    expect(canRefund(pay({ refund: { reservedMinor: 20000, processedMinor: 20000, commissionMinor: 0, netMinor: 0 } }))).toBe(false)
    expect(canResolveCash(pay({ method: 'CASH', cash_state: 'DISPUTED' }))).toBe(true)
    expect(canResolveCash(pay({ method: 'CASH', cash_state: 'CONFIRMED' }))).toBe(false)
    expect(canResolveCash(pay())).toBe(false)
  })

  it('every dialog gets its own idempotency key', () => {
    const a = newIdempotencyKey(); const b = newIdempotencyKey()
    expect(a).not.toBe(b)
    expect(a.startsWith('dash-')).toBe(true)
  })
})

describe('filters and the summary', () => {
  it('blank filters are left out of the query, ids are trimmed, and a date range covers whole days', () => {
    const q = filtersToQuery({ ...EMPTY_FILTERS, status: 'FAILED', driverId: '  D1 ', from: '2026-10-01', to: '2026-10-28' })
    expect(q.status).toBe('FAILED')
    expect(q.driver_id).toBe('D1')
    expect(q.method).toBeUndefined()
    expect(q.trip_id).toBeUndefined()
    expect(q.limit).toBe(200)
    expect(new Date(q.from as string).getTime()).toBe(new Date('2026-10-01T00:00:00').getTime())
    expect(new Date(q.to as string).getTime()).toBe(new Date('2026-10-28T23:59:59.999').getTime())
    expect(filtersToQuery({ ...EMPTY_FILTERS, from: 'not a date' }).from).toBeUndefined()
  })

  it('knows whether any filter is in use', () => {
    expect(hasFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasFilters({ ...EMPTY_FILTERS, tripId: 'T1' })).toBe(true)
  })

  it('keeps online money, confirmed cash and cash still waiting apart, and counts what needs attention', () => {
    const s = summarise([
      pay(), pay({ amount_minor: 10000, refunded_minor: 4000 }),
      pay({ method: 'CASH', status: 'SUCCEEDED', cash_state: 'CONFIRMED', amount_minor: 30000 }),
      pay({ method: 'CASH', status: 'PENDING', cash_state: 'PENDING', amount_minor: 5000 }),
      pay({ method: 'CASH', status: 'PENDING', cash_state: 'DISPUTED', amount_minor: 7000 }),
      pay({ status: 'FAILED' }), pay({ status: 'PENDING', awaiting_verification: true }),
      pay({ flags: [{ at: 'x', reason: 'late' }] }), pay({ purpose: 'COMMISSION', amount_minor: 99999 }),
    ])
    expect(s.onlineCollected).toBe(20000 + 10000 + 20000)
    expect(s.cashConfirmed).toBe(30000)
    expect(s.cashWaiting).toBe(5000)
    expect(s.disputed).toBe(1)
    expect(s.failed).toBe(1)
    expect(s.awaitingVerification).toBe(1)
    expect(s.flagged).toBe(1)
    expect(s.refunded).toBe(4000)
    expect(s.count).toBe(9)
  })
})

describe('validating what an administrator types', () => {
  it('a refund needs a whole amount that is positive and not more than is left, and a reason', () => {
    const p = pay({ refunded_minor: 5000 })
    expect(validateRefund({ amount: '100', reason: 'rider complained' }, p)).toEqual({ amountMinor: 10000, errors: {} })
    expect(validateRefund({ amount: '150', reason: 'x' }, p).errors.reason).toBeTruthy()
    expect(validateRefund({ amount: '150.01', reason: 'enough' }, p).errors.amount).toMatch(/At most/)
    expect(validateRefund({ amount: '0', reason: 'enough' }, p).errors.amount).toBe('Enter more than zero')
    expect(validateRefund({ amount: '1.234', reason: 'enough' }, p).errors.amount).toMatch(/Enter an amount/)
    expect(validateRefund({ amount: '', reason: '' }, p).amountMinor).toBeNull()
  })

  it('a cash decision: confirming needs only a reason; adjusting also needs the fare actually owed', () => {
    expect(validateCashResolution({ action: 'CONFIRM', fare: '', reason: 'rider confirmed by phone' }, 'INR')).toEqual({ adjustedFareMinor: null, errors: {} })
    expect(validateCashResolution({ action: 'ADJUST', fare: '150', reason: 'complaint upheld' }, 'INR')).toEqual({ adjustedFareMinor: 15000, errors: {} })
    expect(validateCashResolution({ action: 'ADJUST', fare: 'lots', reason: 'complaint upheld' }, 'INR').errors.fare).toBeTruthy()
    expect(validateCashResolution({ action: 'CONFIRM', fare: '', reason: '' }, 'INR').errors.reason).toBeTruthy()
  })

  it('a finding is resolved with a note of what was done', () => {
    expect(validateFindingNote('')).toBeTruthy()
    expect(validateFindingNote('ok')).toBeTruthy()
    expect(validateFindingNote('Checked the provider dashboard')).toBeNull()
  })

  it('weather multipliers follow the server rules: 1 to 2, two decimals, blank or 1 is no charge, and a cap', () => {
    const ok = validateWeather({ enabled: true, multipliers: { HEAVY_RAIN: '1.3', STORM: '1.50', LIGHT_RAIN: '', FOG: '1' }, maxMultiplier: '1.4' })
    expect(ok.errors).toEqual({})
    expect(ok.value).toEqual({ enabled: true, multipliers: { HEAVY_RAIN: 1.3, STORM: 1.5 }, maxMultiplier: 1.4 })
    const bad = validateWeather({ enabled: true, multipliers: { HEAVY_RAIN: '2.5', STORM: '0.9', FOG: '1.234', SNOW: 'lots' }, maxMultiplier: '3' })
    expect(Object.keys(bad.errors).sort()).toEqual(['maxMultiplier', 'multipliers.FOG', 'multipliers.HEAVY_RAIN', 'multipliers.SNOW', 'multipliers.STORM'])
    expect(bad.value).toBeNull()
    expect(validateWeather({ enabled: false, multipliers: {}, maxMultiplier: '' }).value).toEqual({ enabled: false, multipliers: {}, maxMultiplier: 1.5 })
  })

  it('UPI can be switched on only with a provider that is available; the window is 5 to 60 minutes', () => {
    const base = { upi: true, provider: 'MOCK', commissionRecovery: 'MANUAL_ONLY', window: '20' }
    expect(validatePaymentSettings(base, ['MOCK']).value).toEqual({ enabledMethods: ['CASH', 'UPI'], provider: 'MOCK', commissionRecovery: 'MANUAL_ONLY', paymentWindowMinutes: 20 })
    expect(validatePaymentSettings(base, []).errors.provider).toMatch(/not available yet/)
    expect(validatePaymentSettings({ ...base, provider: '' }, ['MOCK']).errors.provider).toMatch(/Choose a provider/)
    expect(validatePaymentSettings({ ...base, upi: false, provider: 'RAZORPAY' }, []).value).toEqual({ enabledMethods: ['CASH'], provider: null, commissionRecovery: 'MANUAL_ONLY', paymentWindowMinutes: 20 })
    for (const w of ['4', '61', 'x', '10.5', '']) expect(validatePaymentSettings({ ...base, window: w }, ['MOCK']).errors.paymentWindowMinutes, w).toBeTruthy()
    expect(validatePaymentSettings({ ...base, commissionRecovery: 'WHENEVER' }, ['MOCK']).errors.commissionRecovery).toBeTruthy()
  })

  it('findings have plain names, and an unknown one still reads', () => {
    expect(findingLabel('REFUND_STUCK')).toBe('Refund waiting too long')
    expect(findingLabel('SOMETHING_NEW')).toBe('something new')
  })
})
