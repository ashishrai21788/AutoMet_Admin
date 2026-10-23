import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ApiError, ops } from '@/api'
import { usePayouts, usePayout, usePayoutSettings, useAdjustments, useDrivers } from '@/api/hooks'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { fmtDateTime, fmtMoney, timeAgo, useDebounced } from '@/lib/labels'
import { usePage } from '@/lib/usePage'
import type { PayoutItem, PayoutStatus } from '@/lib/types'
import { useToast } from '@/components/feedback'
import Modal from '@/components/Modal'
import { SearchInput } from '@/components/DataTable'
import { Badge, Button, Card, EmptyState, ErrorState, Field, PageHeader, SelectField, Spinner } from '@/components/ui'

const TABS: [string, string][] = [['', 'All'], ['REQUESTED', 'New'], ['PROCESSING', 'Processing'], ['PAID', 'Paid'], ['FAILED', 'Failed'], ['CANCELLED', 'Cancelled']]
const KIND: Record<PayoutStatus, 'ok' | 'warn' | 'bad' | 'neutral'> = { REQUESTED: 'warn', PROCESSING: 'warn', PAID: 'ok', FAILED: 'bad', CANCELLED: 'neutral' }
const LABEL: Record<PayoutStatus, string> = { REQUESTED: 'New', PROCESSING: 'Processing', PAID: 'Paid', FAILED: 'Failed', CANCELLED: 'Cancelled' }
const PAGE_SIZE = 12

export const PayoutBadge = ({ status }: { status: PayoutStatus }) => <Badge kind={KIND[status]}>{LABEL[status]}</Badge>

function Detail({ id, canManage, currency }: { id: string; canManage: boolean; currency: string }) {
  const toast = useToast()
  const qc = useQueryClient()
  const q = usePayout(id, canManage)
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  if (q.isLoading) return <Spinner />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const d = q.data!
  const open = d.status === 'REQUESTED' || d.status === 'PROCESSING'

  async function act(kind: 'start' | 'pay' | 'fail', e?: FormEvent) {
    e?.preventDefault()
    if (busy) return
    setBusy(kind); setErrors({})
    try {
      if (kind === 'start') await ops.payouts.start(id)
      else if (kind === 'pay') await ops.payouts.pay(id, reference.trim())
      else await ops.payouts.fail(id, reason.trim())
      await qc.invalidateQueries({ queryKey: ['biz'] })
      toast.success(kind === 'pay' ? 'Marked as paid. The driver can see it now.' : kind === 'fail' ? 'Marked as failed. The amount is back in the driver\'s balance.' : 'Marked as processing')
      setReference(''); setReason('')
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
      else toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally { setBusy('') }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-2xl font-semibold">{fmtMoney(d.amount, currency)}</div>
            <div className="text-sm text-muted"><Link className="underline" to={`/drivers/${d.driverId}`}>{d.driverName}</Link> · {d.driverPhone}</div>
          </div>
          <PayoutBadge status={d.status} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted">Requested</dt><dd>{fmtDateTime(d.requestedAt)}</dd></div>
          {d.paidAt && <div><dt className="text-xs text-muted">Paid</dt><dd>{fmtDateTime(d.paidAt)}</dd></div>}
          {d.reference && <div><dt className="text-xs text-muted">Bank reference (UTR)</dt><dd className="font-mono">{d.reference}</dd></div>}
          {d.failureReason && <div><dt className="text-xs text-muted">Reason it failed</dt><dd>{d.failureReason}</dd></div>}
        </dl>
      </Card>

      {canManage && (
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">Pay to this account</h3>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted">Account holder</dt><dd>{d.account.holder || '—'}</dd></div>
            <div><dt className="text-xs text-muted">Bank</dt><dd>{d.account.bankName || '—'}</dd></div>
            <div><dt className="text-xs text-muted">Account number</dt><dd className="font-mono">{d.account.accountNumber || '—'}</dd></div>
            <div><dt className="text-xs text-muted">IFSC</dt><dd className="font-mono">{d.account.ifsc || '—'}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted">Opening this request is recorded in the audit log. Check the amount and account carefully before you transfer.</p>
        </Card>
      )}

      {canManage && open && (
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">Record the result</h3>
          {d.status === 'REQUESTED' && <div className="mb-4"><Button variant="ghost" loading={busy === 'start'} onClick={() => act('start')}>Mark as processing</Button></div>}
          <form onSubmit={(e) => act('pay', e)} noValidate className="space-y-3">
            <Field label="Bank reference (UTR) after you transfer" error={errors.reference} hint="Required. The same reference can only be used once.">
              {(p) => <input {...p} value={reference} maxLength={40} onChange={(e) => { setReference(e.target.value); setErrors({}) }} />}
            </Field>
            <Button type="submit" loading={busy === 'pay'} disabled={reference.trim().length < 4}>Mark as paid</Button>
          </form>
          <form onSubmit={(e) => act('fail', e)} noValidate className="mt-5 space-y-3 border-t border-line pt-4">
            <Field label="Or, if you could not pay it: the reason the driver will see" error={errors.reason}>
              {(p) => <input {...p} value={reason} maxLength={140} onChange={(e) => { setReason(e.target.value); setErrors({}) }} />}
            </Field>
            <Button type="submit" variant="danger" loading={busy === 'fail'} disabled={reason.trim().length < 3}>Mark as failed</Button>
          </form>
        </Card>
      )}
    </div>
  )
}

function AdjustmentModal({ currency, onClose }: { currency: string; onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const drivers = useDrivers({ pageSize: 100 })
  const recent = useAdjustments({})
  const [driverId, setDriverId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  async function save(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErrors({})
    try {
      await ops.adjustments.add({ driverId, amount: Number(amount), reason: reason.trim() })
      await qc.invalidateQueries({ queryKey: ['biz'] })
      toast.success('Recorded. The driver sees it in their earnings.')
      setAmount(''); setReason('')
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
      else toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally { setBusy(false) }
  }
  return (
    <Modal title="Adjust a driver's earnings" onClose={onClose}>
      <form onSubmit={save} noValidate className="space-y-3">
        <p className="text-xs text-muted">For a correction or a payment outside a trip (for example a toll refund). A positive amount adds to what you owe the driver, a negative amount takes away. The driver sees the reason. It cannot be edited afterwards; add the opposite amount to correct it.</p>
        <SelectField label="Driver" value={driverId} error={errors.driverId} onChange={(e) => setDriverId(e.target.value)}>
          <option value="">Choose a driver</option>
          {(drivers.data?.items ?? []).map((d) => <option key={d.id} value={d.id}>{d.name} · {d.phone}</option>)}
        </SelectField>
        <Field label={`Amount (${currency}, negative to take away)`} error={errors.amount}>{(p) => <input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
        <Field label="Reason (the driver sees it)" error={errors.reason}>{(p) => <input {...p} maxLength={140} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Close</Button><Button type="submit" loading={busy} disabled={!driverId || !amount || reason.trim().length < 5}>Record</Button></div>
      </form>
      {recent.data && recent.data.items.length > 0 && (
        <div className="mt-5 border-t border-line pt-3">
          <h4 className="mb-2 text-sm font-semibold">Recent</h4>
          <ul className="max-h-48 space-y-1 overflow-auto text-xs">
            {recent.data.items.slice(0, 15).map((a) => <li key={a.id} className="flex justify-between gap-2"><span className="truncate">{a.driverName} · {a.kind === 'INCENTIVE' ? 'Incentive: ' + a.title : a.kind === 'PENALTY' ? 'Cancellation penalty: ' + a.reason : a.kind === 'PENALTY_WAIVER' ? 'Penalty waived: ' + a.reason : a.reason}</span><span className={a.amount < 0 ? 'text-danger' : ''}>{fmtMoney(a.amount, currency)}</span></li>)}
          </ul>
        </div>
      )}
    </Modal>
  )
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const s = usePayoutSettings()
  const [pct, setPct] = useState<string | null>(null)
  const [min, setMin] = useState<string | null>(null)
  const [cash, setCash] = useState<boolean | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const d = s.data
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!d || busy) return
    setBusy(true); setErrors({})
    try {
      await ops.payouts.updateSettings({ commissionPercent: Number(pct ?? d.commissionPercent), minWithdrawal: Number(min ?? d.minWithdrawal), cashWithdrawable: cash ?? d.cashWithdrawable, processingNote: note ?? d.processingNote })
      await qc.invalidateQueries({ queryKey: ['biz'] })
      toast.success('Payout settings saved. Earnings already recorded on past trips do not change.')
      onClose()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
      else toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally { setBusy(false) }
  }
  return (
    <Modal title="Payout settings" onClose={onClose}>
      {!d ? <Spinner /> : (
        <form onSubmit={save} noValidate className="space-y-4">
          <Field label="Your share of each fare (%)" error={errors.commissionPercent} hint="0 means the driver receives the whole fare. A change applies to trips finished from now on; past trips keep the earnings they were completed with.">
            {(p) => <input {...p} inputMode="decimal" value={pct ?? String(d.commissionPercent)} onChange={(e) => { setPct(e.target.value); setErrors({}) }} />}
          </Field>
          <Field label={`Smallest withdrawal (${d.currency})`} error={errors.minWithdrawal} hint="0 allows any amount.">
            {(p) => <input {...p} inputMode="decimal" value={min ?? String(d.minWithdrawal)} onChange={(e) => { setMin(e.target.value); setErrors({}) }} />}
          </Field>
          <Field label="How long payouts usually take (shown to drivers, optional)" error={errors.processingNote} hint="For example: Payouts are usually processed within 1 to 2 business days.">
            {(p) => <input {...p} maxLength={140} value={note ?? d.processingNote} onChange={(e) => { setNote(e.target.value); setErrors({}) }} />}
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={cash ?? d.cashWithdrawable} onChange={(e) => setCash(e.target.checked)} />
            <span>Let drivers withdraw cash earnings too<span className="block text-xs text-muted">Off (recommended): a cash ride is already paid to the driver by the passenger, so only online earnings, less your share of cash rides, can be withdrawn.</span></span>
          </label>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
        </form>
      )}
    </Modal>
  )
}

export default function Payouts() {
  const user = useAuth((s) => s.session?.user)
  const canManage = can(user, 'payments.manage')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [settings, setSettings] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [selected, setSelected] = useState('')
  const q = useDebounced(search.trim())
  const [page, setPage] = usePage(JSON.stringify([status, q]))
  const list = usePayouts({ status, q, page, pageSize: PAGE_SIZE })
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1
  const currency = list.data?.currency ?? 'INR'
  const waiting = list.data ? list.data.totals.REQUESTED.count + list.data.totals.PROCESSING.count : 0

  return (
    <>
      <PageHeader
        title="Driver payouts"
        subtitle="Withdrawals your drivers have asked for. Pay them by bank transfer, then record the bank reference here."
        action={<div className="flex items-center gap-2">{list.data && <Badge kind={waiting ? 'warn' : 'ok'}>{waiting} waiting</Badge>}{canManage && <Button variant="ghost" onClick={() => setAdjusting(true)}>Adjust earnings</Button>}{canManage && <Button variant="ghost" onClick={() => setSettings(true)}>Payout settings</Button>}</div>}
      />
      {list.data && (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          {(['REQUESTED', 'PROCESSING', 'PAID', 'FAILED'] as PayoutStatus[]).map((s) => (
            <Card key={s} className="p-4"><div className="text-xs text-muted">{LABEL[s]}</div><div className="text-lg font-semibold">{fmtMoney(list.data!.totals[s].amount, currency)}</div><div className="text-xs text-muted">{list.data!.totals[s].count} request{list.data!.totals[s].count === 1 ? '' : 's'}</div></Card>
          ))}
        </div>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <Card>
          <div className="space-y-3 border-b border-line p-4">
            <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1">
              {TABS.map(([k, label]) => <button key={k || 'all'} type="button" role="tab" aria-selected={status === k} onClick={() => setStatus(k)} className={`rounded-full border px-3 py-1 text-sm ${status === k ? 'border-brand bg-brand/15 font-medium' : 'border-line text-muted hover:text-ink'}`}>{label}</button>)}
            </div>
            <SearchInput value={search} onChange={setSearch} placeholder="Search driver, phone or reference" />
          </div>
          {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data!.items.length === 0 ? (
            <EmptyState title={status || q ? 'No payouts match' : 'No withdrawals yet'} text={status || q ? 'Try another status or search.' : 'Requests appear here when a driver withdraws from the Earnings screen of the driver app.'} />
          ) : (
            <>
              <ul className="divide-y divide-line" aria-label="Payouts">
                {list.data!.items.map((i: PayoutItem) => (
                  <li key={i.id}>
                    <button type="button" onClick={() => setSelected(i.id)} aria-current={i.id === selected} className={`block w-full px-4 py-3 text-left hover:bg-black/[.03] dark:hover:bg-white/5 ${i.id === selected ? 'bg-brand/10' : ''}`}>
                      <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{i.driverName}</span><PayoutBadge status={i.status} /></div>
                      <div className="mt-0.5 text-sm font-semibold">{fmtMoney(i.amount, currency)}</div>
                      <div className="text-[11px] text-muted">{i.bank || 'No bank'} · {timeAgo(i.requestedAt)}{i.reference ? ` · ${i.reference}` : ''}</div>
                    </button>
                  </li>
                ))}
              </ul>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-line px-4 py-2 text-sm">
                  <span className="text-muted">Page {page} of {pages}</span>
                  <div className="flex gap-2"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></div>
                </div>
              )}
            </>
          )}
        </Card>
        <div className="min-w-0">{selected ? <Detail key={selected} id={selected} canManage={canManage} currency={currency} /> : <Card><EmptyState title="Choose a request" text="Select a withdrawal on the left to see the account to pay and to record the result." /></Card>}</div>
      </div>
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
      {adjusting && <AdjustmentModal currency={currency} onClose={() => setAdjusting(false)} />}
    </>
  )
}
