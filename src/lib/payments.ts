import type { AdminUser } from './types'
import { can } from './permissions'

/**
 * Logic for the Commission and Collections screens, kept apart from the components so it can be tested. Every amount from the server is a
 * whole number of minor units (paise for INR); nothing here turns an amount into a floating-point number except to show it.
 */

// ---- the server's shapes (AutoMet_Webend_Apis/docs/payments/API.md) ----

export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED'
export type RefundStatus = 'NONE' | 'REFUND_PENDING' | 'PARTIALLY_REFUNDED' | 'REFUNDED'
export type CashState = 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'ADJUSTED'

export interface AdminPayment {
  payment_id: string
  trip_id: string | null
  purpose: 'FARE' | 'COMMISSION'
  method: 'UPI' | 'CASH'
  status: PaymentStatus
  refund_status: RefundStatus
  amount_minor: number
  currency: string
  refunded_minor: number
  cash_state: CashState | null
  awaiting_verification: boolean
  expires_at: string | null
  created_at: string
  paid_at: string | null
  commission_minor?: number
  driver_id: string | null
  rider_id: string | null
  provider: string | null
  provider_order_id: string | null
  ledger_txn_id: string | null
  commission_snapshot: { commissionMinor?: number; netMinor?: number; rule?: { percent?: number | null } } | null
  cash: { collectedMinor?: number; adjustedFareMinor?: number; dispute?: { by: string; reason: string; at: string }; resolution?: { by: string; action: string; reason: string; at: string } } | null
  flags: { at: string; reason: string }[]
  history: { at: string; status: string; by: string; note: string | null }[]
  refund: { reservedMinor: number; processedMinor: number; commissionMinor: number; netMinor: number } | null
}

export interface PaymentRefundRow { refundId: string; amountMinor: number; status: 'REQUESTED' | 'PROCESSED' | 'FAILED'; reason: string; requestedBy: string | null; failureReason: string | null; commissionMinor: number; netMinor: number; createdAt: string; processedAt: string | null }
export interface LedgerRow { txn_id: string; type: string; memo: string; created_at: string; entries: { account: string; driverId: string | null; debitMinor?: number; creditMinor?: number }[] }
export interface PaymentPage { items: AdminPayment[]; total: number }
export interface PaymentDetail { payment: AdminPayment; refunds: PaymentRefundRow[]; ledger: LedgerRow[] }

export interface CommissionRow { driver_id: string; accrued_minor: number; collected_minor: number; outstanding_minor: number; payable_minor: number }
export interface CommissionReport { totals: { accrued_minor: number; collected_minor: number; outstanding_minor: number; payable_minor: number }; drivers: CommissionRow[]; currency: string }

export interface Finding { discrepancyId: string; key: string; type: string; ref: string | null; detail: string; status: 'OPEN' | 'RESOLVED'; firstSeenAt: string; lastSeenAt: string; reopenedCount: number; resolvedBy: string | null; resolutionNote: string | null }
export interface ReconcileRun { discrepancies: Finding[]; newCount: number; checked: Record<string, number>; skippedProviderChecks: number }

export interface PaymentSettings { enabledMethods: string[]; provider: string | null; merchantId: string | null; commissionRecovery: 'DEDUCT_FROM_PAYABLE' | 'MANUAL_ONLY'; paymentWindowMinutes: number; availableProviders: string[]; fundsFlow?: string }
export interface WeatherPricing { enabled: boolean; maxMultiplier: number; multipliers: Record<string, number>; conditions: { key: string; label: string; hint: string }[]; notes: string[] }

// ---- who may do what ----

/** payments.view reads the screens; payments.manage changes anything (refunds, cash decisions, recovery, reconciliation, settings). */
export function paymentsAccess(user: AdminUser | null | undefined) {
  return { view: can(user, 'payments.view'), manage: can(user, 'payments.manage') }
}

// ---- money ----

export function minorDigits(currency: string | null | undefined): number {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'INR' }).resolvedOptions().maximumFractionDigits ?? 2 } catch { return 2 }
}

/** 20050 -> "₹200.50" (a missing amount is a dash, never zero). */
export function fmtMinor(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return '—'
  const digits = minorDigits(currency)
  const amount = minor / 10 ** digits
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'INR' }).format(amount) } catch { return `${amount.toFixed(digits)} ${currency ?? ''}`.trim() }
}

/** "200" -> 20000, "200.5" -> 20050; anything that is not a plain positive-or-zero decimal for this currency -> null. Never rounds. */
export function parseMinor(text: string, currency: string | null | undefined): number | null {
  const digits = minorDigits(currency)
  const t = text.trim()
  const re = digits === 0 ? /^\d{1,9}$/ : new RegExp(`^\\d{1,9}(\\.\\d{1,${digits}})?$`)
  if (!re.test(t)) return null
  const [whole, frac = ''] = t.split('.')
  return Number(whole) * 10 ** digits + Number(frac.padEnd(digits, '0') || '0')
}

/** 20050 -> "200.50": a plain decimal to put in a text box (the reverse of parseMinor). */
export function minorToInput(minor: number, currency: string | null | undefined): string {
  const digits = minorDigits(currency)
  return (minor / 10 ** digits).toFixed(digits)
}

// ---- reading a payment ----

export const STATUS_LABEL: Record<PaymentStatus, string> = { CREATED: 'Started', PENDING: 'Waiting', SUCCEEDED: 'Paid', FAILED: 'Failed', CANCELLED: 'Cancelled', EXPIRED: 'Expired' }
export const STATUS_KIND: Record<PaymentStatus, 'ok' | 'warn' | 'bad' | 'neutral'> = { CREATED: 'neutral', PENDING: 'warn', SUCCEEDED: 'ok', FAILED: 'bad', CANCELLED: 'neutral', EXPIRED: 'neutral' }
export const REFUND_LABEL: Record<RefundStatus, string> = { NONE: '', REFUND_PENDING: 'Refund pending', PARTIALLY_REFUNDED: 'Partly refunded', REFUNDED: 'Refunded' }
export const CASH_LABEL: Record<CashState, string> = { PENDING: 'Waiting for the driver', CONFIRMED: 'Driver confirmed', DISPUTED: 'In dispute', ADJUSTED: 'Adjusted' }

/** The plain-words state of a payment for the table: a cash dispute outranks the generic status. */
export function paymentState(p: Pick<AdminPayment, 'method' | 'status' | 'cash_state'>): { label: string; kind: 'ok' | 'warn' | 'bad' | 'neutral' } {
  if (p.method === 'CASH' && p.cash_state) {
    return { label: CASH_LABEL[p.cash_state], kind: p.cash_state === 'DISPUTED' ? 'bad' : p.cash_state === 'PENDING' ? 'warn' : 'ok' }
  }
  return { label: STATUS_LABEL[p.status], kind: STATUS_KIND[p.status] }
}

/** What is still refundable on a payment (reservations for refunds still pending count as taken). */
export function remainingRefundable(p: Pick<AdminPayment, 'amount_minor' | 'refunded_minor' | 'refund'>): number {
  const taken = p.refund ? p.refund.reservedMinor : p.refunded_minor
  return Math.max(0, p.amount_minor - (taken || 0))
}

export const canRefund = (p: AdminPayment): boolean => p.purpose === 'FARE' && p.method === 'UPI' && p.status === 'SUCCEEDED' && remainingRefundable(p) > 0
export const canResolveCash = (p: AdminPayment): boolean => p.method === 'CASH' && p.cash_state === 'DISPUTED'

/** A fresh key for one open dialog: submitting the same dialog twice is one refund. */
export function newIdempotencyKey(prefix = 'dash'): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${rand}`
}

// ---- filters and the summary ----

export interface PaymentFilters { status: string; method: string; refundStatus: string; driverId: string; tripId: string; from: string; to: string }
export const EMPTY_FILTERS: PaymentFilters = { status: '', method: '', refundStatus: '', driverId: '', tripId: '', from: '', to: '' }

/** The query for the list: blanks are left out, and a date range covers whole days in the viewer's own time. */
export function filtersToQuery(f: PaymentFilters, limit = 200): Record<string, string | number | undefined> {
  const day = (d: string, end: boolean) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T${end ? '23:59:59.999' : '00:00:00'}`).toISOString() : undefined)
  return {
    status: f.status || undefined, method: f.method || undefined, refund_status: f.refundStatus || undefined,
    driver_id: f.driverId.trim() || undefined, trip_id: f.tripId.trim() || undefined,
    from: day(f.from, false), to: day(f.to, true), limit,
  }
}

export const hasFilters = (f: PaymentFilters): boolean => Object.values(f).some((v) => v.trim() !== '')

/** Earned, collected, waiting and refunded, worked out from the rows shown. Every figure is in minor units. */
export function summarise(items: AdminPayment[]) {
  const s = { count: items.length, onlineCollected: 0, cashConfirmed: 0, cashWaiting: 0, disputed: 0, failed: 0, refunded: 0, awaitingVerification: 0, flagged: 0 }
  for (const p of items) {
    if (p.purpose !== 'FARE') continue
    if (p.status === 'SUCCEEDED' && p.method === 'UPI') s.onlineCollected += p.amount_minor
    if (p.status === 'SUCCEEDED' && p.method === 'CASH') s.cashConfirmed += p.amount_minor
    if (p.method === 'CASH' && p.status === 'PENDING' && p.cash_state === 'PENDING') s.cashWaiting += p.amount_minor
    if (p.cash_state === 'DISPUTED') s.disputed += 1
    if (p.status === 'FAILED') s.failed += 1
    if (p.awaiting_verification) s.awaitingVerification += 1
    if ((p.flags?.length ?? 0) > 0) s.flagged += 1
    s.refunded += p.refunded_minor || 0
  }
  return s
}

// ---- validating what an administrator types ----

export function validateRefund(input: { amount: string; reason: string }, p: Pick<AdminPayment, 'amount_minor' | 'refunded_minor' | 'refund' | 'currency'>): { amountMinor: number | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const amountMinor = parseMinor(input.amount, p.currency)
  const left = remainingRefundable(p)
  if (amountMinor === null) errors.amount = 'Enter an amount such as 150 or 150.50'
  else if (amountMinor < 1) errors.amount = 'Enter more than zero'
  else if (amountMinor > left) errors.amount = `At most ${fmtMinor(left, p.currency)} can still be refunded`
  if (input.reason.trim().length < 3) errors.reason = 'Say why (at least 3 characters)'
  return { amountMinor: errors.amount ? null : amountMinor, errors }
}

export function validateCashResolution(input: { action: 'CONFIRM' | 'ADJUST'; fare: string; reason: string }, currency: string): { adjustedFareMinor: number | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  let adjustedFareMinor: number | null = null
  if (input.action === 'ADJUST') {
    adjustedFareMinor = parseMinor(input.fare, currency)
    if (adjustedFareMinor === null) errors.fare = 'Enter the fare that is actually owed, such as 150 or 150.50'
  }
  if (input.reason.trim().length < 3) errors.reason = 'Say why (at least 3 characters)'
  return { adjustedFareMinor, errors }
}

export function validateFindingNote(note: string): string | null { return note.trim().length < 3 ? 'Say what was done (at least 3 characters)' : null }

const TWO_DECIMALS = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9

/** The weather form mirrors the server's rules: each multiplier 1 to 2 with two decimals, and a cap of 1 to 2. Blank or 1 means "no charge". */
export function validateWeather(form: { enabled: boolean; multipliers: Record<string, string>; maxMultiplier: string }): { value: { enabled: boolean; multipliers: Record<string, number>; maxMultiplier: number } | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const multipliers: Record<string, number> = {}
  const check = (raw: string): number | 'blank' | null => {
    const t = raw.trim()
    if (t === '') return 'blank'
    const n = Number(t)
    return Number.isFinite(n) && n >= 1 && n <= 2 && TWO_DECIMALS(n) && /^\d(\.\d{1,2})?$/.test(t) ? n : null
  }
  for (const [name, raw] of Object.entries(form.multipliers)) {
    const n = check(raw)
    if (n === null) errors[`multipliers.${name}`] = 'Enter 1 to 2, with at most two decimals'
    else if (n !== 'blank' && n > 1) multipliers[name] = n
  }
  let maxMultiplier = 1.5
  const cap = check(form.maxMultiplier)
  if (cap === null) errors.maxMultiplier = 'Enter 1 to 2, with at most two decimals'
  else if (cap !== 'blank') maxMultiplier = cap
  return { value: Object.keys(errors).length ? null : { enabled: form.enabled, multipliers, maxMultiplier }, errors }
}

export function validatePaymentSettings(form: { upi: boolean; provider: string; commissionRecovery: string; window: string }, available: string[]): { value: { enabledMethods: string[]; provider: string | null; commissionRecovery: string; paymentWindowMinutes: number } | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  if (form.upi) {
    if (!form.provider) errors.provider = 'Choose a provider to take UPI payments'
    else if (!available.includes(form.provider)) errors.provider = `${form.provider} is not available yet`
  }
  if (!['DEDUCT_FROM_PAYABLE', 'MANUAL_ONLY'].includes(form.commissionRecovery)) errors.commissionRecovery = 'Choose how commission is recovered'
  const w = Number(form.window)
  if (!Number.isInteger(w) || w < 5 || w > 60) errors.paymentWindowMinutes = 'Enter 5 to 60 minutes'
  return {
    value: Object.keys(errors).length ? null : { enabledMethods: form.upi ? ['CASH', 'UPI'] : ['CASH'], provider: form.upi ? form.provider : null, commissionRecovery: form.commissionRecovery, paymentWindowMinutes: w },
    errors,
  }
}

export const FINDING_LABEL: Record<string, string> = {
  LEDGER_UNBALANCED: 'A ledger entry does not balance', SUCCESS_NOT_POSTED: 'Paid but not in the ledger', TRIP_PAID_WITHOUT_PAYMENT: 'Ride marked paid with no payment',
  DUPLICATE_PAYMENT: 'Ride paid twice', COMMISSION_MISMATCH: 'Commission differs from the ledger', UNPROCESSED_WEBHOOK: 'A provider message was never finished',
  PROVIDER_PAID_NOT_RECORDED: 'Provider took the money; we did not record it', SUCCESS_NOT_CONFIRMED_BY_PROVIDER: 'We recorded a success the provider does not confirm',
  PROVIDER_AMOUNT_MISMATCH: 'Provider holds a different amount', REFUND_STUCK: 'Refund waiting too long', REFUND_PROVIDER_FINISHED_NOT_RECORDED: 'Refund finished at the provider, not recorded',
  REFUND_PROVIDER_FAILED_NOT_RECORDED: 'Refund failed at the provider, not recorded', CASH_NOT_CONFIRMED: 'Cash never confirmed by the driver',
}
export const findingLabel = (type: string) => FINDING_LABEL[type] ?? type.replace(/_/g, ' ').toLowerCase()
