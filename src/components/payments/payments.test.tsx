import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AdminPayment, PaymentDetail as Detail, PaymentSettings, WeatherPricing } from '@/lib/payments'

const shared = vi.hoisted(() => {
  const calls: Record<string, unknown[][]> = {}
  const record = (name: string) => (...args: unknown[]) => { (calls[name] ??= []).push(args); return Promise.resolve(name === 'refund' ? { refund: { status: 'PROCESSED' }, duplicate: false } : name === 'resolveCash' ? { payment: {} } : {}) }
  return { calls, record, detail: { value: null as unknown } }
})
const calls = shared.calls

vi.mock('@/lib/useScope', () => ({ useScope: () => ({ user: { id: 'u1', name: 'Fin', email: 'f@x.test', role: 'finance', tenantId: 't1' }, tenantId: 't1', isSuper: false }) }))
vi.mock('@/components/feedback', () => ({ useToast: () => ({ success: () => {}, error: () => {} }), useConfirm: () => async () => true }))
vi.mock('@/api', async (orig) => ({
  ...(await orig<typeof import('@/api')>()),
  ops: { payments: { refund: shared.record('refund'), resolveCash: shared.record('resolveCash'), updateSettings: shared.record('updateSettings'), updateWeather: shared.record('updateWeather') } },
}))
vi.mock('@/api/hooks', async (orig) => ({
  ...(await orig<typeof import('@/api/hooks')>()),
  usePayment: () => ({ data: shared.detail.value, isLoading: false, isError: false }),
}))

import { PaymentSettingsForm, WeatherPricingForm } from './SettingsCards'
import { CashResolveModal, RefundModal } from './ActionModals'
import PaymentDetail from './PaymentDetail'

const pay = (over: Partial<AdminPayment> = {}): AdminPayment => ({
  payment_id: 'pay_1', trip_id: 'T1', purpose: 'FARE', method: 'UPI', status: 'SUCCEEDED', refund_status: 'NONE', amount_minor: 20000, currency: 'INR', refunded_minor: 5000,
  cash_state: null, awaiting_verification: false, expires_at: null, created_at: '2026-10-28T06:00:00Z', paid_at: '2026-10-28T06:01:00Z', driver_id: 'D1', rider_id: 'U1',
  provider: 'MOCK', provider_order_id: 'o1', ledger_txn_id: 'led_1', commission_snapshot: { commissionMinor: 3000, netMinor: 17000 }, cash: null, flags: [], history: [{ at: '2026-10-28T06:00:00Z', status: 'CREATED', by: 'rider', note: null }], refund: null, ...over,
})
const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>)
const type = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const settings = (over: Partial<PaymentSettings> = {}): PaymentSettings => ({ enabledMethods: ['CASH'], provider: null, merchantId: null, commissionRecovery: 'DEDUCT_FROM_PAYABLE', paymentWindowMinutes: 15, availableProviders: [], ...over })
const weather = (): WeatherPricing => ({
  enabled: false, maxMultiplier: 1.5, multipliers: { LIGHT_RAIN: 1, HEAVY_RAIN: 1 },
  conditions: [{ key: 'LIGHT_RAIN', label: 'Rain', hint: 'Any measurable rain' }, { key: 'HEAVY_RAIN', label: 'Heavy rain', hint: '7.6 mm or more' }],
  notes: ['Only applies to fare rules with surge switched on.', 'If the weather cannot be read, no adjustment is made.'],
})

beforeEach(() => { for (const k of Object.keys(calls)) delete calls[k]; shared.detail.value = null })
afterEach(() => cleanup())

describe('payment method settings', () => {
  it('online payment cannot be switched on while no provider is available, and says why; cash is always on', () => {
    wrap(<PaymentSettingsForm saved={settings()} canEdit />)
    expect((screen.getByRole('switch', { name: 'Online payment (UPI)' }) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('switch', { name: 'Cash' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('switch', { name: 'Cash' }) as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText(/Not available yet/)).toBeTruthy()
  })

  it('UPI needs a provider chosen before it saves; with one it saves exactly what was chosen', async () => {
    wrap(<PaymentSettingsForm saved={settings({ availableProviders: ['MOCK'] })} canEdit />)
    fireEvent.click(screen.getByRole('switch', { name: 'Online payment (UPI)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save payment settings' }))
    expect(screen.getByText('Choose a provider to take UPI payments')).toBeTruthy()
    expect(calls.updateSettings).toBeUndefined()
    fireEvent.change(screen.getByLabelText('Payment provider'), { target: { value: 'MOCK' } })
    type('Minutes a rider has to pay online', '20')
    fireEvent.click(screen.getByRole('button', { name: 'Save payment settings' }))
    await waitFor(() => expect(calls.updateSettings).toHaveLength(1))
    expect(calls.updateSettings[0][0]).toEqual({ enabledMethods: ['CASH', 'UPI'], provider: 'MOCK', commissionRecovery: 'DEDUCT_FROM_PAYABLE', paymentWindowMinutes: 20 })
  })

  it('a window outside 5 to 60 minutes is refused before anything is sent', () => {
    wrap(<PaymentSettingsForm saved={settings()} canEdit />)
    type('Minutes a rider has to pay online', '2')
    fireEvent.click(screen.getByRole('button', { name: 'Save payment settings' }))
    expect(screen.getByText('Enter 5 to 60 minutes')).toBeTruthy()
    expect(calls.updateSettings).toBeUndefined()
  })

  it('a role that may only view sees the settings with no way to save them', () => {
    wrap(<PaymentSettingsForm saved={settings()} canEdit={false} />)
    expect(screen.queryByRole('button', { name: 'Save payment settings' })).toBeNull()
    expect(screen.getByText(/can view these settings but not change them/)).toBeTruthy()
  })
})

describe('weather pricing settings', () => {
  it('shows the rules and the protections the server states', () => {
    wrap(<WeatherPricingForm saved={weather()} canEdit />)
    expect(screen.getByLabelText('Heavy rain (×)')).toBeTruthy()
    expect(screen.getByText('If the weather cannot be read, no adjustment is made.')).toBeTruthy()
  })

  it('a multiplier outside 1 to 2, or with too many decimals, is refused and nothing is sent', () => {
    wrap(<WeatherPricingForm saved={weather()} canEdit />)
    type('Heavy rain (×)', '2.5')
    type('Rain (×)', '1.234')
    fireEvent.click(screen.getByRole('button', { name: 'Save weather pricing' }))
    expect(screen.getAllByText('Enter 1 to 2, with at most two decimals')).toHaveLength(2)
    expect(calls.updateWeather).toBeUndefined()
  })

  it('valid values are sent as numbers, with blank meaning no charge', async () => {
    wrap(<WeatherPricingForm saved={weather()} canEdit />)
    fireEvent.click(screen.getByRole('switch', { name: 'Charge for bad weather' }))
    type('Heavy rain (×)', '1.3')
    type('Most weather can add (×)', '1.4')
    fireEvent.click(screen.getByRole('button', { name: 'Save weather pricing' }))
    await waitFor(() => expect(calls.updateWeather).toHaveLength(1))
    expect(calls.updateWeather[0][0]).toEqual({ enabled: true, multipliers: { HEAVY_RAIN: 1.3 }, maxMultiplier: 1.4 })
  })

  it('a role that may only view cannot save', () => {
    wrap(<WeatherPricingForm saved={weather()} canEdit={false} />)
    expect(screen.queryByRole('button', { name: 'Save weather pricing' })).toBeNull()
  })
})

describe('refunding a payment', () => {
  it('starts with everything that is left, and refuses more than that or a missing reason', () => {
    wrap(<RefundModal payment={pay()} onClose={() => {}} />)
    expect((screen.getByLabelText(/Amount to refund/) as HTMLInputElement).value).toBe('150.00')
    type(/Amount to refund/, '150.01')
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }))
    expect(screen.getByText(/At most .*150\.00 can still be refunded/)).toBeTruthy()
    expect(screen.getByText(/Say why/)).toBeTruthy()
    expect(calls.refund).toBeUndefined()
  })

  it('sends one refund with an idempotency key, and the key is the same if the button is pressed again', async () => {
    wrap(<RefundModal payment={pay()} onClose={() => {}} />)
    type(/Amount to refund/, '100')
    type(/Reason/, 'Rider complained')
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }))
    await waitFor(() => expect(calls.refund).toHaveLength(1))
    const [id, input] = calls.refund[0] as [string, { amountMinor: number; reason: string; idempotencyKey: string }]
    expect(id).toBe('pay_1')
    expect(input).toMatchObject({ amountMinor: 10000, reason: 'Rider complained' })
    expect(input.idempotencyKey).toMatch(/^refund-/)
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }))
    await waitFor(() => expect(calls.refund).toHaveLength(2))
    expect((calls.refund[1][1] as { idempotencyKey: string }).idempotencyKey).toBe(input.idempotencyKey)
  })
})

describe('deciding a cash dispute', () => {
  const disputed = pay({ method: 'CASH', status: 'PENDING', cash_state: 'DISPUTED', refunded_minor: 0, cash: { collectedMinor: 15000, dispute: { by: 'driver', reason: 'driver collected 15000 but the fare is 20000', at: '2026-10-28T06:05:00Z' } } })

  it('shows the fare, what was collected and why it is disputed', () => {
    wrap(<CashResolveModal payment={disputed} onClose={() => {}} />)
    expect(screen.getByText(/driver collected 15000 but the fare is 20000/)).toBeTruthy()
    expect(screen.getAllByText(/200\.00/).length).toBeGreaterThan(0)
  })

  it('needs a reason, and an adjustment needs the fare actually owed', async () => {
    wrap(<CashResolveModal payment={disputed} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Record decision' }))
    expect(screen.getByText(/Say why/)).toBeTruthy()
    expect(calls.resolveCash).toBeUndefined()
    fireEvent.click(screen.getByRole('radio', { name: /Adjust the fare/ }))
    type(/Fare actually owed/, 'lots')
    type(/Reason/, 'complaint upheld')
    fireEvent.click(screen.getByRole('button', { name: 'Record decision' }))
    expect(screen.getByText(/Enter the fare that is actually owed/)).toBeTruthy()
    type(/Fare actually owed/, '150')
    fireEvent.click(screen.getByRole('button', { name: 'Record decision' }))
    await waitFor(() => expect(calls.resolveCash).toHaveLength(1))
    expect(calls.resolveCash[0]).toEqual(['pay_1', { action: 'ADJUST', adjustedFareMinor: 15000, reason: 'complaint upheld' }])
  })
})

describe('the payment detail and who may act on it', () => {
  const full = (p: AdminPayment): Detail => ({ payment: p, refunds: [], ledger: [{ txn_id: 'led_1', type: 'ONLINE_FARE_CAPTURED', memo: 'Online fare captured', created_at: '2026-10-28T06:01:00Z', entries: [{ account: 'GATEWAY_CLEARING', driverId: null, debitMinor: 20000 }, { account: 'DRIVER_PAYABLE', driverId: 'D1', creditMinor: 17000 }, { account: 'COMMISSION_REVENUE', driverId: null, creditMinor: 3000 }] }] })

  it('staff who may manage see the Refund action on a paid online fare', () => {
    shared.detail.value = full(pay())
    wrap(<PaymentDetail id="pay_1" canManage onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /Refund…/ })).toBeTruthy()
    expect(screen.getByText(/gateway clearing/)).toBeTruthy()
    expect(screen.getByText(/commission revenue/)).toBeTruthy()
  })

  it('staff who may only view see the same facts and no action', () => {
    shared.detail.value = full(pay())
    wrap(<PaymentDetail id="pay_1" canManage={false} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: /Refund…/ })).toBeNull()
    expect(screen.getByText(/Commission \(fixed when the ride finished\)/)).toBeTruthy()
  })

  it('a disputed cash payment offers the decision only to those who may manage', () => {
    shared.detail.value = full(pay({ method: 'CASH', status: 'PENDING', cash_state: 'DISPUTED', refunded_minor: 0, cash: { collectedMinor: 15000 } }))
    const { unmount } = wrap(<PaymentDetail id="pay_1" canManage onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /Decide the dispute/ })).toBeTruthy()
    unmount()
    wrap(<PaymentDetail id="pay_1" canManage={false} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: /Decide the dispute/ })).toBeNull()
  })

  it('a payment waiting for the provider is never described as paid, and a flag is shown', () => {
    shared.detail.value = full(pay({ status: 'PENDING', awaiting_verification: true, refunded_minor: 0, flags: [{ at: '2026-10-28T06:02:00Z', reason: 'success message not confirmed by the provider' }] }))
    wrap(<PaymentDetail id="pay_1" canManage onClose={() => {}} />)
    expect(screen.getByText(/Waiting for the provider to confirm/)).toBeTruthy()
    expect(screen.getByText(/success message not confirmed by the provider/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Refund…/ })).toBeNull()
  })
})
