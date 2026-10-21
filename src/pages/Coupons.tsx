import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, ops } from '@/api'
import { useCategories, useCoupons, useCouponRedemptions, useRegions } from '@/api/hooks'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { fmtDateTime, fmtMoney, useDebounced } from '@/lib/labels'
import { usePage } from '@/lib/usePage'
import type { CouponItem } from '@/lib/types'
import { useToast } from '@/components/feedback'
import Modal from '@/components/Modal'
import { SearchInput } from '@/components/DataTable'
import { Badge, Button, Card, EmptyState, ErrorState, Field, PageHeader, SelectField, Spinner } from '@/components/ui'

const STATE: Record<CouponItem['state'], { label: string; kind: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  LIVE: { label: 'Live', kind: 'ok' }, SCHEDULED: { label: 'Scheduled', kind: 'warn' }, EXPIRED: { label: 'Expired', kind: 'neutral' }, USED_UP: { label: 'Fully used', kind: 'neutral' }, OFF: { label: 'Off', kind: 'neutral' },
}
const PAGE_SIZE = 10

const toLocal = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }

function Form({ item, currency, onClose }: { item: CouponItem | null; currency: string; onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const cats = useCategories()
  const regions = useRegions()
  const used = (item?.redeemed ?? 0) > 0
  const [start] = useState(() => new Date())
  const [code, setCode] = useState(item?.code ?? '')
  const [title, setTitle] = useState(item?.title ?? '')
  const [type, setType] = useState<'PERCENT' | 'FIXED'>(item?.type ?? 'PERCENT')
  const [value, setValue] = useState(String(item?.value ?? ''))
  const [maxDiscount, setMaxDiscount] = useState(String(item?.maxDiscount ?? ''))
  const [minFare, setMinFare] = useState(String(item?.minFare ?? ''))
  const [totalLimit, setTotalLimit] = useState(String(item?.totalLimit ?? 0))
  const [perUserLimit, setPerUserLimit] = useState(String(item?.perUserLimit ?? 1))
  const [startsAt, setStartsAt] = useState(toLocal(item?.startsAt ?? start.toISOString()))
  const [endsAt, setEndsAt] = useState(toLocal(item?.endsAt ?? new Date(start.getTime() + 30 * 86400_000).toISOString()))
  const [categoryIds, setCategoryIds] = useState<string[]>(item?.categoryIds ?? [])
  const [regionIds, setRegionIds] = useState<string[]>(item?.regionIds ?? [])
  const [newUsersOnly, setNewUsersOnly] = useState(item?.newUsersOnly ?? false)
  const [fundedBy, setFundedBy] = useState<'BUSINESS' | 'DRIVER'>(item?.fundedBy ?? 'BUSINESS')
  const [active, setActive] = useState(item?.active ?? true)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErrors({})
    const body = {
      code, title, type, value: Number(value), maxDiscount: maxDiscount === '' ? 0 : Number(maxDiscount), minFare: minFare === '' ? 0 : Number(minFare),
      totalLimit: Number(totalLimit), perUserLimit: Number(perUserLimit), startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(),
      categoryIds, regionIds, newUsersOnly, fundedBy, active,
    }
    try {
      if (item) await ops.coupons.update(item.id, body)
      else await ops.coupons.create(body)
      await qc.invalidateQueries({ queryKey: ['biz'] })
      toast.success(item ? 'Saved' : 'Coupon created. Riders can apply it as soon as it starts.')
      onClose()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
      else toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally { setBusy(false) }
  }

  const chips = (title: string, ids: string[], options: { id: string; name: string }[], set: (v: string[]) => void, error?: string) => (
    <div>
      <div className="mb-1 text-xs font-medium text-muted">{title} <span className="font-normal">(none selected means all)</span></div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => <button key={o.id} type="button" onClick={() => toggle(ids, set, o.id)} aria-pressed={ids.includes(o.id)} className={`rounded-full border px-3 py-1 text-sm ${ids.includes(o.id) ? 'border-brand bg-brand/15 font-medium' : 'border-line text-muted'}`}>{o.name}</button>)}
        {options.length === 0 && <span className="text-xs text-muted">Nothing set up yet.</span>}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )

  return (
    <Modal title={item ? `Edit ${item.code}` : 'New coupon'} onClose={onClose} wide>
      <form onSubmit={save} noValidate className="space-y-3">
        {used && <p className="rounded-lg bg-black/5 p-2 text-xs dark:bg-white/5">This coupon has been used {item!.redeemed} time{item!.redeemed === 1 ? '' : 's'}, so its code and discount are fixed. You can still change who can use it, switch it off or move the end date.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code riders type" error={errors.code}>{(p) => <input {...p} disabled={used} value={code} maxLength={20} placeholder="WELCOME50" onChange={(e) => setCode(e.target.value.toUpperCase())} />}</Field>
          <Field label="Name (for you)" error={errors.title}>{(p) => <input {...p} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />}</Field>
          <SelectField label="Discount type" value={type} disabled={used} error={errors.type} onChange={(e) => setType(e.target.value as 'PERCENT' | 'FIXED')}>
            <option value="PERCENT">Percentage of the ride total</option>
            <option value="FIXED">Fixed amount</option>
          </SelectField>
          <Field label={type === 'PERCENT' ? 'Percent off' : `Amount off (${currency})`} error={errors.value}>{(p) => <input {...p} inputMode="decimal" disabled={used} value={value} onChange={(e) => setValue(e.target.value)} />}</Field>
          {type === 'PERCENT' && <Field label={`Largest discount (${currency})`} error={errors.maxDiscount} hint="0 means no cap">{(p) => <input {...p} inputMode="decimal" disabled={used} value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} />}</Field>}
          <Field label={`Smallest ride total (${currency})`} error={errors.minFare} hint="0 means any ride">{(p) => <input {...p} inputMode="decimal" disabled={used} value={minFare} onChange={(e) => setMinFare(e.target.value)} />}</Field>
          <Field label="Starts" error={errors.startsAt}>{(p) => <input {...p} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />}</Field>
          <Field label="Ends" error={errors.endsAt}>{(p) => <input {...p} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />}</Field>
          <Field label="Total uses allowed" error={errors.totalLimit} hint="0 means unlimited">{(p) => <input {...p} inputMode="numeric" value={totalLimit} onChange={(e) => setTotalLimit(e.target.value)} />}</Field>
          <Field label="Uses per rider" error={errors.perUserLimit} hint="0 means unlimited">{(p) => <input {...p} inputMode="numeric" value={perUserLimit} onChange={(e) => setPerUserLimit(e.target.value)} />}</Field>
        </div>
        {chips('Vehicle categories', categoryIds, (cats.data ?? []).map((c) => ({ id: c.id, name: c.name })), setCategoryIds, errors.categoryIds)}
        {chips('Service areas', regionIds, (regions.data ?? []).map((r) => ({ id: r.id, name: `${r.city} · ${r.zoneName}` })), setRegionIds, errors.regionIds)}
        <SelectField label="Who pays for the discount" value={fundedBy} disabled={used} error={errors.fundedBy} onChange={(e) => setFundedBy(e.target.value as 'BUSINESS' | 'DRIVER')} hint="Your business (default): the driver is still paid the full fare and you owe them the difference. Driver: they earn on what the rider paid.">
          <option value="BUSINESS">My business</option>
          <option value="DRIVER">The driver</option>
        </SelectField>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newUsersOnly} onChange={(e) => setNewUsersOnly(e.target.checked)} /> Only for riders who have not completed a ride yet</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label>
        <p className="text-xs text-muted">The discount is worked out by the server on the ride total (fare, fees and taxes) and can never take it below zero. Riders see it before they book, and it appears on their invoice.</p>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
      </form>
    </Modal>
  )
}

function Uses({ item, currency }: { item: CouponItem; currency: string }) {
  const [page, setPage] = usePage(item.id)
  const q = useCouponRedemptions(item.id, { page, pageSize: 8 })
  if (q.isLoading) return <Spinner />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const pages = Math.max(1, Math.ceil(q.data!.total / 8))
  return (
    <div className="mt-3 border-t border-line pt-3">
      <h4 className="mb-2 text-sm font-semibold">Uses ({q.data!.total})</h4>
      {q.data!.items.length === 0 ? <p className="text-xs text-muted">Nobody has used it yet.</p> : (
        <ul className="space-y-1 text-xs">
          {q.data!.items.map((r) => <li key={r.id} className="flex justify-between gap-2"><span>{fmtDateTime(r.at)} · ride {r.tripId} · {r.state === 'RELEASED' ? 'given back' : r.state === 'REDEEMED' ? 'used' : 'booked'}</span><span>{fmtMoney(r.discount, currency)}</span></li>)}
        </ul>
      )}
      {pages > 1 && <div className="mt-2 flex gap-2"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></div>}
    </div>
  )
}

export default function Coupons() {
  const user = useAuth((s) => s.session?.user)
  const canManage = can(user, 'pricing.manage')
  const [search, setSearch] = useState('')
  const [state, setState] = useState('')
  const [editing, setEditing] = useState<CouponItem | 'new' | null>(null)
  const [open, setOpen] = useState('')
  const q = useDebounced(search.trim())
  const [page, setPage] = usePage(JSON.stringify([q, state]))
  const list = useCoupons({ q, state, page, pageSize: PAGE_SIZE })
  const currency = list.data?.currency ?? 'INR'
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1

  return (
    <>
      <PageHeader title="Coupons" subtitle="Discount codes riders apply when they book. The server checks every rule and every limit." action={canManage ? <Button onClick={() => setEditing('new')}>New coupon</Button> : undefined} />
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-48 flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search by code" /></div>
          {([['', 'All'], ['LIVE', 'Live'], ['SCHEDULED', 'Scheduled'], ['EXPIRED', 'Expired'], ['OFF', 'Off']] as const).map(([k, l]) => <button key={k || 'all'} type="button" onClick={() => setState(k)} aria-pressed={state === k} className={`rounded-full border px-3 py-1 text-sm ${state === k ? 'border-brand bg-brand/15 font-medium' : 'border-line text-muted'}`}>{l}</button>)}
        </div>
      </Card>
      {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data!.items.length === 0 ? (
        <Card><EmptyState title={q || state ? 'No coupons match' : 'No coupons yet'} text={q || state ? 'Try another search or filter.' : 'Create one, for example WELCOME50: 50% off up to 100 on a rider\'s first ride.'} /></Card>
      ) : (
        <div className="space-y-3">
          {list.data!.items.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><div className="flex items-center gap-2 font-mono text-lg font-semibold">{c.code}<Badge kind={STATE[c.state].kind}>{STATE[c.state].label}</Badge></div>{(c.title || c.description) && <div className="text-xs text-muted">{c.title || c.description}</div>}</div>
                <div className="text-right text-sm font-semibold">{c.type === 'PERCENT' ? `${c.value}% off${c.maxDiscount > 0 ? ` (up to ${fmtMoney(c.maxDiscount, currency)})` : ''}` : `${fmtMoney(c.value, currency)} off`}</div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div><dt className="text-xs text-muted">Valid</dt><dd>{fmtDateTime(c.startsAt)} to {fmtDateTime(c.endsAt)}</dd></div>
                <div><dt className="text-xs text-muted">Used</dt><dd>{c.redeemed}{c.totalLimit > 0 ? ` of ${c.totalLimit}` : ''}</dd></div>
                <div><dt className="text-xs text-muted">Per rider</dt><dd>{c.perUserLimit > 0 ? c.perUserLimit : 'Unlimited'}</dd></div>
                <div><dt className="text-xs text-muted">Paid by</dt><dd>{c.fundedBy === 'BUSINESS' ? 'Business' : 'Driver'}</dd></div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                {canManage && <Button variant="ghost" onClick={() => setEditing(c)}>Edit</Button>}
                <Button variant="ghost" onClick={() => setOpen(open === c.id ? '' : c.id)}>{open === c.id ? 'Hide uses' : 'View uses'}</Button>
              </div>
              {open === c.id && <Uses item={c} currency={currency} />}
            </Card>
          ))}
          {pages > 1 && <div className="flex items-center justify-between text-sm"><span className="text-muted">Page {page} of {pages}</span><div className="flex gap-2"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></div></div>}
        </div>
      )}
      {editing && <Form item={editing === 'new' ? null : editing} currency={currency} onClose={() => setEditing(null)} />}
    </>
  )
}
