import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crosshair } from 'lucide-react'
import { useLiveMap } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { fmtMoney, timeAgo } from '@/lib/labels'
import type { LiveDriver, LiveTrip } from '@/lib/types'
import LiveMapView, { MAP_COLOURS, driverColour } from '@/components/LiveMapView'
import { PresenceBadge, TripStatusBadge } from '@/components/StatusBadge'
import { Alert, Badge, Button, Card, EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui'

type Selection = { kind: 'driver' | 'trip'; id: string }

const REASON: Record<string, string> = {
  DRIVER_NOT_VERIFIED: 'Not verified', NO_VEHICLE: 'No vehicle', NO_REGION: 'No operating region', REGION_INACTIVE: 'Region inactive',
  VEHICLE_NOT_ACTIVE: 'Vehicle not active', VEHICLE_NOT_VERIFIED: 'Vehicle not verified', CATEGORY_MISMATCH: 'Wrong vehicle category', REGION_MISMATCH: 'Vehicle in another region', ACCOUNT_NOT_ACTIVE: 'Account not active',
}

function Legend() {
  const items: [string, string][] = [
    [MAP_COLOURS.liveEligible, 'Online, eligible'], [MAP_COLOURS.liveNotEligible, 'Online, not eligible'], [MAP_COLOURS.onTrip, 'On a trip'],
    [MAP_COLOURS.stale, 'Location out of date'], [MAP_COLOURS.searching, 'Trip pickup'],
  ]
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Map legend">
      {items.map(([c, t]) => <li key={t} className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />{t}</li>)}
      <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border" style={{ borderColor: MAP_COLOURS.region }} />Service area</li>
    </ul>
  )
}

function DriverDetailCard({ d, canTrips, canDrivers }: { d: LiveDriver; canTrips: boolean; canDrivers: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div><div className="font-semibold">{d.name}</div><div className="text-xs text-muted">{d.phone ?? d.id}</div></div>
        <PresenceBadge presence={d.presence} ageSeconds={d.ageSeconds} />
      </div>
      <dl className="mt-3 divide-y divide-line text-sm">
        <div className="flex justify-between gap-3 py-1.5"><dt className="text-muted">Last location</dt><dd>{timeAgo(d.updatedAt)}</dd></div>
        <div className="flex justify-between gap-3 py-1.5"><dt className="text-muted">Where</dt><dd>{d.regionName ?? 'Outside every service area'}</dd></div>
        <div className="flex justify-between gap-3 py-1.5"><dt className="text-muted">Vehicle</dt><dd className="text-right">{d.vehicle ? `${d.vehicle.plate} · ${d.vehicle.label}` : 'None assigned'}</dd></div>
        {d.speedKph !== null && <div className="flex justify-between gap-3 py-1.5"><dt className="text-muted">Speed</dt><dd>{Math.round(d.speedKph)} km/h</dd></div>}
        <div className="flex justify-between gap-3 py-1.5"><dt className="text-muted">Ride eligibility</dt><dd className="text-right">{d.eligible ? 'Eligible' : d.eligibilityReasons.map((r) => REASON[r] ?? r).join(', ')}</dd></div>
        <div className="flex justify-between gap-3 py-1.5"><dt className="text-muted">Current trip</dt><dd>{d.currentTripId ? (canTrips ? <Link className="underline" to={`/trips/${d.currentTripId}`}>{d.currentTripId}</Link> : d.currentTripId) : 'None'}</dd></div>
      </dl>
      {canDrivers && <Link to={`/drivers/${d.id}`} className="mt-3 inline-block"><Button variant="ghost">Open driver</Button></Link>}
    </Card>
  )
}

function TripDetailCard({ t, drivers, canTrips, canDrivers }: { t: LiveTrip; drivers: LiveDriver[]; canTrips: boolean; canDrivers: boolean }) {
  const driver = drivers.find((d) => d.id === t.driverId)
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2"><div className="font-mono text-sm font-semibold">{t.id}</div><TripStatusBadge status={t.status} /></div>
      <dl className="mt-3 divide-y divide-line text-sm">
        <div className="py-1.5"><dt className="text-xs text-muted">Pickup</dt><dd>{t.pickup?.address ?? '—'}</dd></div>
        <div className="py-1.5"><dt className="text-xs text-muted">Destination</dt><dd>{t.drop?.address ?? '—'}</dd></div>
        <div className="flex justify-between gap-3 py-1.5"><dt className="text-muted">Driver</dt><dd>{driver ? (canDrivers ? <Link className="underline" to={`/drivers/${driver.id}`}>{driver.name}</Link> : driver.name) : t.driverId}</dd></div>
        <div className="flex justify-between gap-3 py-1.5"><dt className="text-muted">Fare</dt><dd>{fmtMoney(t.fare, t.currency)}</dd></div>
        <div className="flex justify-between gap-3 py-1.5"><dt className="text-muted">Requested</dt><dd>{timeAgo(t.requestedAt)}</dd></div>
      </dl>
      {canTrips && <Link to={`/trips/${t.id}`} className="mt-3 inline-block"><Button variant="ghost">Open trip</Button></Link>}
    </Card>
  )
}

export default function LiveMap() {
  const { user } = useScope()
  const canTrips = can(user, 'trips.view')
  const canDrivers = can(user, 'drivers.view')
  const live = useLiveMap()
  const [showStale, setShowStale] = useState(true)
  const [eligibleOnly, setEligibleOnly] = useState(false)
  const [onTripOnly, setOnTripOnly] = useState(false)
  const [tab, setTab] = useState<'drivers' | 'trips'>('drivers')
  const [selected, setSelected] = useState<Selection | null>(null)
  const [fitSignal, setFitSignal] = useState(0)

  const data = live.data
  const drivers = useMemo(() => (data?.drivers ?? []).filter((d) => (showStale || d.presence === 'LIVE') && (!eligibleOnly || d.eligible) && (!onTripOnly || !!d.currentTripId)), [data, showStale, eligibleOnly, onTripOnly])
  const trips = useMemo(() => (canTrips ? data?.trips ?? [] : []), [data, canTrips])

  if (live.isLoading) return <Spinner />
  if (live.isError && !data) return <ErrorState error={live.error} onRetry={() => live.refetch()} />
  const d = data!
  const noOne = d.counts.online === 0
  const selDriver = selected?.kind === 'driver' ? d.drivers.find((x) => x.id === selected.id) : undefined
  const selTrip = selected?.kind === 'trip' ? d.trips.find((x) => x.id === selected.id) : undefined

  return (
    <>
      <PageHeader
        title="Live map" subtitle={`Online drivers and active trips of this business. Updates every ${d.refreshSeconds} seconds while this page is open.`}
        action={<Button variant="ghost" onClick={() => setFitSignal((n) => n + 1)}><Crosshair size={15} aria-hidden /> Fit to all</Button>}
      />
      {live.isError && <div className="mb-3"><Alert kind="warn">The latest update failed, so this is the last picture received {timeAgo(d.generatedAt)}.</Alert></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm" aria-label="Summary">
        <Badge kind="ok">{d.counts.live} live</Badge>
        {d.counts.stale > 0 && <Badge kind="warn">{d.counts.stale} location out of date</Badge>}
        <Badge>{d.counts.eligibleLive} eligible and live</Badge>
        <Badge kind="neutral">{d.counts.activeTrips} in progress</Badge>
        <Badge kind="neutral">{d.counts.searching} searching</Badge>
        {d.counts.noSignal > 0 && <Badge kind="warn">{d.counts.noSignal} online without a location</Badge>}
      </div>

      {noOne ? (
        <Card><EmptyState title="No drivers are online" text="Drivers appear on the map as soon as they go online in the driver app and start sharing their location." /></Card>
      ) : d.drivers.length === 0 && (
        <div className="mb-4"><Alert kind="info">{d.counts.noSignal} driver{d.counts.noSignal === 1 ? ' is' : 's are'} online, but their app does not share a location yet, so none can be placed on the map. They need the latest driver app.</Alert></div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          <LiveMapView data={d} drivers={drivers} trips={trips} selected={selected} onSelect={(s) => { setSelected(s); setTab(s.kind === 'driver' ? 'drivers' : 'trips') }} fitSignal={fitSignal} />
          <Legend />
          {d.partial && <p className="text-xs text-muted">This business has more online drivers than the map shows at once.</p>}
        </div>

        <div className="space-y-4">
          <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <legend className="sr-only">Show on the map</legend>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={showStale} onChange={(e) => setShowStale(e.target.checked)} /> Out-of-date locations</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked)} /> Eligible only</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={onTripOnly} onChange={(e) => setOnTripOnly(e.target.checked)} /> On a trip</label>
          </fieldset>

          {selDriver && <DriverDetailCard d={selDriver} canTrips={canTrips} canDrivers={canDrivers} />}
          {selTrip && <TripDetailCard t={selTrip} drivers={d.drivers} canTrips={canTrips} canDrivers={canDrivers} />}

          <Card>
            <div role="tablist" aria-label="List" className="flex border-b border-line text-sm">
              {([['drivers', `Drivers (${drivers.length})`], ...(canTrips ? [['trips', `Trips (${trips.length})`]] : [])] as [typeof tab, string][]).map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex-1 px-3 py-2.5 ${tab === k ? 'border-b-2 border-brand font-medium' : 'text-muted'}`}>{label}</button>
              ))}
            </div>
            <ul className="max-h-[22rem] divide-y divide-line overflow-y-auto" aria-label={tab === 'drivers' ? 'Drivers on the map' : 'Active trips'}>
              {tab === 'drivers' ? (drivers.length === 0 ? <li className="p-4 text-sm text-muted">No drivers match.</li> : drivers.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => setSelected({ kind: 'driver', id: x.id })} aria-current={selected?.kind === 'driver' && selected.id === x.id} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-black/[.03] dark:hover:bg-white/5">
                    <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: driverColour(x) }} />
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{x.name}</span><span className="block truncate text-xs text-muted">{x.vehicle ? x.vehicle.plate : 'No vehicle'} · {x.currentTripId ? 'on a trip' : x.eligible ? 'available' : 'not eligible'}</span></span>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(x.updatedAt)}</span>
                  </button>
                </li>
              ))) : (trips.length === 0 ? <li className="p-4 text-sm text-muted">No active trips.</li> : trips.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => setSelected({ kind: 'trip', id: x.id })} aria-current={selected?.kind === 'trip' && selected.id === x.id} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-black/[.03] dark:hover:bg-white/5">
                    <span className="min-w-0 flex-1"><span className="block truncate font-mono text-xs font-medium">{x.id}</span><span className="block truncate text-xs text-muted">{x.pickup?.address ?? '—'} → {x.drop?.address ?? '—'}</span></span>
                    <TripStatusBadge status={x.status} />
                  </button>
                </li>
              )))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}
