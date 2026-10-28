import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePayment } from '@/api/hooks'
import { canRefund, canResolveCash, fmtMinor, paymentState, REFUND_LABEL, remainingRefundable, type AdminPayment } from '@/lib/payments'
import { fmtDateTime } from '@/lib/labels'
import Modal from '@/components/Modal'
import { Alert, Badge, Button, Card, ErrorState, Spinner } from '@/components/ui'
import { CashResolveModal, RefundModal } from './ActionModals'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs text-muted">{label}</dt><dd className="text-sm">{children}</dd></div>
}

/**
 * One payment in full: what it is, what happened to it in order, any refunds, and the ledger entries it produced. Staff with
 * payments.manage can refund a paid online fare or decide a disputed cash collection from here.
 */
export default function PaymentDetail({ id, canManage, onClose }: { id: string; canManage: boolean; onClose: () => void }) {
  const q = usePayment(id)
  const [dialog, setDialog] = useState<'refund' | 'cash' | null>(null)

  return (
    <Modal title="Payment" onClose={onClose} wide>
      {q.isLoading && <Spinner />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && <Body payment={q.data.payment} refunds={q.data.refunds} ledger={q.data.ledger} canManage={canManage} open={setDialog} />}
      {dialog === 'refund' && q.data && <RefundModal payment={q.data.payment} onClose={() => setDialog(null)} />}
      {dialog === 'cash' && q.data && <CashResolveModal payment={q.data.payment} onClose={() => setDialog(null)} />}
    </Modal>
  )
}

function Body({ payment: p, refunds, ledger, canManage, open }: { payment: AdminPayment; refunds: NonNullable<ReturnType<typeof usePayment>['data']>['refunds']; ledger: NonNullable<ReturnType<typeof usePayment>['data']>['ledger']; canManage: boolean; open: (d: 'refund' | 'cash') => void }) {
  const state = paymentState(p)
  const commission = p.cash?.adjustedFareMinor !== undefined ? undefined : p.commission_snapshot?.commissionMinor
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-2xl font-semibold">{fmtMinor(p.amount_minor, p.currency)}</div>
          <div className="text-sm text-muted">{p.method === 'UPI' ? 'Online (UPI)' : 'Cash'} · {p.purpose === 'FARE' ? 'Ride fare' : 'Commission paid by a driver'}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge kind={state.kind}>{state.label}</Badge>
          {p.refund_status !== 'NONE' && <Badge kind="warn">{REFUND_LABEL[p.refund_status]}</Badge>}
        </div>
      </div>

      {p.awaiting_verification && <Alert kind="info">Waiting for the provider to confirm this payment. It is never marked paid because a phone says so.</Alert>}
      {p.flags.length > 0 && <Alert kind="warn"><strong>Needs a look:</strong> {p.flags.map((f) => f.reason).join('; ')}</Alert>}

      <dl className="grid gap-3 sm:grid-cols-3">
        {p.trip_id && <Row label="Ride"><Link className="underline" to={`/trips/${p.trip_id}`}>{p.trip_id}</Link></Row>}
        {p.driver_id && <Row label="Driver"><Link className="underline" to={`/drivers/${p.driver_id}`}>{p.driver_id}</Link></Row>}
        <Row label="Started">{fmtDateTime(p.created_at)}</Row>
        {p.paid_at && <Row label="Paid">{fmtDateTime(p.paid_at)}</Row>}
        {p.provider && <Row label="Provider">{p.provider}</Row>}
        {commission !== undefined && <Row label="Commission (fixed when the ride finished)">{fmtMinor(commission, p.currency)}</Row>}
        {p.commission_snapshot?.netMinor !== undefined && p.cash?.adjustedFareMinor === undefined && <Row label="Driver's share">{fmtMinor(p.commission_snapshot.netMinor, p.currency)}</Row>}
        {p.refunded_minor > 0 && <Row label="Refunded so far">{fmtMinor(p.refunded_minor, p.currency)}</Row>}
      </dl>

      {p.method === 'CASH' && p.cash && (
        <Card className="p-4 text-sm">
          <h3 className="mb-2 font-semibold">Cash collection</h3>
          <dl className="grid gap-3 sm:grid-cols-3">
            <Row label="Collected, as the driver reported">{fmtMinor(p.cash.collectedMinor, p.currency)}</Row>
            {p.cash.adjustedFareMinor !== undefined && <Row label="Fare after adjustment">{fmtMinor(p.cash.adjustedFareMinor, p.currency)}</Row>}
            {p.cash.dispute && <Row label={`Dispute (${p.cash.dispute.by})`}>{p.cash.dispute.reason}</Row>}
            {p.cash.resolution && <Row label={`Decision (${p.cash.resolution.action}, ${fmtDateTime(p.cash.resolution.at)})`}>{p.cash.resolution.reason}</Row>}
          </dl>
          <p className="mt-2 text-xs text-muted">Cash is held by the driver, not the business. The business is owed its commission, which stays outstanding until it is recovered from the driver's online earnings or paid.</p>
        </Card>
      )}

      {canManage && (canRefund(p) || canResolveCash(p)) && (
        <div className="flex flex-wrap gap-2">
          {canRefund(p) && <Button variant="danger" onClick={() => open('refund')}>Refund… ({fmtMinor(remainingRefundable(p), p.currency)} left)</Button>}
          {canResolveCash(p) && <Button onClick={() => open('cash')}>Decide the dispute…</Button>}
        </div>
      )}

      {refunds.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">Refunds</h3>
          <ul className="divide-y divide-line rounded-lg border border-line text-sm">
            {refunds.map((r) => (
              <li key={r.refundId} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <span className="font-medium">{fmtMinor(r.amountMinor, p.currency)}</span>
                <Badge kind={r.status === 'PROCESSED' ? 'ok' : r.status === 'FAILED' ? 'bad' : 'warn'}>{r.status === 'REQUESTED' ? 'Waiting for the provider' : r.status === 'PROCESSED' ? 'Sent' : 'Failed'}</Badge>
                <span className="min-w-0 flex-1 truncate text-muted">{r.reason}</span>
                <span className="text-xs text-muted">{fmtDateTime(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 font-semibold">What happened</h3>
        <ol className="space-y-1 text-sm">
          {p.history.map((h, i) => <li key={i} className="flex flex-wrap gap-2"><span className="text-xs text-muted">{fmtDateTime(h.at)}</span><span>{h.status}</span><span className="text-muted">by {h.by}{h.note ? ` — ${h.note}` : ''}</span></li>)}
        </ol>
      </div>

      <div>
        <h3 className="mb-2 font-semibold">Ledger entries</h3>
        {ledger.length === 0 ? <p className="text-sm text-muted">Nothing is booked for this payment yet.</p> : ledger.map((t) => (
          <div key={t.txn_id} className="mb-3 rounded-lg border border-line p-3 text-sm">
            <div className="mb-1 flex flex-wrap justify-between gap-2"><span className="font-medium">{t.type.replace(/_/g, ' ').toLowerCase()}</span><span className="text-xs text-muted">{fmtDateTime(t.created_at)}</span></div>
            <table className="w-full text-left text-xs"><thead className="text-muted"><tr><th className="py-1 pr-2 font-normal">Account</th><th className="py-1 pr-2 text-right font-normal">Debit</th><th className="py-1 text-right font-normal">Credit</th></tr></thead>
              <tbody>{t.entries.map((e, i) => <tr key={i}><td className="py-0.5 pr-2">{e.account.replace(/_/g, ' ').toLowerCase()}{e.driverId ? ` (${e.driverId})` : ''}</td><td className="py-0.5 pr-2 text-right">{e.debitMinor ? fmtMinor(e.debitMinor, p.currency) : ''}</td><td className="py-0.5 text-right">{e.creditMinor ? fmtMinor(e.creditMinor, p.currency) : ''}</td></tr>)}</tbody></table>
            {t.memo && <p className="mt-1 text-xs text-muted">{t.memo}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
