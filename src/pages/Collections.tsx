import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDrivers, usePayments } from '@/api/hooks'
import { useAuth } from '@/store/auth'
import { EMPTY_FILTERS, filtersToQuery, fmtMinor, hasFilters, paymentState, paymentsAccess, REFUND_LABEL, summarise, type AdminPayment, type PaymentFilters } from '@/lib/payments'
import { fmtDateTime } from '@/lib/labels'
import DataTable, { type Column } from '@/components/DataTable'
import CommissionTab from '@/components/payments/CommissionTab'
import PaymentDetail from '@/components/payments/PaymentDetail'
import ReconciliationTab from '@/components/payments/ReconciliationTab'
import { Alert, Badge, Button, Card, ErrorState, PageHeader, SelectField, Spinner, TextField } from '@/components/ui'

type Tab = 'payments' | 'commission' | 'reconciliation'
const TABS: [Tab, string][] = [['payments', 'Payments'], ['commission', 'Commission'], ['reconciliation', 'Reconciliation']]

function Figure({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'bad' }) {
  return <Card className="p-4"><div className="text-xs text-muted">{label}</div><div className={`text-lg font-semibold ${tone === 'bad' ? 'text-danger' : ''}`}>{value}</div>{note && <div className="text-xs text-muted">{note}</div>}</Card>
}

function PaymentsTab({ canManage }: { canManage: boolean }) {
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState<PaymentFilters>(EMPTY_FILTERS)
  const selected = params.get('payment') ?? ''
  const drivers = useDrivers({ pageSize: 100 })
  const list = usePayments(useMemo(() => filtersToQuery(filters), [filters]))
  const names = new Map((drivers.data?.items ?? []).map((d) => [d.id, d.name]))
  const set = (k: keyof PaymentFilters) => (e: { target: { value: string } }) => setFilters({ ...filters, [k]: e.target.value })
  const open = (id: string) => { const next = new URLSearchParams(params); if (id) next.set('payment', id); else next.delete('payment'); setParams(next, { replace: true }) }

  const items = list.data?.items ?? []
  const s = summarise(items)
  const currency = items[0]?.currency ?? 'INR'

  const columns: Column<AdminPayment>[] = [
    { header: 'When', cell: (p) => <span className="whitespace-nowrap">{fmtDateTime(p.created_at)}</span> },
    { header: 'Ride', cell: (p) => (p.trip_id ? <Link className="underline" to={`/trips/${p.trip_id}`} onClick={(e) => e.stopPropagation()}>{p.trip_id}</Link> : <span className="text-muted">Commission payment</span>) },
    { header: 'Driver', cell: (p) => (p.driver_id ? names.get(p.driver_id) ?? p.driver_id : '—') },
    { header: 'Method', cell: (p) => (p.method === 'UPI' ? 'Online (UPI)' : 'Cash') },
    { header: 'Amount', cell: (p) => <span className="font-medium">{fmtMinor(p.amount_minor, p.currency)}</span> },
    { header: 'State', cell: (p) => { const st = paymentState(p); return <span className="inline-flex flex-wrap items-center gap-1"><Badge kind={st.kind}>{st.label}</Badge>{p.refund_status !== 'NONE' && <Badge kind="warn">{REFUND_LABEL[p.refund_status]}</Badge>}{p.flags.length > 0 && <Badge kind="bad">Needs a look</Badge>}</span> } },
    { header: '', hideLabel: true, className: 'text-right', cell: (p) => <Button variant="ghost" onClick={() => open(p.payment_id)}>Open</Button> },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Collected online" value={fmtMinor(s.onlineCollected, currency)} note="verified by the provider" />
        <Figure label="Cash confirmed by drivers" value={fmtMinor(s.cashConfirmed, currency)} note="held by the drivers, not the business" />
        <Figure label="Cash not yet confirmed" value={fmtMinor(s.cashWaiting, currency)} note="finished rides waiting for the driver" />
        <Figure label="Refunded" value={fmtMinor(s.refunded, currency)} note="given back to riders" />
        <Figure label="Cash disputes" value={String(s.disputed)} note="need a decision" tone={s.disputed ? 'bad' : undefined} />
        <Figure label="Waiting for the provider" value={String(s.awaitingVerification)} note="not paid until confirmed" />
        <Figure label="Failed attempts" value={String(s.failed)} />
        <Figure label="Needs a look" value={String(s.flagged)} note="flagged payments" tone={s.flagged ? 'bad' : undefined} />
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="State" value={filters.status} onChange={set('status')}>
            <option value="">Any</option><option value="SUCCEEDED">Paid</option><option value="PENDING">Waiting</option><option value="FAILED">Failed</option><option value="EXPIRED">Expired</option><option value="CANCELLED">Cancelled</option>
          </SelectField>
          <SelectField label="Method" value={filters.method} onChange={set('method')}><option value="">Any</option><option value="UPI">Online (UPI)</option><option value="CASH">Cash</option></SelectField>
          <SelectField label="Refund" value={filters.refundStatus} onChange={set('refundStatus')}>
            <option value="">Any</option><option value="REFUND_PENDING">Pending</option><option value="PARTIALLY_REFUNDED">Partly refunded</option><option value="REFUNDED">Refunded</option>
          </SelectField>
          <SelectField label="Driver" value={filters.driverId} onChange={set('driverId')}>
            <option value="">Any</option>{(drivers.data?.items ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
          <TextField label="Ride" placeholder="Ride number" value={filters.tripId} onChange={set('tripId')} />
          <TextField label="From" type="date" value={filters.from} onChange={set('from')} />
          <TextField label="To" type="date" value={filters.to} onChange={set('to')} />
          <div className="flex items-end"><Button variant="ghost" disabled={!hasFilters(filters)} onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button></div>
        </div>
      </Card>

      {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
        <>
          {list.data!.total > items.length && <Alert kind="info">Showing the latest {items.length} of {list.data!.total} payments. Narrow the filters to see the rest; the figures above are for the payments shown.</Alert>}
          <Card className="p-0">
            <DataTable rows={items} columns={columns} rowKey={(p) => p.payment_id} pageSize={12} loading={list.isFetching} onRowClick={(p) => open(p.payment_id)}
              empty={{ title: hasFilters(filters) ? 'No payments match these filters' : 'No payments yet', text: hasFilters(filters) ? undefined : 'Payments appear here when a driver confirms cash or a rider pays online.' }} />
          </Card>
        </>
      )}
      {selected && <PaymentDetail id={selected} canManage={canManage} onClose={() => open('')} />}
    </div>
  )
}

/**
 * Commission and Collections: every payment with its state, what drivers owe in commission, and the checks that compare our records with
 * the ledger and the payment provider. Reading needs payments.view; refunds, cash decisions, recovery and reconciliation need payments.manage.
 */
export default function Collections() {
  const user = useAuth((s) => s.session?.user)
  const { manage } = paymentsAccess(user)
  const [tab, setTab] = useState<Tab>('payments')
  return (
    <>
      <PageHeader title="Commission & Collections" subtitle="What riders paid, what drivers collected in cash, the commission drivers owe, and whether the records agree." />
      <div role="tablist" aria-label="Sections" className="mb-4 flex gap-1 border-b border-line">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === key ? 'border-brand font-medium' : 'border-transparent text-muted hover:text-text'}`}>{label}</button>
        ))}
      </div>
      {!manage && <div className="mb-4"><Alert kind="info">Your role can view this page but not change anything on it.</Alert></div>}
      {tab === 'payments' && <PaymentsTab canManage={manage} />}
      {tab === 'commission' && <CommissionTab canManage={manage} />}
      {tab === 'reconciliation' && <ReconciliationTab canManage={manage} />}
    </>
  )
}
