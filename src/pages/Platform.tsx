import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { platform } from '@/api'
import { fmtDate, fmtMoney } from '@/lib/labels'
import { SubscriptionBadge } from '@/components/billing'
import { fmtDateTime } from '@/lib/labels'
import type { PlatformBusiness } from '@/lib/types'
import DataTable, { type Column } from '@/components/DataTable'
import { Badge, Button, Card, ErrorState, PageHeader, Spinner } from '@/components/ui'

const statusKind = { active: 'ok', trial: 'warn', suspended: 'bad' } as const

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <Card className="p-4"><div className="text-xs text-muted">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>{hint && <div className="mt-1 text-xs text-muted">{hint}</div>}</Card>
}

export default function Platform() {
  const revenue = useQuery({ queryKey: ['platform-revenue', {}], queryFn: () => platform.revenue() })
  const data = useQuery({ queryKey: ['platform-overview'], queryFn: platform.overview, refetchInterval: 60000 })

  if (data.isLoading) return <Spinner />
  if (data.isError) return <ErrorState error={data.error} onRetry={() => data.refetch()} />
  const { totals, businesses } = data.data!

  const columns: Column<PlatformBusiness>[] = [
    { header: 'Business', cell: (b) => <div><div className="font-medium">{b.name}</div><div className="font-mono text-[11px] text-muted">{b.appId}</div></div> },
    { header: 'Status', cell: (b) => <Badge kind={statusKind[b.status]}>{b.status}</Badge> },
    { header: 'Setup', cell: (b) => b.setup.complete ? <Badge kind="ok">Complete</Badge> : <span className="text-xs"><strong>{b.setup.percent}%</strong>{b.setup.nextStep ? ` · ${b.setup.nextStep}` : ''}</span> },
    { header: 'Subscription', cell: (b) => { const r = subs.get(b.appId); return r ? <div><SubscriptionBadge status={r.subscriptionStatus} />{r.planName && <div className="mt-1 text-xs text-muted">{r.planName}{r.renewalDate ? ` · renews ${fmtDate(r.renewalDate)}` : ''}</div>}</div> : null } },
    { header: 'Admins', cell: (b) => <span className="text-sm tabular-nums">{b.admins}</span> },
    { header: 'Actions', hideLabel: true, className: 'text-right', cell: (b) => <Link to={`/businesses/${b.appId}`}><Button variant="ghost">Manage</Button></Link> },
  ]

  const subs = new Map((revenue.data?.byBusiness ?? []).map((r) => [r.appId, r]))
  const needsAttention = businesses.filter((b) => b.status !== 'suspended' && !b.setup.complete).length

  return (
    <>
      <PageHeader title="Platform overview" subtitle={`Your client businesses, their subscriptions and your revenue. Updated ${fmtDateTime(data.data!.generatedAt)}.`} action={<Button variant="ghost" loading={data.isFetching} onClick={() => data.refetch()}>Refresh</Button>} />

      {revenue.data && (
        <>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">AutoMet revenue</h2><Link to="/revenue" className="text-xs underline">Revenue & billing</Link></div>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Monthly recurring revenue" value={fmtMoney(revenue.data.mrr, revenue.data.currency)} hint={`${revenue.data.counts.recurring} paying · ${revenue.data.counts.trialing} on trial`} />
            <Stat label="Net collected (12 months)" value={fmtMoney(revenue.data.netCollected, revenue.data.currency)} />
            <Stat label="Outstanding" value={fmtMoney(revenue.data.outstanding, revenue.data.currency)} hint={revenue.data.overdue > 0 ? `${fmtMoney(revenue.data.overdue, revenue.data.currency)} overdue` : 'Nothing overdue'} />
            <Stat label="Renewals in 30 days" value={revenue.data.counts.renewalsDue} hint={revenue.data.counts.renewalsOverdue ? `${revenue.data.counts.renewalsOverdue} past due` : undefined} />
          </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Businesses" value={totals.businesses} hint={`${totals.active} active · ${totals.trial} trial · ${totals.suspended} suspended`} />
        <Stat label="Subscriptions" value={revenue.data ? revenue.data.counts.activeSubscriptions : '—'} hint={revenue.data ? `${revenue.data.counts.trialing} on trial · ${revenue.data.counts.withoutSubscription} without a plan` : undefined} />
        <Stat label="Setup complete" value={`${totals.setupComplete} of ${totals.businesses}`} hint={totals.businesses === 0 ? undefined : needsAttention ? `${needsAttention} still being set up` : 'All set up'} />
      </div>

      <div className="mt-6">
        <Card>
          <div className="border-b border-line px-5 py-3"><h2 className="font-semibold">Businesses</h2></div>
          <DataTable rows={businesses} columns={columns} rowKey={(b) => b.appId} empty={{ title: 'No businesses yet', text: 'Create the first one from Businesses.' }} />
        </Card>
      </div>
    </>
  )
}
