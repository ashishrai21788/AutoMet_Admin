import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useRider } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { fmtDate, fmtDateTime, fmtMoney, timeAgo } from '@/lib/labels'
import type { TripItem } from '@/lib/types'
import DataTable, { type Column } from '@/components/DataTable'
import { TripStatusBadge } from '@/components/StatusBadge'
import { RiderStatus } from '@/pages/Riders'
import { RouteCell } from '@/pages/Trips'
import { Card, ErrorState, PageHeader, Spinner } from '@/components/ui'

function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card className="p-4"><div className="text-xs text-muted">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></Card>
}

export default function RiderDetail() {
  const { id = '' } = useParams()
  const { user } = useScope()
  const navigate = useNavigate()
  const rider = useRider(id)

  if (rider.isLoading) return <Spinner />
  if (rider.isError) return <ErrorState error={rider.error} onRetry={() => rider.refetch()} />
  const r = rider.data!
  const canTrips = can(user, 'trips.view')

  const columns: Column<TripItem>[] = [
    { header: 'Trip', cell: (t) => <span className="font-mono text-xs">{t.id}</span> },
    { header: 'Requested', cell: (t) => <span className="whitespace-nowrap text-xs">{fmtDateTime(t.requestedAt)}</span> },
    { header: 'Route', cell: (t) => <RouteCell from={t.pickup} to={t.drop} /> },
    { header: 'Driver', cell: (t) => <span className="text-sm">{t.driver.name ?? t.driver.id}</span> },
    { header: 'Fare', cell: (t) => <span className="whitespace-nowrap text-sm">{fmtMoney(t.fare, t.currency)}</span> },
    { header: 'Status', cell: (t) => <TripStatusBadge status={t.status} /> },
  ]

  return (
    <>
      <Link to="/riders" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={15} aria-hidden /> All riders</Link>
      <PageHeader title={r.name} subtitle={`Rider ID ${r.id}`} action={<RiderStatus status={r.accountStatus} />} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Trips" value={r.trips.total} />
        <Stat label="Completed" value={r.trips.completed} />
        <Stat label="Cancelled" value={r.trips.cancelled} />
      </div>

      <Card className="mt-5 p-5">
        <h2 className="mb-3 font-semibold">Account</h2>
        <dl className="grid gap-x-8 sm:grid-cols-2">
          {([
            ['Phone', `${r.phone}${r.phoneVerified ? '' : ' (not verified)'}`], ['Email', r.email || '—'],
            ['Joined', fmtDate(r.registeredAt)], ['Last active', r.lastActiveAt ? `${timeAgo(r.lastActiveAt)} · ${fmtDateTime(r.lastActiveAt)}` : '—'],
          ] as const).map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-line py-2 text-sm last:border-0"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>)}
        </dl>
      </Card>

      <Card className="mt-5">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-semibold">Recent trips</h2>
          {canTrips && r.trips.total > r.recentTrips.length && <Link to={`/trips?riderId=${r.id}`} className="text-sm underline">All {r.trips.total} trips</Link>}
        </div>
        <DataTable
          rows={r.recentTrips} columns={columns} rowKey={(t) => t.id} onRowClick={canTrips ? (t) => navigate(`/trips/${t.id}`) : undefined}
          empty={{ title: 'No trips yet', text: 'This rider has not requested a ride.' }}
        />
      </Card>
    </>
  )
}
