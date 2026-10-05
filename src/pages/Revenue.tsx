import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { platform } from '@/api'
import { fmtDate, fmtMoney } from '@/lib/labels'
import type { RevenueSummary } from '@/lib/types'
import DataTable, { type Column } from '@/components/DataTable'
import ExportButton from '@/components/ExportButton'
import { CYCLE_LABEL } from '@/lib/billing'
import { InvoiceTable, SubscriptionBadge } from '@/components/billing'
import { Alert, Card, ErrorState, PageHeader, SelectField, Spinner, TextField } from '@/components/ui'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <Card className="p-4"><div className="text-xs text-muted">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>{hint && <div className="mt-1 text-xs text-muted">{hint}</div>}</Card>
}

const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' })

/** Billed vs collected by month, as plain bars with their figures in a table below for screen readers and exact values. */
function Series({ s }: { s: RevenueSummary }) {
  const max = Math.max(1, ...s.series.map((x) => Math.max(x.billed, x.collected)))
  return (
    <Card className="p-5">
      <h2 className="mb-1 font-semibold">Billed and collected by month</h2>
      <p className="mb-4 text-xs text-muted">Billed is by invoice date; collected is by the date payment was received. Refunds are shown separately.</p>
      <div className="flex h-40 items-end gap-2" role="img" aria-label="Bar chart of billed and collected amounts for each of the last twelve months">
        {s.series.map((x) => (
          <div key={x.month} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
            <div className="flex flex-1 items-end justify-center gap-0.5">
              <div className="w-1/2 rounded-t bg-black/15 dark:bg-white/20" style={{ height: `${(x.billed / max) * 100}%` }} title={`Billed ${fmtMoney(x.billed, s.currency)}`} />
              <div className="w-1/2 rounded-t bg-brand" style={{ height: `${(x.collected / max) * 100}%` }} title={`Collected ${fmtMoney(x.collected, s.currency)}`} />
            </div>
            <div className="truncate text-center text-[10px] text-muted">{monthName(x.month)}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted"><span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-black/15 dark:bg-white/20" />Billed</span><span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-brand" />Collected</span></div>
      <details className="mt-3 text-xs"><summary className="cursor-pointer text-muted">Show the figures</summary>
        <div className="overflow-x-auto"><table className="mt-2 w-full min-w-[26rem] text-right tabular-nums"><thead className="text-muted"><tr><th className="text-left font-medium">Month</th><th className="font-medium">Billed</th><th className="font-medium">Collected</th><th className="font-medium">Refunded</th><th className="font-medium">Net</th></tr></thead>
          <tbody>{s.series.map((x) => <tr key={x.month}><td className="text-left">{monthName(x.month)}</td><td>{fmtMoney(x.billed, s.currency)}</td><td>{fmtMoney(x.collected, s.currency)}</td><td>{fmtMoney(x.refunded, s.currency)}</td><td>{fmtMoney(x.net, s.currency)}</td></tr>)}</tbody></table></div>
      </details>
    </Card>
  )
}

export default function Revenue() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const range = { from: from || undefined, to: to || undefined }
  const summary = useQuery({ queryKey: ['platform-revenue', range], queryFn: () => platform.revenue(range), placeholderData: keepPreviousData })
  const invParams = { status: status || undefined, type: type || undefined, page, pageSize: 10 }
  const invoices = useQuery({ queryKey: ['platform-invoices', invParams], queryFn: () => platform.invoices(invParams), placeholderData: keepPreviousData })

  // the date filter stays on screen whatever happens, so a bad range can always be corrected
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const dateFilter = (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
      <TextField label="From" type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} />
      <TextField label="To" type="date" value={to} min={from || undefined} max={today} onChange={(e) => setTo(e.target.value)} />
    </div>
  )
  const header = <PageHeader title="Platform revenue" subtitle="What businesses pay AutoMet for the platform. This is not the fares their riders pay." />
  if (summary.isLoading) return <>{header}{dateFilter}<Spinner /></>
  if (summary.isError) return <>{header}{dateFilter}<div className="mt-4"><ErrorState error={summary.error} onRetry={() => summary.refetch()} /></div></>
  const s = summary.data!
  const c = s.currency
  const money = (n: number) => fmtMoney(n, c)

  const businessCols: Column<RevenueSummary['byBusiness'][number]>[] = [
    { header: 'Business', cell: (b) => <Link className="font-medium hover:underline" to={`/businesses/${b.appId}`}>{b.name}</Link> },
    { header: 'Subscription', cell: (b) => <div><SubscriptionBadge status={b.subscriptionStatus} />{b.planName && <div className="mt-1 text-xs text-muted">{b.planName}{b.price ? ` · ${money(b.price)} / ${b.cycle ? CYCLE_LABEL[b.cycle] : ''}` : ''}</div>}</div> },
    { header: 'MRR', className: 'text-right', cell: (b) => <span className="text-sm tabular-nums">{money(b.mrr)}</span> },
    { header: 'Billed', className: 'text-right', cell: (b) => <span className="text-sm tabular-nums">{money(b.billed)}</span> },
    { header: 'Collected', className: 'text-right', cell: (b) => <span className="text-sm tabular-nums">{money(b.collected)}</span> },
    { header: 'Outstanding', className: 'text-right', cell: (b) => <span className="text-sm tabular-nums">{money(b.outstanding)}{b.overdue > 0 && <span className="block text-xs text-danger">{money(b.overdue)} overdue</span>}</span> },
  ]

  const exportQuery = new URLSearchParams(Object.entries({ status, type }).filter(([, v]) => v)).toString()

  return (
    <>
      <PageHeader title="Platform revenue" subtitle={`What businesses pay AutoMet for the platform. This is not the fares their riders pay. Currency: ${c}.`} />
      <Alert kind="info">Figures come only from subscriptions and invoices you record here. Payments are recorded by hand, so “collected” is what you have marked as received.</Alert>

      {dateFilter}
      <p className="mt-1 text-xs text-muted">The date range limits billed, collected and refunded (default: last twelve months). Recurring revenue and amounts outstanding are always as of today.</p>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Recurring revenue (today)</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Monthly recurring revenue" value={money(s.mrr)} hint={`${s.counts.recurring} paying business${s.counts.recurring === 1 ? '' : 'es'}`} />
        <Stat label="Annual run rate" value={money(s.arr)} hint="MRR × 12" />
        <Stat label="Trials" value={String(s.counts.trialing)} hint="Not counted as revenue until converted" />
        <Stat label="Without a plan" value={String(s.counts.withoutSubscription)} hint={`${s.counts.cancelled} cancelled · ${s.counts.suspended} suspended`} />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Money in the selected period</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Billed" value={money(s.billed)} hint={`Before GST, excluding void. GST charged: ${money(s.gstCharged)}`} />
        <Stat label="Collected" value={money(s.collected)} hint={`Before GST. GST received: ${money(s.gstCollected)}`} />
        <Stat label="Refunded" value={money(s.refunded)} />
        <Stat label="Net collected" value={money(s.netCollected)} hint="Collected minus refunded" />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold">Receivables (today)</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Outstanding" value={money(s.outstanding)} hint={`${s.counts.outstandingInvoices} unpaid invoice${s.counts.outstandingInvoices === 1 ? '' : 's'}, GST included`} />
        <Stat label="Overdue" value={money(s.overdue)} hint={`${s.counts.overdueInvoices} past the due date`} />
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Series s={s} />
        <Card className="p-5">
          <h2 className="mb-2 font-semibold">Upcoming renewals</h2>
          {s.counts.renewalsOverdue > 0 && <p className="mb-2 text-xs text-danger">{s.counts.renewalsOverdue} renewal{s.counts.renewalsOverdue === 1 ? ' is' : 's are'} past due. Renew or cancel them from the business page.</p>}
          {s.upcomingRenewals.length === 0 ? <p className="text-sm text-muted">Nothing renews in the next 30 days.</p> : (
            <ul className="divide-y divide-line">{s.upcomingRenewals.map((r) => (
              <li key={r.appId} className="flex items-center justify-between gap-3 py-2 text-sm"><div className="min-w-0"><Link to={`/businesses/${r.appId}`} className="font-medium hover:underline">{r.name}</Link><div className="text-xs text-muted">{r.status === 'trialing' ? 'Trial ends' : 'Renews'} {fmtDate(r.renewalDate)}</div></div><div className="shrink-0 tabular-nums">{money(r.price)}</div></li>
            ))}</ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <div className="border-b border-line px-5 py-3"><h2 className="font-semibold">By business</h2></div>
          <DataTable rows={s.byBusiness} columns={businessCols} rowKey={(b) => b.appId} empty={{ title: 'No businesses yet' }} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-2 font-semibold">By plan</h2>
          {s.byPlan.length === 0 ? <p className="text-sm text-muted">No plans yet. <Link to="/plans" className="underline">Create one</Link>.</p> : (
            <ul className="divide-y divide-line">{s.byPlan.map((p) => <li key={p.planId} className="flex justify-between gap-3 py-2 text-sm"><div><div className="font-medium">{p.name}{p.active ? '' : ' (retired)'}</div><div className="text-xs text-muted">{p.subscribers} subscriber{p.subscribers === 1 ? '' : 's'}</div></div><div className="tabular-nums">{money(p.mrr)}<span className="text-xs text-muted"> / mo</span></div></li>)}</ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="font-semibold">Invoices</h2>
          <div className="flex flex-wrap items-end gap-2">
            <SelectField label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}><option value="">All</option><option value="issued">Unpaid</option><option value="paid">Paid</option><option value="void">Void</option></SelectField>
            <SelectField label="Type" value={type} onChange={(e) => { setType(e.target.value); setPage(1) }}><option value="">All</option><option value="subscription">Subscription</option><option value="setup_fee">Setup fee</option><option value="other">Other</option></SelectField>
            <ExportButton path={`/api/admin/platform/invoices.csv${exportQuery ? `?${exportQuery}` : ''}`} fileName="invoices.csv" />
          </div>
        </div>
        {invoices.isError ? <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} /> : invoices.data ? (
          <InvoiceTable rows={invoices.data.items} showBusiness loading={invoices.isFetching} paging={{ page, pageSize: invoices.data.pageSize, total: invoices.data.total, onPage: setPage }} />
        ) : <Spinner />}
      </Card>
    </>
  )
}


