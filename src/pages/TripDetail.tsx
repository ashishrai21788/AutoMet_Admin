import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { ops } from '@/api'
import { useTrip } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { fmtDateTime, fmtMoney } from '@/lib/labels'
import { TripStatusBadge } from '@/components/StatusBadge'
import ReasonModal from '@/components/ReasonModal'
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui'

const OPEN = ['REQUESTED', 'ACCEPTED', 'DRIVER_ON_THE_WAY', 'ARRIVED', 'ON_GOING']

interface Line { label: string; amount: number }
const asLines = (v: unknown): Line[] => (Array.isArray(v) ? v.filter((x): x is Line => !!x && typeof (x as Line).label === 'string' && typeof (x as Line).amount === 'number') : [])
const osm = (p: { lat: number; lng: number }) => `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=16/${p.lat}/${p.lng}`

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-4 py-1.5 text-sm"><dt className="text-muted">{label}</dt><dd className="text-right">{children}</dd></div>
}

export default function TripDetail() {
  const { id = '' } = useParams()
  const { user } = useScope()
  const trip = useTrip(id)
  const qc = useQueryClient()
  const [cancelling, setCancelling] = useState(false)

  if (trip.isLoading) return <Spinner />
  if (trip.isError) return <ErrorState error={trip.error} onRetry={() => trip.refetch()} />
  const t = trip.data!
  const lines = asLines((t.fareDetail.breakdown as { lines?: unknown } | null)?.lines)
  const fees = asLines((t.fareDetail.breakdown as { fees?: unknown } | null)?.fees)
  const taxes = asLines((t.fareDetail.breakdown as { taxes?: unknown } | null)?.taxes)
  const legacy = t.fareDetail.source === 'LEGACY_TARIFF'

  return (
    <>
      <Link to="/trips" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={15} aria-hidden /> All trips</Link>
      <PageHeader title={`Trip ${t.id}`} subtitle={`Requested ${fmtDateTime(t.requestedAt)}`} action={<div className="flex items-center gap-2"><TripStatusBadge status={t.status} cancelledBy={t.cancelledBy} />{can(user, 'trips.manage') && OPEN.includes(t.status) && <Button variant="danger" onClick={() => setCancelling(true)}>Cancel trip</Button>}</div>} />
      {cancelling && (
        <ReasonModal
          title={`Cancel trip ${t.id}?`} confirmLabel="Cancel the trip" label="Reason" successText="Trip cancelled"
          intro={<>The rider and the driver are told the trip was cancelled by support. This cannot be undone. The reason is recorded in the audit log.</>}
          onSubmit={async (reason) => { await ops.trips.cancel(t.id, reason); await qc.invalidateQueries({ queryKey: ['biz'] }) }}
          onClose={() => setCancelling(false)}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Route</h2>
            <ol className="space-y-3 text-sm">
              <li><div className="text-xs text-muted">Pickup</div><div>{t.pickup || '—'}</div>{t.pickupPoint && <a className="inline-flex items-center gap-1 text-xs underline" href={osm(t.pickupPoint)} target="_blank" rel="noreferrer">View on map <ExternalLink size={11} aria-hidden /></a>}</li>
              <li><div className="text-xs text-muted">Destination</div><div>{t.drop || '—'}</div>{t.dropPoint && <a className="inline-flex items-center gap-1 text-xs underline" href={osm(t.dropPoint)} target="_blank" rel="noreferrer">View on map <ExternalLink size={11} aria-hidden /></a>}</li>
            </ol>
            <dl className="mt-3 divide-y divide-line border-t border-line">
              <Row label="Region">{t.region?.name ?? '—'}</Row>
              <Row label="Vehicle category">{t.category?.name ?? '—'}</Row>
              <Row label="Distance">{t.distanceKm !== null ? `${t.distanceKm} km` : '—'}</Row>
              {t.fareDetail.estimatedDurationMin !== null && <Row label="Estimated duration">{t.fareDetail.estimatedDurationMin} min</Row>}
              {t.note && <Row label="Rider's note">{t.note}</Row>}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Fare</h2>
            {t.fareDetail.amount === null ? <p className="text-sm text-muted">No fare was recorded for this trip.</p> : (
              <>
                <dl className="divide-y divide-line">
                  {lines.map((l) => <Row key={l.label} label={l.label}>{fmtMoney(l.amount, t.currency)}</Row>)}
                  {fees.map((l) => <Row key={l.label} label={l.label}>{fmtMoney(l.amount, t.currency)}</Row>)}
                  {taxes.map((l) => <Row key={l.label} label={l.label}>{fmtMoney(l.amount, t.currency)}</Row>)}
                  <div className="flex justify-between gap-4 py-2 text-sm font-semibold"><dt>{t.fareDetail.basis === 'ACTUAL' ? 'Final fare' : 'Estimated fare'}</dt><dd>{fmtMoney(t.fareDetail.amount, t.currency)}</dd></div>
                </dl>
                <p className="mt-2 text-xs text-muted">
                  {legacy ? 'Priced with the platform\'s built-in tariff, not this business\'s own fare rules.' : t.fareDetail.source === 'BUSINESS_RULES' ? 'Priced with this business\'s fare rules when the ride was requested.' : ''}
                  {t.fareDetail.basis === 'ESTIMATE' ? ' This is the estimate shown to the rider; a final fare is not recorded yet.' : ''}
                </p>
              </>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Timeline</h2>
            {t.timeline.length === 0 ? <EmptyState title="Nothing recorded yet" /> : (
              <ol className="space-y-3 border-l border-line pl-4">
                {t.timeline.map((s) => <li key={s.label} className="relative text-sm"><span aria-hidden className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-brand" /><div className="font-medium">{s.label}</div><div className="text-xs text-muted">{fmtDateTime(s.at)}</div></li>)}
              </ol>
            )}
            {t.events.length > 0 && (
              <details className="mt-4 text-sm"><summary className="cursor-pointer text-muted">System events ({t.events.length})</summary>
                <ul className="mt-2 space-y-1 text-xs">{t.events.map((e, i) => <li key={`${e.event}-${i}`} className="flex justify-between gap-3"><span className="font-mono">{e.event}</span><span className="text-muted">{fmtDateTime(e.at)}</span></li>)}</ul>
              </details>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">People</h2>
            <dl className="divide-y divide-line">
              <Row label="Rider">{can(user, 'riders.view') ? <Link className="underline" to={`/riders/${t.rider.id}`}>{t.rider.name ?? t.rider.id}</Link> : t.rider.name ?? t.rider.id}</Row>
              {t.rider.phone && <Row label="Rider phone">{t.rider.phone}</Row>}
              <Row label="Driver">{can(user, 'drivers.view') ? <Link className="underline" to={`/drivers/${t.driver.id}`}>{t.driver.name ?? t.driver.id}</Link> : t.driver.name ?? t.driver.id}</Row>
            </dl>
          </Card>

          {t.cancellation && (
            <Card className="border-danger/40 p-5">
              <h2 className="mb-3 font-semibold">Cancellation</h2>
              <dl className="divide-y divide-line">
                <Row label="Cancelled by">{t.cancellation.by === 'DRIVER' ? 'Driver' : t.cancellation.by === 'USER' ? 'Rider' : t.cancellation.by === 'ADMIN' ? 'Support (dashboard)' : '—'}</Row>
                <Row label="Stage">{t.cancellation.stage === 'after_accept' ? 'After a driver accepted' : t.cancellation.stage === 'before_accept' ? 'Before a driver accepted' : '—'}</Row>
                <Row label="When">{fmtDateTime(t.cancellation.at)}</Row>
                <Row label="Reason">{t.cancellation.reason || '—'}</Row>
              </dl>
            </Card>
          )}
          {t.rejectReason && <Card className="p-5"><h2 className="mb-2 font-semibold">Driver's reason for declining</h2><p className="text-sm">{t.rejectReason}</p></Card>}

          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Payment and rating</h2>
            <dl className="divide-y divide-line">
              <Row label="Payment method">{t.paymentMode ?? '—'}</Row>
              <Row label="Payment status"><Badge>Not recorded yet</Badge></Row>
              <Row label="Rating"><Badge>Not available yet</Badge></Row>
            </dl>
            <p className="mt-2 text-xs text-muted">Payment tracking and ratings are not part of the platform yet, so nothing is shown here rather than a guess.</p>
          </Card>
        </div>
      </div>
    </>
  )
}
