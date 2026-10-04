import type { AccountStatus, DocumentStatus, VerificationStatus } from '@/lib/types'
import { Badge } from './ui'
import { VERIFICATION_LABEL, tripStatusLabel } from '@/lib/statusLabels'

/** Account status, verification status and document status are different things, so each has its own wording and colour. */

export function AccountBadge({ status }: { status: AccountStatus }) {
  const kind = status === 'ACTIVE' ? 'ok' : status === 'SUSPENDED' ? 'bad' : 'neutral'
  const label = status === 'ACTIVE' ? 'Active' : status === 'SUSPENDED' ? 'Suspended' : 'Inactive'
  return <Badge kind={kind}>{label}</Badge>
}


export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const kind = status === 'APPROVED' ? 'ok' : status === 'REJECTED' || status === 'EXPIRED' ? 'bad' : status === 'PENDING_REVIEW' ? 'warn' : 'neutral'
  return <Badge kind={kind}>{VERIFICATION_LABEL[status]}</Badge>
}

export function DocumentBadge({ status }: { status: DocumentStatus | 'EXPIRED' }) {
  const kind = status === 'APPROVED' ? 'ok' : status === 'REJECTED' || status === 'EXPIRED' ? 'bad' : 'warn'
  const label = status === 'SUBMITTED' ? 'Awaiting review' : status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : 'Expired'
  return <Badge kind={kind}>{label}</Badge>
}

export function EligibleBadge({ eligible }: { eligible: boolean }) {
  return <Badge kind={eligible ? 'ok' : 'neutral'}>{eligible ? 'Eligible for rides' : 'Not eligible'}</Badge>
}


export function TripStatusBadge({ status, cancelledBy }: { status: string; cancelledBy?: string | null }) {
  const kind = status === 'COMPLETED' ? 'ok' : status.startsWith('CANCELLED') || status.startsWith('REJECTED') || status === 'NO_RESPONSE' ? 'bad'
    : status === 'REQUESTED' ? 'warn' : 'neutral'
  // a trip an admin cancelled is stored with the rider-cancelled status the apps understand; the dashboard says who really did it
  return <Badge kind={kind}>{cancelledBy === 'ADMIN' && status.startsWith('CANCELLED') ? 'Cancelled by support' : tripStatusLabel(status)}</Badge>
}

export function PresenceBadge({ presence, ageSeconds }: { presence: 'LIVE' | 'STALE' | 'NO_SIGNAL' | 'OFFLINE'; ageSeconds?: number | null }) {
  if (presence === 'LIVE') return <Badge kind="ok">Online · live</Badge>
  if (presence === 'STALE') return <Badge kind="warn">{ageSeconds ? `Location ${Math.max(1, Math.round(ageSeconds / 60))} min old` : 'Location out of date'}</Badge>
  if (presence === 'NO_SIGNAL') return <Badge kind="warn">Online · no location</Badge>
  return <Badge>Offline</Badge>
}
