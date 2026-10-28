import { useState, type FormEvent } from 'react'
import { ops } from '@/api'
import { useBusinessMutation } from '@/api/hooks'
import { CASH_LABEL, fmtMinor, minorToInput, newIdempotencyKey, remainingRefundable, validateCashResolution, validateRefund, type AdminPayment } from '@/lib/payments'
import { fmtDateTime } from '@/lib/labels'
import Modal from '@/components/Modal'
import { Alert, Button, Field } from '@/components/ui'

/**
 * Refund part or all of a paid online fare. The dialog makes one idempotency key when it opens, so pressing the button twice (or the
 * server replying slowly) is one refund. The amount is checked here against what is left, and again by the server.
 */
export function RefundModal({ payment, onClose }: { payment: AdminPayment; onClose: () => void }) {
  const left = remainingRefundable(payment)
  const [key] = useState(() => newIdempotencyKey('refund'))
  const [amount, setAmount] = useState(minorToInput(left, payment.currency))
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const check = validateRefund({ amount, reason }, payment)
  const save = useBusinessMutation(
    (v: { amountMinor: number; reason: string }) => ops.payments.refund(payment.payment_id, { ...v, idempotencyKey: key }),
    { success: (r) => (r.duplicate ? 'That refund was already recorded' : r.refund.status === 'PROCESSED' ? 'Refund sent' : r.refund.status === 'FAILED' ? 'The provider refused the refund' : 'Refund requested. It is booked when the provider confirms.'), onSuccess: onClose },
  )
  const errors = { ...(touched ? check.errors : {}), ...save.fieldErrors }

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (save.isPending || check.amountMinor === null || Object.keys(check.errors).length) return
    save.mutate({ amountMinor: check.amountMinor, reason: reason.trim() })
  }

  return (
    <Modal title="Refund this payment" onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-3">
        <p className="text-sm text-muted">
          Paid {fmtMinor(payment.amount_minor, payment.currency)}; {fmtMinor(left, payment.currency)} can still be refunded. A refund is taken from the business's commission and the driver's earnings in proportion. If the driver was already paid, they will owe it.
        </p>
        <Field label={`Amount to refund (${payment.currency})`} error={errors.amount}>
          {(p) => <input {...p} inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); save.reset() }} />}
        </Field>
        <Field label="Reason (kept in the audit log)" error={errors.reason}>
          {(p) => <input {...p} maxLength={200} value={reason} onChange={(e) => { setReason(e.target.value); save.reset() }} />}
        </Field>
        {save.isError && Object.keys(save.fieldErrors).length === 0 && <Alert kind="error">{save.error.message}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" loading={save.isPending}>Refund</Button>
        </div>
      </form>
    </Modal>
  )
}

/** The business decides a disputed cash collection: the fare stands, or it is adjusted to what was actually owed. Needs a reason; audited. */
export function CashResolveModal({ payment, onClose }: { payment: AdminPayment; onClose: () => void }) {
  const [action, setAction] = useState<'CONFIRM' | 'ADJUST'>('CONFIRM')
  const [fare, setFare] = useState(minorToInput(payment.cash?.collectedMinor ?? payment.amount_minor, payment.currency))
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const check = validateCashResolution({ action, fare, reason }, payment.currency)
  const save = useBusinessMutation(
    (v: { action: 'CONFIRM' | 'ADJUST'; adjustedFareMinor: number | null; reason: string }) => ops.payments.resolveCash(payment.payment_id, v),
    { success: 'Decision recorded', onSuccess: onClose },
  )
  const errors = { ...(touched ? check.errors : {}), ...save.fieldErrors }
  const dispute = payment.cash?.dispute

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (save.isPending || Object.keys(check.errors).length) return
    save.mutate({ action, adjustedFareMinor: check.adjustedFareMinor, reason: reason.trim() })
  }

  return (
    <Modal title="Decide a cash dispute" onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-3">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted">Fare the server finalised</dt><dd className="font-medium">{fmtMinor(payment.amount_minor, payment.currency)}</dd></div>
          <div><dt className="text-xs text-muted">Cash the driver says they collected</dt><dd className="font-medium">{fmtMinor(payment.cash?.collectedMinor, payment.currency)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-muted">Dispute{dispute ? ` (raised by the ${dispute.by}, ${fmtDateTime(dispute.at)})` : ''}</dt><dd>{dispute?.reason ?? CASH_LABEL.DISPUTED}</dd></div>
        </dl>
        <fieldset className="space-y-1 text-sm">
          <legend className="mb-1 text-xs font-medium text-muted">Decision</legend>
          <label className="flex items-start gap-2"><input type="radio" name="action" checked={action === 'CONFIRM'} onChange={() => setAction('CONFIRM')} className="mt-1" /> <span>The fare stands. Book the commission on {fmtMinor(payment.amount_minor, payment.currency)}.</span></label>
          <label className="flex items-start gap-2"><input type="radio" name="action" checked={action === 'ADJUST'} onChange={() => setAction('ADJUST')} className="mt-1" /> <span>Adjust the fare. The earlier booking is reversed and the commission is worked out again on the new fare. The original fare is never rewritten.</span></label>
        </fieldset>
        {action === 'ADJUST' && (
          <Field label={`Fare actually owed (${payment.currency})`} error={errors.fare ?? errors.adjusted_fare_minor}>
            {(p) => <input {...p} inputMode="decimal" value={fare} onChange={(e) => { setFare(e.target.value); save.reset() }} />}
          </Field>
        )}
        <Field label="Reason (kept in the audit log)" error={errors.reason}>
          {(p) => <input {...p} maxLength={200} value={reason} onChange={(e) => { setReason(e.target.value); save.reset() }} />}
        </Field>
        {save.isError && Object.keys(save.fieldErrors).length === 0 && <Alert kind="error">{save.error.message}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>Record decision</Button>
        </div>
      </form>
    </Modal>
  )
}
