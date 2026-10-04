import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react'
import { platform } from '@/api'
import { useAuth } from '@/store/auth'
import { fmtDateTime } from '@/lib/labels'
import type { PlatformBusiness, PlatformOverview } from '@/lib/types'
import DataTable, { type Column } from '@/components/DataTable'
import { Badge, Button, Card, ErrorState, PageHeader, Spinner } from '@/components/ui'

const statusKind = { active: 'ok', trial: 'warn', suspended: 'bad' } as const

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <Card className="p-4"><div className="text-xs text-muted">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>{hint && <div className="mt-1 text-xs text-muted">{hint}</div>}</Card>
}

type Integrations = PlatformOverview['integrations']

function Integration({ name, ok, text, tone }: { name: string; ok: boolean | null; text: string; tone?: 'neutral' }) {
  const Icon = ok === null || tone === 'neutral' ? MinusCircle : ok ? CheckCircle2 : XCircle
  const cls = tone === 'neutral' ? 'text-muted' : ok ? 'text-ok' : 'text-danger'
  return (
    <li className="flex items-start gap-3 py-2.5 text-sm">
      <Icon size={18} className={`mt-0.5 shrink-0 ${cls}`} aria-hidden />
      <div className="min-w-0"><div className="font-medium">{name}</div><div className="text-xs text-muted">{text}</div></div>
    </li>
  )
}

function IntegrationList({ i }: { i: Integrations }) {
  return (
    <ul className="divide-y divide-line" aria-label="Integrations">
      <Integration name="Database" ok={i.database.connected} text={i.database.connected ? 'Connected' : i.database.configured ? 'Configured but not connected' : 'Not configured'} />
      <Integration name="Document storage" ok={i.documentStorage.configured} text={i.documentStorage.configured ? `${i.documentStorage.provider} settings are present (an upload has not been tested from here)` : `${i.documentStorage.provider} settings are missing; document uploads will fail`} />
      <Integration name="Push notifications" ok={i.pushNotifications.configured} text={i.pushNotifications.configured ? `${i.pushNotifications.provider} settings are present` : `${i.pushNotifications.provider} settings are missing; ride requests cannot reach drivers`} />
      <Integration name="Admin sign-in security" ok={i.adminSecurity.configured} text={i.adminSecurity.configured ? 'Signing key is set' : 'Signing key is missing'} />
      <Integration name="Sign-in code delivery (SMS)" ok={false} text="Not built yet: riders and drivers cannot receive their codes by text message" />
      <Integration name="Payments" ok={false} tone="neutral" text="Not built yet: trips are paid in cash outside the platform" />
    </ul>
  )
}

export default function Platform() {
  const navigate = useNavigate()
  const setActiveTenant = useAuth((s) => s.setActiveTenant)
  const data = useQuery({ queryKey: ['platform-overview'], queryFn: platform.overview, refetchInterval: 60000 })

  if (data.isLoading) return <Spinner />
  if (data.isError) return <ErrorState error={data.error} onRetry={() => data.refetch()} />
  const { totals, businesses, integrations } = data.data!

  const columns: Column<PlatformBusiness>[] = [
    { header: 'Business', cell: (b) => <div><div className="font-medium">{b.name}</div><div className="font-mono text-[11px] text-muted">{b.appId}</div></div> },
    { header: 'Status', cell: (b) => <Badge kind={statusKind[b.status]}>{b.status}</Badge> },
    { header: 'Setup', cell: (b) => b.setup.complete ? <Badge kind="ok">Complete</Badge> : <span className="text-xs"><strong>{b.setup.percent}%</strong>{b.setup.nextStep ? ` · ${b.setup.nextStep}` : ''}</span> },
    { header: 'Drivers', cell: (b) => <span className="text-sm tabular-nums">{b.drivers.total}<span className="text-xs text-muted"> · {b.drivers.online} online</span></span> },
    { header: 'Riders', cell: (b) => <span className="text-sm tabular-nums">{b.riders.total}<span className="text-xs text-muted"> · +{b.riders.newThisWeek} this week</span></span> },
    { header: 'Trips', cell: (b) => <span className="text-sm tabular-nums">{b.trips.requestedToday} today<span className="text-xs text-muted"> · {b.trips.active} active · {b.trips.last7Days} in 7 d</span></span> },
    { header: 'Admins', cell: (b) => <span className="text-sm tabular-nums">{b.admins}</span> },
    { header: 'Actions', hideLabel: true, className: 'text-right', cell: (b) => <Button variant="ghost" onClick={() => { setActiveTenant(b.appId); navigate('/') }}>Open dashboard</Button> },
  ]

  const needsAttention = businesses.filter((b) => b.status !== 'suspended' && !b.setup.complete).length

  return (
    <>
      <PageHeader title="Platform overview" subtitle={`All businesses at a glance. Counts only; open a business to see its own records. Updated ${fmtDateTime(data.data!.generatedAt)}.`} action={<Button variant="ghost" loading={data.isFetching} onClick={() => data.refetch()}>Refresh</Button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Businesses" value={totals.businesses} hint={`${totals.active} active · ${totals.trial} trial · ${totals.suspended} suspended`} />
        <Stat label="Setup complete" value={`${totals.setupComplete} of ${totals.businesses}`} hint={needsAttention ? `${needsAttention} still being set up` : 'All set up'} />
        <Stat label="Drivers" value={totals.drivers} hint={`${totals.driversOnline} online now`} />
        <Stat label="Riders" value={totals.riders} />
        <Stat label="Trips today" value={totals.tripsToday} hint={`${totals.activeTrips} in progress right now`} />
        <Stat label="Trips in 7 days" value={totals.tripsLast7Days} />
      </div>
      {data.data!.partial && <p className="mt-2 text-xs text-muted">Totals cover the most recent records only because the platform holds a very large amount of data.</p>}

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <div className="border-b border-line px-5 py-3"><h2 className="font-semibold">Businesses</h2></div>
          <DataTable rows={businesses} columns={columns} rowKey={(b) => b.appId} empty={{ title: 'No businesses yet', text: 'Create the first one from Businesses.' }} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 font-semibold">Integrations</h2>
          <p className="mb-2 text-xs text-muted">Whether each outside service is set up on this server. Keys and values are never shown.</p>
          <IntegrationList i={integrations} />
        </Card>
      </div>
    </>
  )
}
