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
