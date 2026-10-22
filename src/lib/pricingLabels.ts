import { formatMoney } from '@/lib/geo'

export const FIELD_LABEL: Record<string, string> = {
  baseFare: 'Base fare', perKm: 'Per km', perMinute: 'Per minute', minimumFare: 'Minimum fare', bookingFee: 'Booking fee',
  waitingFreeMinutes: 'Free waiting (min)', waitingPerMinute: 'Waiting per minute', additionalCharges: 'Additional charges', taxes: 'Taxes', surge: 'Surge pricing',
}
const MONEY_FIELDS = new Set(['baseFare', 'perKm', 'perMinute', 'minimumFare', 'bookingFee', 'waitingPerMinute'])

/** A stored value in the words of the fare form. */
export function showValue(field: string, v: unknown, currency: string): string {
  if (v === null || v === undefined) return 'not set'
  if (MONEY_FIELDS.has(field)) return formatMoney(Number(v), currency)
  if (field === 'additionalCharges') { const a = v as { name: string; type: string; amount: number }[]; return a.length ? a.map((c) => `${c.name} ${c.type === 'percent_of_fare' ? `${c.amount}%` : formatMoney(c.amount, currency)}`).join(', ') : 'none' }
  if (field === 'taxes') { const t = v as { name: string; ratePercent: number }[]; return t.length ? t.map((x) => `${x.name} ${x.ratePercent}%`).join(', ') : 'none' }
  if (field === 'surge') { const s = v as { enabled: boolean; maxMultiplier: number }; return s.enabled ? `up to ${s.maxMultiplier}×` : 'off' }
  return String(v)
}
