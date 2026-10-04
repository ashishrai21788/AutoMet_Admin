import type { HistoryEntry } from '@/lib/types'
import { EmptyState } from './ui'

const TITLES: Record<string, string> = {
  CREATED: 'Record created',
  PROFILE_UPDATED: 'Details updated',
  ACCOUNT_STATUS_CHANGED: 'Account status changed',
  VEHICLE_STATUS_CHANGED: 'Vehicle status changed',
  VERIFICATION_STATUS_CHANGED: 'Verification status changed',
  DOCUMENT_SUBMITTED: 'Document submitted',
  DOCUMENT_RESUBMITTED: 'Document resubmitted',
  DOCUMENT_APPROVED: 'Document approved',
  DOCUMENT_REJECTED: 'Document rejected',
  VEHICLE_ASSIGNED: 'Vehicle assigned',
  VEHICLE_UNASSIGNED: 'Vehicle unassigned',
  DRIVER_ASSIGNED: 'Driver assigned',
  DRIVER_UNASSIGNED: 'Driver unassigned',
}

const pretty = (s: string | null) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : '')

/** The record's history, newest first, with who did it and why. */
export default function HistoryTimeline({ entries, kind }: { entries: HistoryEntry[]; kind?: string[] }) {
  const rows = kind ? entries.filter((e) => kind.includes(e.kind)) : entries
  if (rows.length === 0) return <EmptyState title="Nothing recorded yet" />
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {rows.map((e) => (
        <li key={e.id + e.at} className="relative">
          <span className="absolute -left-[1.62rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
          <div className="text-sm font-medium">{TITLES[e.action] ?? pretty(e.action)}{e.detail && e.kind !== 'ACCOUNT_STATUS' ? <span className="font-normal text-muted"> · {e.detail}</span> : null}</div>
          {(e.from || e.to) && e.action.endsWith('STATUS_CHANGED') && <div className="text-xs text-muted">{pretty(e.from) || '—'} → <strong className="text-ink">{pretty(e.to)}</strong></div>}
          {e.reason && <div className="mt-0.5 text-sm">“{e.reason}”</div>}
          <div className="text-xs text-muted">{new Date(e.at).toLocaleString()}{e.actor ? ` · ${e.actor}` : ''}</div>
        </li>
      ))}
    </ol>
  )
}
