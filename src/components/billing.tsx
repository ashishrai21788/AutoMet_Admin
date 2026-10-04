import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, platform } from '@/api'
import { fmtDate, fmtMoney } from '@/lib/labels'
import { CYCLE_LABEL, METHOD_LABEL, TYPE_LABEL, refreshPlatform } from '@/lib/billing'
import type { AssignSubscriptionInput, Invoice, PaymentMethod, Plan, Subscription } from '@/lib/types'
import DataTable, { type Column, type ServerPaging } from '@/components/DataTable'
import Modal from '@/components/Modal'
import ReasonModal from '@/components/ReasonModal'
import { useToast } from '@/components/feedback'
import { Badge, Button, SelectField, TextField, Textarea, Field } from '@/components/ui'

const today = () => new Date().toISOString().slice(0, 10)
const plusDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)


function InvoiceBadge({ i }: { i: Pick<Invoice, 'status' | 'overdue' | 'refundedAmount'> }) {
  if (i.status === 'void') return <Badge>Void</Badge>
  if (i.status === 'paid') return <Badge kind="ok">{i.refundedAmount > 0 ? 'Paid · refunded' : 'Paid'}</Badge>
  return <Badge kind={i.overdue ? 'bad' : 'warn'}>{i.overdue ? 'Overdue' : 'Unpaid'}</Badge>
}

export function SubscriptionBadge({ status }: { status: Subscription['status'] | 'none' }) {
  if (status === 'active') return <Badge kind="ok">Active</Badge>
  if (status === 'trialing') return <Badge kind="warn">Trial</Badge>
  if (status === 'cancelled') return <Badge kind="bad">Cancelled</Badge>
  return <Badge>No plan</Badge>
}

// ---------------------------------------------------------------- invoice actions

function PayModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState<{ paymentMethod: PaymentMethod | ''; reference: string; paidAt: string }>({ paymentMethod: '', reference: '', paidAt: today() })
  const pay = useMutation({
    mutationFn: () => platform.payInvoice(invoice.id, { paymentMethod: form.paymentMethod as PaymentMethod, reference: form.reference.trim(), paidAt: form.paidAt }),
    onSuccess: async () => { await refreshPlatform(qc); toast.success(`${invoice.number} marked paid`); onClose() },
    onError: (e) => { if (!(e instanceof ApiError) || !Object.keys(e.fieldErrors).length) toast.error(e.message) },
  })
  const fe = pay.error instanceof ApiError ? pay.error.fieldErrors : {}
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => { setForm({ ...form, [k]: e.target.value }); pay.reset() }
  return (
    <Modal title={`Record payment for ${invoice.number}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="pay-form" loading={pay.isPending}>Mark as paid</Button></>}>
      <form id="pay-form" noValidate className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); pay.mutate() }}>
        <p className="text-sm">{invoice.businessName} · <strong>{fmtMoney(invoice.amount, invoice.currency)}</strong>. Payments are recorded by hand; AutoMet does not collect money through this screen.</p>
        <SelectField label="Payment method" value={form.paymentMethod} onChange={set('paymentMethod')} error={fe.paymentMethod}>
          <option value="">Choose…</option>
          {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
        </SelectField>
        <TextField label="Reference (optional)" hint="Transaction or cheque number, for your own records." value={form.reference} onChange={set('reference')} maxLength={120} error={fe.reference} />
        <TextField label="Date received" type="date" value={form.paidAt} max={today()} onChange={set('paidAt')} error={fe.paidAt} />
      </form>
    </Modal>
  )
}

function RefundModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const left = Math.round((invoice.amount - invoice.refundedAmount) * 100) / 100
  const [amount, setAmount] = useState(String(left))
  const [reason, setReason] = useState('')
  const refund = useMutation({
    mutationFn: () => platform.refundInvoice(invoice.id, { amount, reason: reason.trim() }),
    onSuccess: async () => { await refreshPlatform(qc); toast.success(`Refunded ${fmtMoney(Number(amount), invoice.currency)} on ${invoice.number}`); onClose() },
    onError: (e) => { if (!(e instanceof ApiError) || !Object.keys(e.fieldErrors).length) toast.error(e.message) },
  })
  const fe = refund.error instanceof ApiError ? refund.error.fieldErrors : {}
  return (
    <Modal title={`Refund on ${invoice.number}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="refund-form" variant="danger" loading={refund.isPending}>Record refund</Button></>}>
      <form id="refund-form" noValidate className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); refund.mutate() }}>
        <p className="text-sm">{invoice.businessName} paid {fmtMoney(invoice.amount, invoice.currency)}{invoice.refundedAmount > 0 ? `, of which ${fmtMoney(invoice.refundedAmount, invoice.currency)} has been refunded` : ''}. You can refund up to <strong>{fmtMoney(left, invoice.currency)}</strong>. This records a refund you have made; it does not send money.</p>
        <TextField label="Amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); refund.reset() }} error={fe.amount} />
        <Field label="Reason (required)" error={fe.reason}>{(p) => <Textarea {...p} rows={3} maxLength={300} value={reason} onChange={(e) => { setReason(e.target.value); refund.reset() }} />}</Field>
      </form>
    </Modal>
  )
}

/** Pay, void or refund an invoice. Which actions show depends on the invoice's state. */
export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'pay' | 'void' | 'refund' | null>(null)
  const canRefund = invoice.status === 'paid' && invoice.refundedAmount < invoice.amount
  if (invoice.status === 'void' || (invoice.status === 'paid' && !canRefund)) return null
  return (
    <div className="flex justify-end gap-1">
      {invoice.status === 'issued' && <><Button variant="ghost" onClick={() => setMode('pay')}>Record payment</Button><Button variant="ghost" onClick={() => setMode('void')}>Void</Button></>}
      {canRefund && <Button variant="ghost" onClick={() => setMode('refund')}>Refund</Button>}
      {mode === 'pay' && <PayModal invoice={invoice} onClose={() => setMode(null)} />}
      {mode === 'refund' && <RefundModal invoice={invoice} onClose={() => setMode(null)} />}
      {mode === 'void' && (
        <ReasonModal title={`Void ${invoice.number}?`} intro={<>This cancels the unpaid invoice for {invoice.businessName}. It is no longer counted as billed or outstanding. A voided invoice cannot be restored.</>}
          confirmLabel="Void invoice" successText={`${invoice.number} voided`}
          onSubmit={async (reason) => { await platform.voidInvoice(invoice.id, reason); await refreshPlatform(qc) }} onClose={() => setMode(null)} />
      )}
    </div>
  )
}

function invoiceColumns({ showBusiness }: { showBusiness: boolean }): Column<Invoice>[] {
  const cols: Column<Invoice>[] = [
    { header: 'Invoice', cell: (i) => <div><div className="font-mono text-xs font-medium">{i.number}</div><div className="text-xs text-muted">{TYPE_LABEL[i.type]}</div></div> },
  ]
  if (showBusiness) cols.push({ header: 'Business', cell: (i) => <span className="text-sm">{i.businessName}</span> })
  cols.push(
    { header: 'Period / for', cell: (i) => <span className="text-xs text-muted">{i.periodStart && i.periodEnd ? `${fmtDate(i.periodStart)} – ${fmtDate(i.periodEnd)}` : i.description}</span> },
    { header: 'Amount', className: 'text-right', cell: (i) => <div className="text-sm tabular-nums">{fmtMoney(i.amount, i.currency)}{i.refundedAmount > 0 && <div className="text-xs text-danger">− {fmtMoney(i.refundedAmount, i.currency)} refunded</div>}</div> },
    { header: 'Due', cell: (i) => <span className="text-xs">{fmtDate(i.dueDate)}</span> },
    { header: 'Status', cell: (i) => <div><InvoiceBadge i={i} />{i.status === 'paid' && <div className="mt-1 text-xs text-muted">{fmtDate(i.paidAt)}{i.paymentMethod ? ` · ${METHOD_LABEL[i.paymentMethod]}` : ''}</div>}</div> },
    { header: 'Actions', hideLabel: true, className: 'text-right', cell: (i) => <InvoiceActions invoice={i} /> },
  )
  return cols
}

export function InvoiceTable({ rows, showBusiness, paging, loading }: { rows: Invoice[]; showBusiness: boolean; paging?: ServerPaging; loading?: boolean }) {
  return <DataTable rows={rows} columns={invoiceColumns({ showBusiness })} rowKey={(i) => i.id} paging={paging} loading={loading} empty={{ title: 'No invoices', text: 'Invoices you issue will appear here.' }} />
}

// ---------------------------------------------------------------- subscription actions

export function AssignPlanModal({ appId, businessName, plans, current, onClose }: { appId: string; businessName: string; plans: Plan[]; current: Subscription | null; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const choices = plans.filter((p) => p.active || p.id === current?.planId)
  const [form, setForm] = useState({ planId: current?.planId ?? '', price: '', startDate: today(), trial: false, trialDays: '', notes: current?.notes ?? '', issueSetupInvoice: false })
  const plan = choices.find((p) => p.id === form.planId)
  const assign = useMutation({
    mutationFn: () => {
      const input: AssignSubscriptionInput = { planId: form.planId, startDate: form.startDate, trial: form.trial, notes: form.notes.trim(), issueSetupInvoice: form.issueSetupInvoice && !form.trial }
      if (form.price !== '') input.price = form.price
      if (form.trial && form.trialDays !== '') input.trialDays = form.trialDays
      return platform.assignSubscription(appId, input)
    },
    onSuccess: async () => { await refreshPlatform(qc); toast.success(current ? 'Subscription changed' : `${businessName} is now on a plan`); onClose() },
    onError: (e) => { if (!(e instanceof ApiError) || !Object.keys(e.fieldErrors).length) toast.error(e.message) },
  })
  const fe = assign.error instanceof ApiError ? assign.error.fieldErrors : {}
  const set = (k: keyof typeof form, v: string | boolean) => { setForm({ ...form, [k]: v }); assign.reset() }
  return (
    <Modal title={current ? `Change plan for ${businessName}` : `Put ${businessName} on a plan`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="assign-form" loading={assign.isPending}>{current ? 'Save subscription' : 'Start subscription'}</Button></>}>
      <form id="assign-form" noValidate className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); assign.mutate() }}>
        <SelectField label="Plan" value={form.planId} onChange={(e) => set('planId', e.target.value)} error={fe.planId}>
          <option value="">Choose a plan…</option>
          {choices.map((p) => <option key={p.id} value={p.id}>{p.name} · {fmtMoney(p.price, p.currency)} / {CYCLE_LABEL[p.cycle]}{p.active ? '' : ' (retired)'}</option>)}
        </SelectField>
        <TextField label="Agreed price (optional)" type="number" min="0" step="0.01" hint={plan ? `Leave empty for the list price, ${fmtMoney(plan.price, plan.currency)} per ${CYCLE_LABEL[plan.cycle]}.` : 'Leave empty for the plan’s list price.'} value={form.price} onChange={(e) => set('price', e.target.value)} error={fe.price} />
        <TextField label="Start date" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} error={fe.startDate} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={form.trial} onChange={(e) => set('trial', e.target.checked)} /> Start with a free trial (not counted as revenue until it converts)</label>
        {form.trial && <TextField label="Trial days (optional)" type="number" min="1" max="365" hint="Empty uses the plan’s trial length, or the platform default." value={form.trialDays} onChange={(e) => set('trialDays', e.target.value)} error={fe.trialDays} />}
        {!form.trial && plan && plan.setupFee > 0 && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={form.issueSetupInvoice} onChange={(e) => set('issueSetupInvoice', e.target.checked)} /> Also invoice the setup fee ({fmtMoney(plan.setupFee, plan.currency)})</label>
        )}
        <Field label="Notes (optional)" error={fe.notes}>{(p) => <Textarea {...p} rows={2} maxLength={500} value={form.notes} onChange={(e) => set('notes', e.target.value)} />}</Field>
      </form>
    </Modal>
  )
}

export function IssueInvoiceModal({ appId, subscription, onClose }: { appId: string; subscription: Subscription | null; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState<{ type: 'subscription' | 'setup_fee' | 'other'; amount: string; periodStart: string; periodEnd: string; dueDate: string; description: string }>({
    type: subscription ? 'subscription' : 'other', amount: '', periodStart: today(), periodEnd: plusDays(30), dueDate: '', description: '',
  })
  const issue = useMutation({
    mutationFn: () => platform.issueInvoice(appId, {
      type: form.type, ...(form.amount !== '' ? { amount: form.amount } : {}), ...(form.dueDate ? { dueDate: form.dueDate } : {}),
      ...(form.type === 'subscription' ? { periodStart: form.periodStart, periodEnd: form.periodEnd } : {}), ...(form.description.trim() ? { description: form.description.trim() } : {}),
    }),
    onSuccess: async (i) => { await refreshPlatform(qc); toast.success(`${i.number} issued`); onClose() },
    onError: (e) => { if (!(e instanceof ApiError) || !Object.keys(e.fieldErrors).length) toast.error(e.message) },
  })
  const fe = issue.error instanceof ApiError ? issue.error.fieldErrors : {}
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => { setForm({ ...form, [k]: e.target.value }); issue.reset() }
  const defaultAmount = form.type === 'subscription' ? subscription?.price : form.type === 'setup_fee' ? subscription?.setupFee : undefined
  return (
    <Modal title="Issue an invoice" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="invoice-form" loading={issue.isPending}>Issue invoice</Button></>}>
      <form id="invoice-form" noValidate className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); issue.mutate() }}>
        <SelectField label="Type" value={form.type} onChange={set('type')} error={fe.type}>
          {subscription && <option value="subscription">Subscription period</option>}
          {subscription && <option value="setup_fee">Setup fee</option>}
          <option value="other">Other charge</option>
        </SelectField>
        {form.type === 'subscription' && <div className="grid grid-cols-2 gap-3"><TextField label="Period start" type="date" value={form.periodStart} onChange={set('periodStart')} error={fe.periodStart} /><TextField label="Period end" type="date" value={form.periodEnd} onChange={set('periodEnd')} error={fe.periodEnd} /></div>}
        <TextField label={defaultAmount ? 'Amount (optional)' : 'Amount'} type="number" min="0" step="0.01" hint={defaultAmount ? `Empty uses ${fmtMoney(defaultAmount, subscription!.currency)} from the subscription.` : undefined} value={form.amount} onChange={set('amount')} error={fe.amount} />
        <TextField label="Due date (optional)" type="date" hint="Empty uses the platform’s default payment term." value={form.dueDate} onChange={set('dueDate')} error={fe.dueDate} />
        {form.type === 'other' && <TextField label="Description" value={form.description} onChange={set('description')} maxLength={200} error={fe.description} />}
      </form>
    </Modal>
  )
}
