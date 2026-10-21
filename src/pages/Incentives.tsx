import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, ops } from '@/api'
import { useIncentives, useCategories } from '@/api/hooks'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { fmtDateTime, fmtMoney } from '@/lib/labels'
import type { IncentiveItem } from '@/lib/types'
import { useToast } from '@/components/feedback'
import Modal from '@/components/Modal'
import { Badge, Button, Card, EmptyState, ErrorState, Field, PageHeader, SelectField, Spinner } from '@/components/ui'

/** A date-time-local input value for a stored date. */
const toLocal = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }

function Form({ item, currency, onClose }: { item: IncentiveItem | null; currency: string; onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const cats = useCategories()
  const locked = !!item?.started
  const [soon] = useState(() => new Date(Date.now() + 3600_000))
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [target, setTarget] = useState(String(item?.targetTrips ?? ''))
  const [bonus, setBonus] = useState(String(item?.bonus ?? ''))
  const [startsAt, setStartsAt] = useState(toLocal(item?.startsAt ?? soon.toISOString()))
  const [endsAt, setEndsAt] = useState(toLocal(item?.endsAt ?? new Date(soon.getTime() + 7 * 86400_000).toISOString()))
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '')
  const [active, setActive] = useState(item?.active ?? true)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function save(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErrors({})
    const body = { name, description, targetTrips: Number(target), bonus: bonus === '' ? 0 : Number(bonus), startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), categoryId: categoryId || null, active }
    try {
      if (item) await ops.incentives.update(item.id, body)
      else await ops.incentives.create(body)
      await qc.invalidateQueries({ queryKey: ['biz'] })
      toast.success(item ? 'Saved' : 'Incentive created. Drivers see it in the Earnings screen of their app.')
      onClose()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
      else toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally { setBusy(false) }
  }

  return (
    <Modal title={item ? 'Edit incentive' : 'New incentive or goal'} onClose={onClose}>
      <form onSubmit={save} noValidate className="space-y-3">
        <Field label="Name" error={errors.name}>{(p) => <input {...p} value={name} maxLength={60} placeholder="Complete 50 trips this week" onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Short description (optional)" error={errors.description}>{(p) => <input {...p} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Trips to complete" error={errors.targetTrips} hint={locked ? 'Fixed once started' : undefined}>{(p) => <input {...p} inputMode="numeric" disabled={locked} value={target} onChange={(e) => setTarget(e.target.value)} />}</Field>
          <Field label={`Bonus (${currency})`} error={errors.bonus} hint={locked ? 'Fixed once started' : 'Leave 0 for a goal: drivers see their progress, nothing is paid'}>{(p) => <input {...p} inputMode="decimal" disabled={locked} value={bonus} onChange={(e) => setBonus(e.target.value)} />}</Field>
          <Field label="Starts" error={errors.startsAt}>{(p) => <input {...p} type="datetime-local" disabled={locked} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />}</Field>
          <Field label="Ends" error={errors.endsAt}>{(p) => <input {...p} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />}</Field>
        </div>
        <SelectField label="Counts trips of" value={categoryId} disabled={locked} error={errors.categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Every vehicle category</option>
          {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (drivers can see it)</label>
        <p className="text-xs text-muted">A bonus is credited once to each driver who reaches the target, as soon as their trip completes. Drivers can withdraw it like any other earnings.</p>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
      </form>
    </Modal>
  )
}

export default function Incentives() {
  const user = useAuth((s) => s.session?.user)
  const canManage = can(user, 'payments.manage')
  const list = useIncentives()
  const [editing, setEditing] = useState<IncentiveItem | 'new' | null>(null)
  const currency = list.data?.currency ?? 'INR'

  return (
    <>
      <PageHeader title="Incentives & goals" subtitle="Offers that reward your drivers for completing trips. A bonus is credited automatically; a goal shows progress only." action={canManage ? <Button onClick={() => setEditing('new')}>New incentive</Button> : undefined} />
      {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data!.items.length === 0 ? (
        <Card><EmptyState title="No incentives yet" text="Create one, for example 'Complete 30 trips this week and earn a bonus'. Drivers see it in the Earnings screen of the app." /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.data!.items.map((i) => (
            <Card key={i.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-semibold">{i.name}</div>{i.description && <div className="text-xs text-muted">{i.description}</div>}</div>
                <Badge kind={!i.active ? 'neutral' : i.ended ? 'neutral' : i.started ? 'ok' : 'warn'}>{!i.active ? 'Off' : i.ended ? 'Ended' : i.started ? 'Running' : 'Scheduled'}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-xs text-muted">Target</dt><dd>{i.targetTrips} trips</dd></div>
                <div><dt className="text-xs text-muted">Bonus</dt><dd>{i.goalOnly ? 'Goal only' : fmtMoney(i.bonus, currency)}</dd></div>
                <div><dt className="text-xs text-muted">Reached</dt><dd>{i.reached}{i.paid ? ` · paid ${fmtMoney(i.paid, currency)}` : ''}</dd></div>
              </dl>
              <div className="mt-2 text-xs text-muted">{fmtDateTime(i.startsAt)} to {fmtDateTime(i.endsAt)}</div>
              {canManage && <div className="mt-3"><Button variant="ghost" onClick={() => setEditing(i)}>Edit</Button></div>}
            </Card>
          ))}
        </div>
      )}
      {editing && <Form item={editing === 'new' ? null : editing} currency={currency} onClose={() => setEditing(null)} />}
    </>
  )
}
