import { Link } from 'react-router-dom'
import { useAlerts, useOpsStats } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { fmtMoney } from '@/lib/labels'
import type { OpsStats } from '@/lib/types'
import { SEVERITY } from '@/pages/Alerts'
import { Badge, Card, ErrorState, Spinner } from '@/components/ui'

function Stat({ label, value, hint, to }: { label: string; value: string | number; hint?: string; to?: string }) {
  const body = (
    <Card className={`h-full p-4 ${to ? 'hover:border-brand' : ''}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  )
  return to ? <Link to={to} className="block">{body}</Link> : body
}

function WeekChart({ days }: { days: OpsStats['trips']['last7Days'] }) {
  const max = Math.max(1, ...days.map((d) => d.requested))
  const total = days.reduce((n, d) => n + d.requested, 0)
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-baseline justify-between"><h2 className="font-semibold">Last 7 days</h2><span className="text-xs text-muted">{total} ride request{total === 1 ? '' : 's'}</span></div>
      {total === 0 ? <p className="py-6 text-center text-sm text-muted">No ride requests in the last 7 days.</p> : (
        <ul className="flex h-36 items-end gap-2" aria-label="Ride requests per day">
          {days.map((d) => (
            <li key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${d.requested} requested, ${d.completed} completed, ${d.cancelled} cancelled`}>
              <span className="text-[11px] tabular-nums text-muted">{d.requested}</span>
              <div className="flex w-full flex-1 items-end"><div className="w-full rounded-t bg-brand/70" style={{ height: `${(d.requested / max) * 100}%`, minHeight: d.requested ? 3 : 0 }}>
                <div className="w-full rounded-t bg-ok" style={{ height: d.requested ? `${(d.completed / d.requested) * 100}%` : 0 }} />
              </div></div>
              <span className="text-[11px] text-muted">{new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 flex gap-3 text-[11px] text-muted"><span><span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-sm bg-brand/70" />requested</span><span><span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-sm bg-ok" />completed</span></p>
    </Card>
  )
}

/** The live part of the dashboard: real counts from the business's drivers, trips and riders, and its open alerts. */
export default function OperationsSection() {
  const { user } = useScope()
  const stats = useOpsStats()
  const alerts = useAlerts()
  const canTrips = can(user, 'trips.view')
  const canDrivers = can(user, 'drivers.view')
  const canRiders = can(user, 'riders.view')

  if (stats.isLoading) return <Spinner />
  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
  const s = stats.data!
  const partial = s.drivers.partial || s.trips.partial || s.revenue.partial

  return (
    <section aria-label="Operations" className="mt-6 space-y-4">
      <div className="flex items-baseline justify-between"><h2 className="text-lg font-semibold">Operations</h2><span className="text-xs text-muted">Live · refreshes every 30 seconds</span></div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Rides in progress" value={s.trips.active} hint="driver assigned or on the trip" to={canTrips ? '/trips?group=active' : undefined} />
        <Stat label="Searching for a driver" value={s.trips.searching} to={canTrips ? '/trips?group=searching' : undefined} />
        <Stat label="Completed today" value={s.trips.completedToday} hint={`${s.trips.requestedToday} requested · ${s.trips.cancelledToday} cancelled`} to={canTrips ? '/trips?group=completed' : undefined} />
        <Stat label="Fares completed today" value={fmtMoney(s.revenue.today, s.revenue.currency)} hint="estimates until final fares are recorded" />
        <Stat label="Drivers online" value={s.drivers.online} hint={`${s.drivers.onlineEligible} eligible · ${s.drivers.onlineNotEligible} not eligible`} to={canDrivers ? '/ride-settings' : undefined} />
        <Stat label="Eligible drivers" value={s.drivers.eligible} hint={`of ${s.drivers.total} drivers`} to={canDrivers ? '/drivers' : undefined} />
        <Stat label="Riders" value={s.riders.total} hint={`${s.riders.newThisWeek} joined this week`} to={canRiders ? '/riders' : undefined} />
        <Stat label="Acceptance · cancellation" value={`${s.trips.acceptanceRate}% · ${s.trips.cancellationRate}%`} hint="last 7 days" />
      </div>
      {partial && <p className="text-xs text-muted">Some numbers cover only the most recent records because this business has a very large amount of data.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <WeekChart days={s.trips.last7Days} />
        <Card className="p-5">
          <div className="mb-3 flex items-baseline justify-between"><h2 className="font-semibold">Alerts</h2><Link to="/alerts" className="text-sm underline">All alerts</Link></div>
          {alerts.isLoading ? <Spinner /> : alerts.isError ? <ErrorState error={alerts.error} onRetry={() => alerts.refetch()} /> : alerts.data!.alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nothing needs attention.</p>
          ) : (
            <ul className="space-y-2">
              {alerts.data!.alerts.slice(0, 5).map((a) => (
                <li key={a.id}><Link to={a.link} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm hover:border-brand">
                  <span className="min-w-0 truncate">{a.title}</span><Badge kind={SEVERITY[a.severity].badge}>{a.count}</Badge>
                </Link></li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="text-xs text-muted">Not recorded by the platform yet, so not shown: {s.notAvailable.join(', ')}.</p>
    </section>
  )
}
