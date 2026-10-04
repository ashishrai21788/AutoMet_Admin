import type { QueryClient } from '@tanstack/react-query'
import type { PaymentMethod } from './types'

/** Anything the platform owner does to billing can change every platform figure, so refresh them all. */
export function refreshPlatform(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('platform-') }),
    qc.invalidateQueries({ queryKey: ['businesses'] }),
  ])
}

export const METHOD_LABEL: Record<PaymentMethod, string> = { bank_transfer: 'Bank transfer', upi: 'UPI', card: 'Card', cash: 'Cash', other: 'Other' }
export const TYPE_LABEL = { subscription: 'Subscription', setup_fee: 'Setup fee', other: 'Other charge' } as const
export const CYCLE_LABEL = { monthly: 'month', yearly: 'year' } as const
