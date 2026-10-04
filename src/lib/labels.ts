import { useEffect, useState } from 'react'
import type { Category, Region } from './types'

/** "Pune" or "Pune (Airport)": the zone is shown only when it is not the whole city. */
export const regionLabel = (r: Pick<Region, 'city' | 'zoneName'> | undefined | null) =>
  r ? `${r.city}${r.zoneName && r.zoneName !== 'All areas' ? ` (${r.zoneName})` : ''}` : '—'

export const categoryLabel = (c: Pick<Category, 'name'> | undefined | null) => (c ? c.name : '—')

/** A value that follows `value` after the user stops changing it, so a search box does not query on every key. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return debounced
}

export const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—')
export const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString() : '—')

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'
}

/** An amount in the business's currency; a missing amount shows as a dash, never as zero. */
export function fmtMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency ?? ''}`.trim()
  }
}

/** "5 min ago", "2 days ago": for lists where the exact time is in the tooltip. */
export function timeAgo(d: string | null | undefined, now = Date.now()): string {
  if (!d) return '—'
  const s = Math.max(0, Math.round((now - new Date(d).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

/** Start of a local calendar day, as an ISO string the API understands (empty when not a date). */
export function dayStartIso(date: string): string { return date ? new Date(`${date}T00:00:00`).toISOString() : '' }
export function dayEndIso(date: string): string { return date ? new Date(`${date}T23:59:59.999`).toISOString() : '' }
