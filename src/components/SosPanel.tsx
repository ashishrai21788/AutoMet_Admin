import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Siren, MapPin, Phone } from 'lucide-react'
import { api, ApiError } from '@/api'
import { useScope } from '@/lib/useScope'
import { useSos } from '@/api/hooks'
import { can } from '@/lib/permissions'
import { fmtDateTime, timeAgo } from '@/lib/labels'
import type { SosItem } from '@/lib/types'
import { useToast } from '@/components/feedback'
import Modal from '@/components/Modal'
import { Badge, Button, Card, Field } from '@/components/ui'

const STATUS: Record<SosItem['status'], { label: string; kind: 'bad' | 'warn' | 'ok' }> = {
  OPEN: { label: 'Open', kind: 'bad' }, ACKNOWLEDGED: { label: 'Acknowledged', kind: 'warn' }, RESOLVED: { label: 'Resolved', kind: 'ok' },
}

function Person({ label, name, phone }: { label: string; name: string | null; phone: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="truncate font-medium">{name ?? 'Unknown'}</div>
      {phone && <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline" href={`tel:${phone}`}><Phone size={12} aria-hidden /> {phone}</a>}
    </div>
  )
}

/**
 * Emergencies pressed by riders and drivers during rides. Open ones are shown first and in red; staff acknowledge (they have seen it) and
 * resolve (with what was done). Shown only to roles that may manage support, because it carries phone numbers and locations.
 */
export default function SosPanel() {
  const { user } = useScope()
  const allowed = can(user, 'support.manage')
  const [showResolved, setShowResolved] = useState(false)
  const open = useSos('open', allowed)
  const resolved = useSos('resolved', allowed && showResolved)
  const toast = useToast()
  const qc = useQueryClient()
  const [resolving, setResolving] = useState<SosItem | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  if (!allowed) return null
  const items = open.data?.items ?? []
  if (!items.length && !showResolved) {
    return open.isLoading ? null : (
      <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-line px-4 py-2 text-sm text-muted">
        <span className="inline-flex items-center gap-2"><Siren size={16} aria-hidden /> No open emergencies.</span>
        <button type="button" className="text-primary hover:underline" onClick={() => setShowResolved(true)}>Show resolved</button>
      </div>
    )
  }

  async function run(fn: () => Promise<unknown>, ok: string) {
    if (busy) return
    setBusy(true)
    try { await fn(); await qc.invalidateQueries({ queryKey: ['biz'] }); toast.success(ok) } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.') } finally { setBusy(false) }
  }

  const rows = [...items, ...(showResolved ? resolved.data?.items ?? [] : [])]

  return (
    <>
      <div role="alert" aria-live="assertive">
      <Card className="mb-6 overflow-hidden border-danger/60">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-danger/10 px-4 py-3">
          <h2 className="inline-flex items-center gap-2 font-semibold text-danger"><Siren size={18} aria-hidden /> {open.data?.open ?? 0} emergenc{(open.data?.open ?? 0) === 1 ? 'y' : 'ies'} need attention</h2>
          <button type="button" className="text-sm text-primary hover:underline" onClick={() => setShowResolved((v) => !v)}>{showResolved ? 'Hide resolved' : 'Show resolved'}</button>
        </div>
        <ul className="divide-y divide-line">
          {rows.map((s) => (
            <li key={s.id} className="space-y-3 px-4 py-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge kind={STATUS[s.status].kind}>{STATUS[s.status].label}</Badge>
                <span className="font-semibold">{s.raisedBy.role === 'rider' ? 'Rider' : 'Driver'} {s.raisedBy.name ?? ''} pressed Emergency</span>
                <span className="text-muted" title={fmtDateTime(s.createdAt)}>{timeAgo(s.createdAt)}</span>
                {s.presses > 1 && <Badge kind="warn">pressed {s.presses} times</Badge>}
                <Link className="ml-auto text-primary hover:underline" to={`/trips/${s.tripId}`}>Open the trip</Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Person label={s.raisedBy.role === 'rider' ? 'Rider (raised it)' : 'Driver (raised it)'} name={s.raisedBy.name} phone={s.raisedBy.phone} />
                <Person label={s.raisedBy.role === 'rider' ? 'Driver' : 'Rider'} name={s.other.name} phone={s.other.phone} />
                <div className="min-w-0"><div className="text-xs text-muted">Vehicle</div><div className="truncate font-medium">{s.vehicle ?? '—'}</div></div>
              </div>
              <div className="text-xs text-muted">{s.pickup ?? '—'} → {s.drop ?? '—'}{s.tripStatus ? ` · ride ${s.tripStatus.toLowerCase().replace(/_/g, ' ')}` : ''}</div>
              <div className="flex flex-wrap items-center gap-3">
                {s.mapUrl ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={s.mapUrl} target="_blank" rel="noreferrer"><MapPin size={14} aria-hidden /> Last location on the map{s.locations.length > 1 ? ` (${s.locations.length} updates)` : ''}</a> : <span className="text-muted">No location was shared</span>}
                {s.acknowledgedBy && <span className="text-xs text-muted">Acknowledged by {s.acknowledgedBy.email ?? 'staff'}</span>}
                {s.status === 'RESOLVED' && <span className="text-xs text-muted">Resolved by {s.resolvedBy?.email ?? 'staff'}{s.resolution ? ` · “${s.resolution}”` : ''}</span>}
                {s.status !== 'RESOLVED' && (
                  <span className="ml-auto flex gap-2">
                    {s.status === 'OPEN' && <Button variant="ghost" disabled={busy} onClick={() => run(() => api.business.acknowledgeSos(s.id), 'Acknowledged')}>Acknowledge</Button>}
                    <Button disabled={busy} onClick={() => { setNote(''); setResolving(s) }}>Resolve</Button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      </div>

      {resolving && (
        <Modal title="Resolve this emergency" onClose={() => setResolving(null)}>
          <div className="space-y-4">
            <p className="text-sm">Record what was done, for example who you spoke to and that everyone is safe.</p>
            <Field label="What was done (optional)" hint="Kept with the emergency and in the audit log. 300 characters at most.">{(p) => <textarea {...p} rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setResolving(null)}>Cancel</Button>
              <Button loading={busy} onClick={async () => { await run(() => api.business.resolveSos(resolving.id, note.trim()), 'Emergency resolved'); setResolving(null) }}>Mark resolved</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
