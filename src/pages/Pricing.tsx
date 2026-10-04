import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { api, ApiError } from '@/api'
import { useBusinessMutation, useCategories, useFareRules, useOverview, usePolicies, useRegions } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { formatMoney } from '@/lib/geo'
import type { CancellationPolicy, Category, FarePreview, FareRule, FareRuleFields, PolicyFields, Region } from '@/lib/types'
import DataTable, { type Column } from '@/components/DataTable'
import SetupGuide from '@/components/SetupGuide'
import { useConfirm } from '@/components/feedback'
import { Alert, Button, Card, EmptyState, ErrorState, Field, PageHeader, Select, SelectField, Spinner, TextField, Textarea, Toggle } from '@/components/ui'

const DEFAULT = 'default'
const NO_REGIONS: Region[] = []

const blankRule: FareRuleFields = {
  baseFare: '', perKm: '', perMinute: '', minimumFare: '', bookingFee: '0', waitingFreeMinutes: '3', waitingPerMinute: '0',
  additionalCharges: [], taxes: [], surge: { enabled: false, maxMultiplier: '1.5' },
}
const blankPolicy: PolicyFields = {
  rider: { freeCancellationMinutes: '2', feeAfterWindow: '0', feeAfterDriverArrived: '0', noShowFee: '0' },
  driver: { penaltyFee: '0', graceCancellations: '0' },
  conditions: '',
}

const isNum = (v: unknown) => v !== '' && v !== null && Number.isFinite(Number(v))
const money = (v: unknown) => isNum(v) && Number(v) >= 0 && Number(v) <= 1_000_000

function validateRule(f: FareRuleFields): Record<string, string> {
  const e: Record<string, string> = {}
  const m = (k: 'baseFare' | 'perKm' | 'perMinute' | 'minimumFare' | 'bookingFee' | 'waitingPerMinute', label: string) => { if (!money(f[k])) e[k] = `${label} must be a number, 0 or more` }
  m('baseFare', 'Base fare'); m('perKm', 'Price per km'); m('perMinute', 'Price per minute'); m('minimumFare', 'Minimum fare'); m('bookingFee', 'Booking fee'); m('waitingPerMinute', 'Waiting charge')
  const w = Number(f.waitingFreeMinutes)
  if (!isNum(f.waitingFreeMinutes) || w < 0 || w > 120) e.waitingFreeMinutes = 'Enter 0 to 120 minutes'
  if (!e.baseFare && !e.perKm && !e.perMinute && !e.minimumFare && ['baseFare', 'perKm', 'perMinute', 'minimumFare'].every((k) => Number(f[k as keyof FareRuleFields]) === 0)) e.baseFare = 'Set a base fare, a distance or time rate, or a minimum fare'
  f.additionalCharges.forEach((c, i) => {
    if (!c.name.trim()) e[`additionalCharges.${i}.name`] = 'Name is required'
    if (!money(c.amount) || (c.type === 'percent_of_fare' && Number(c.amount) > 100)) e[`additionalCharges.${i}.amount`] = c.type === 'percent_of_fare' ? '0 to 100' : '0 or more'
  })
  f.taxes.forEach((t, i) => {
    if (!t.name.trim()) e[`taxes.${i}.name`] = 'Name is required'
    if (!isNum(t.ratePercent) || Number(t.ratePercent) < 0 || Number(t.ratePercent) > 100) e[`taxes.${i}.ratePercent`] = '0 to 100'
  })
  if (f.surge.enabled && (!isNum(f.surge.maxMultiplier) || Number(f.surge.maxMultiplier) < 1 || Number(f.surge.maxMultiplier) > 10)) e['surge.maxMultiplier'] = '1 to 10'
  return e
}

function validatePolicy(p: PolicyFields): Record<string, string> {
  const e: Record<string, string> = {}
  const count = (path: string, v: unknown, max: number) => { if (!isNum(v) || !Number.isInteger(Number(v)) || Number(v) < 0 || Number(v) > max) e[path] = `Whole number, 0 to ${max}` }
  const cash = (path: string, v: unknown) => { if (!money(v)) e[path] = '0 or more' }
  count('rider.freeCancellationMinutes', p.rider.freeCancellationMinutes, 60)
  cash('rider.feeAfterWindow', p.rider.feeAfterWindow); cash('rider.feeAfterDriverArrived', p.rider.feeAfterDriverArrived); cash('rider.noShowFee', p.rider.noShowFee)
  cash('driver.penaltyFee', p.driver.penaltyFee); count('driver.graceCancellations', p.driver.graceCancellations, 50)
  return e
}

const toFields = (r: FareRule): FareRuleFields => ({
  baseFare: r.baseFare, perKm: r.perKm, perMinute: r.perMinute, minimumFare: r.minimumFare, bookingFee: r.bookingFee,
  waitingFreeMinutes: r.waitingFreeMinutes, waitingPerMinute: r.waitingPerMinute,
  additionalCharges: r.additionalCharges.map((c) => ({ ...c })), taxes: r.taxes.map((t) => ({ ...t })), surge: { ...r.surge },
})
const toPolicyFields = (p: CancellationPolicy): PolicyFields => ({ rider: { ...p.rider }, driver: { ...p.driver }, conditions: p.conditions })

const regionName = (r: Region | undefined) => (r ? `${r.city}${r.zoneName !== 'All areas' ? ` (${r.zoneName})` : ''}` : 'Unknown region')

// ---------------- live preview ----------------

function PreviewPanel({ rule, errors, currency }: { rule: FareRuleFields; errors: Record<string, string>; currency: string }) {
  const [trip, setTrip] = useState({ distanceKm: '10', durationMin: '20', waitingMin: '0', surgeMultiplier: '1', discount: '0' })
  const [preview, setPreview] = useState<FarePreview | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const invalid = Object.keys(errors).length > 0
  const ruleKey = JSON.stringify(rule)
  const tripKey = JSON.stringify(trip)

  useEffect(() => {
    if (invalid) { setPreview(null); return }
    let cancelled = false
    const t = window.setTimeout(async () => {
      try {
        const result = await api.business.previewFare(JSON.parse(ruleKey), JSON.parse(tripKey))
        if (!cancelled) { setPreview(result); setProblem(null) }
      } catch (e) {
        if (cancelled) return
        setPreview(null)
        setProblem(e instanceof ApiError ? (Object.values(e.fieldErrors)[0] ?? e.message) : 'Could not calculate the preview')
      }
    }, 350)
    return () => { cancelled = true; window.clearTimeout(t) }
  }, [invalid, ruleKey, tripKey])

  const set = (k: keyof typeof trip) => (e: { target: { value: string } }) => setTrip({ ...trip, [k]: e.target.value })
  const line = (label: string, amount: number, strong = false) => (
    <div className={`flex justify-between gap-3 py-1 ${strong ? 'border-t border-line pt-2 font-semibold' : ''}`}><span>{label}</span><span className="tabular-nums">{formatMoney(amount, currency)}</span></div>
  )

  return (
    <Card className="p-5 lg:sticky lg:top-4">
      <h2 className="font-semibold">Fare estimate preview</h2>
      <p className="mt-1 text-xs text-muted">Estimated fare = Base fare + Distance charge + Time charge + Applicable fees + Taxes − Discounts. The minimum fare applies to the ride charge; each tax is applied once.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <TextField label="Distance (km)" type="number" min={0} value={trip.distanceKm} onChange={set('distanceKm')} />
        <TextField label="Duration (min)" type="number" min={0} value={trip.durationMin} onChange={set('durationMin')} />
        <TextField label="Waiting (min)" type="number" min={0} value={trip.waitingMin} onChange={set('waitingMin')} />
        <TextField label="Surge multiplier" type="number" min={1} step={0.1} value={trip.surgeMultiplier} onChange={set('surgeMultiplier')} hint={rule.surge.enabled ? undefined : 'Surge is off'} />
        <TextField label="Discount" type="number" min={0} value={trip.discount} onChange={set('discount')} className="col-span-2" />
      </div>
      <div className="mt-4 rounded-lg bg-black/[.03] p-3 text-sm dark:bg-white/5" aria-live="polite">
        {invalid ? <p className="text-muted">Complete the highlighted fields to see the estimate.</p>
          : problem ? <p role="alert" className="text-danger">{problem}</p>
          : !preview ? <p className="text-muted">Calculating…</p> : (
            <>
              {preview.lines.map((l) => line(l.label, l.amount))}
              {line('Ride charge', preview.fare, true)}
              {preview.fees.map((l) => line(l.label, l.amount))}
              {preview.taxes.map((l) => line(l.label, l.amount))}
              {preview.discount > 0 && line('Discount', -preview.discount)}
              {line('Estimated total', preview.total, true)}
            </>
          )}
      </div>
    </Card>
  )
}

// ---------------- fare rule form ----------------

function FareRuleForm({ category, regionId, existing, currency, canEdit, form, setForm }: { category: Category; regionId: string | null; existing?: FareRule; currency: string; canEdit: boolean; form: FareRuleFields; setForm: (f: FareRuleFields) => void }) {
  const [touched, setTouched] = useState(false)
  const save = useBusinessMutation((input: FareRuleFields) => api.business.saveFareRule({ ...input, categoryId: category.id, regionId }), { success: 'Fare rule saved' })
  const local = validateRule(form)
  const fe = { ...(touched ? local : {}), ...save.fieldErrors }
  const change = (next: FareRuleFields) => { setForm(next); save.reset() }
  const num = (k: 'baseFare' | 'perKm' | 'perMinute' | 'minimumFare' | 'bookingFee' | 'waitingFreeMinutes' | 'waitingPerMinute') => ({ value: form[k], onChange: (e: { target: { value: string } }) => change({ ...form, [k]: e.target.value }), error: fe[k] })

  function submit(e: FormEvent) { e.preventDefault(); setTouched(true); if (Object.keys(local).length === 0) save.mutate(form) }

  return (
      <Card className="p-5">
        <form id="fare-form" onSubmit={submit} noValidate className="space-y-6">
          <div>
            <h2 className="font-semibold">Fare rule</h2>
            <p className="text-sm text-muted">Amounts are in <strong>{currency}</strong> (set by the operating country).</p>
          </div>
          <fieldset disabled={!canEdit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              <TextField label={`Base fare (${currency})`} type="number" inputMode="decimal" min={0} step="any" {...num('baseFare')} />
              <TextField label={`Price per km (${currency})`} type="number" inputMode="decimal" min={0} step="any" {...num('perKm')} />
              <TextField label={`Price per minute (${currency})`} type="number" inputMode="decimal" min={0} step="any" {...num('perMinute')} />
              <TextField label={`Minimum fare (${currency})`} type="number" inputMode="decimal" min={0} step="any" {...num('minimumFare')} hint="The ride charge is never below this" />
              <TextField label={`Booking / platform fee (${currency})`} type="number" inputMode="decimal" min={0} step="any" {...num('bookingFee')} hint="A fixed fee added to every ride" />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Waiting charges</h3>
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                <TextField label="Free waiting (minutes)" type="number" min={0} max={120} step={1} {...num('waitingFreeMinutes')} />
                <TextField label={`Charge per extra minute (${currency})`} type="number" inputMode="decimal" min={0} step="any" {...num('waitingPerMinute')} />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-medium">Additional charges</h3>
                <Button variant="ghost" disabled={form.additionalCharges.length >= 10} onClick={() => change({ ...form, additionalCharges: [...form.additionalCharges, { name: '', type: 'fixed', amount: '' }] })}><Plus size={14} aria-hidden /> Add charge</Button></div>
              {form.additionalCharges.length === 0 && <p className="text-sm text-muted">None. Use this for things like tolls handling or a night surcharge.</p>}
              <div className="space-y-3">
                {form.additionalCharges.map((c, i) => (
                  <div key={i} className="grid items-start gap-3 sm:grid-cols-[1fr_11rem_8rem_auto]">
                    <TextField label="Name" value={c.name} maxLength={60} error={fe[`additionalCharges.${i}.name`]} onChange={(e) => change({ ...form, additionalCharges: form.additionalCharges.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                    <SelectField label="Type" value={c.type} onChange={(e) => change({ ...form, additionalCharges: form.additionalCharges.map((x, j) => (j === i ? { ...x, type: e.target.value as typeof c.type } : x)) })}>
                      <option value="fixed">Fixed amount</option><option value="percent_of_fare">% of ride charge</option>
                    </SelectField>
                    <TextField label={c.type === 'fixed' ? 'Amount' : 'Percent'} type="number" min={0} step="any" value={c.amount} error={fe[`additionalCharges.${i}.amount`]} onChange={(e) => change({ ...form, additionalCharges: form.additionalCharges.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)) })} />
                    <Button variant="ghost" aria-label={`Remove charge ${c.name || i + 1}`} className="mt-5" onClick={() => change({ ...form, additionalCharges: form.additionalCharges.filter((_, j) => j !== i) })}><Trash2 size={15} /></Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-medium">Taxes</h3>
                <Button variant="ghost" disabled={form.taxes.length >= 5} onClick={() => change({ ...form, taxes: [...form.taxes, { name: '', ratePercent: '', appliesTo: 'fare_and_fees' }] })}><Plus size={14} aria-hidden /> Add tax</Button></div>
              {form.taxes.length === 0 && <p className="text-sm text-muted">No taxes. Add the taxes that apply in this market, for example VAT, GST or a city tax.</p>}
              <div className="space-y-3">
                {form.taxes.map((t, i) => (
                  <div key={i} className="grid items-start gap-3 sm:grid-cols-[1fr_8rem_12rem_auto]">
                    <TextField label="Tax name" value={t.name} maxLength={40} error={fe[`taxes.${i}.name`]} onChange={(e) => change({ ...form, taxes: form.taxes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                    <TextField label="Rate (%)" type="number" min={0} max={100} step="any" value={t.ratePercent} error={fe[`taxes.${i}.ratePercent`]} onChange={(e) => change({ ...form, taxes: form.taxes.map((x, j) => (j === i ? { ...x, ratePercent: e.target.value } : x)) })} />
                    <SelectField label="Applies to" value={t.appliesTo} onChange={(e) => change({ ...form, taxes: form.taxes.map((x, j) => (j === i ? { ...x, appliesTo: e.target.value as typeof t.appliesTo } : x)) })}>
                      <option value="fare_and_fees">Ride charge + fees</option><option value="fare">Ride charge only</option>
                    </SelectField>
                    <Button variant="ghost" aria-label={`Remove tax ${t.name || i + 1}`} className="mt-5" onClick={() => change({ ...form, taxes: form.taxes.filter((_, j) => j !== i) })}><Trash2 size={15} /></Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Surge pricing</h3>
              <div className="flex flex-wrap items-start gap-4">
                <Toggle label="Allow surge pricing" checked={form.surge.enabled} onChange={(v) => change({ ...form, surge: { ...form.surge, enabled: v } })} />
                {form.surge.enabled && <TextField label="Maximum multiplier" type="number" min={1} max={10} step={0.1} value={form.surge.maxMultiplier} error={fe['surge.maxMultiplier']} onChange={(e) => change({ ...form, surge: { ...form.surge, maxMultiplier: e.target.value } })} hint="Check your local regulations for the legal cap" />}
              </div>
              <p className="mt-1 text-xs text-muted">The cap is stored with the rule. Automatic surge based on demand is not available yet.</p>
            </div>
          </fieldset>
          {canEdit ? <Button type="submit" loading={save.isPending}>{existing ? 'Save changes' : 'Save fare rule'}</Button> : <p className="text-sm text-muted">Your role can view pricing but not change it.</p>}
        </form>
      </Card>
  )
}

// ---------------- cancellation policy ----------------

function PolicyForm({ category, regionId, existing, currency, canEdit }: { category: Category; regionId: string | null; existing?: CancellationPolicy; currency: string; canEdit: boolean }) {
  const confirm = useConfirm()
  const [form, setForm] = useState<PolicyFields>(existing ? toPolicyFields(existing) : blankPolicy)
  const [touched, setTouched] = useState(false)
  const save = useBusinessMutation((input: PolicyFields) => api.business.savePolicy({ ...input, categoryId: category.id, regionId }), { success: 'Cancellation policy saved' })
  const remove = useBusinessMutation((id: string) => api.business.deletePolicy(id), { success: 'Cancellation policy removed' })
  const local = validatePolicy(form)
  const fe = { ...(touched ? local : {}), ...save.fieldErrors }
  const setRider = (k: keyof PolicyFields['rider']) => ({ value: form.rider[k], error: fe[`rider.${k}`], onChange: (e: { target: { value: string } }) => { setForm({ ...form, rider: { ...form.rider, [k]: e.target.value } }); save.reset() } })
  const setDriver = (k: keyof PolicyFields['driver']) => ({ value: form.driver[k], error: fe[`driver.${k}`], onChange: (e: { target: { value: string } }) => { setForm({ ...form, driver: { ...form.driver, [k]: e.target.value } }); save.reset() } })

  function submit(e: FormEvent) { e.preventDefault(); setTouched(true); if (Object.keys(local).length === 0) save.mutate(form) }
  async function onRemove() {
    if (!existing) return
    if (await confirm({ title: 'Remove this cancellation policy?', message: 'Cancellations in this scope will have no fee configured.', confirmLabel: 'Remove', danger: true })) remove.mutate(existing.id)
  }

  return (
    <Card className="p-5">
      <form onSubmit={submit} noValidate className="space-y-5">
        <div>
          <h2 className="font-semibold">Cancellation policy</h2>
          <p className="text-sm text-muted">Cancellation fees are separate from the booking fee in the fare rule. Rider and driver cancellations are configured separately. Amounts are in <strong>{currency}</strong>.</p>
        </div>
        <fieldset disabled={!canEdit} className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-medium">Rider cancels</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Free window after driver accepts (min)" type="number" min={0} max={60} step={1} {...setRider('freeCancellationMinutes')} />
              <TextField label="Fee after the free window" type="number" min={0} step="any" {...setRider('feeAfterWindow')} />
              <TextField label="Fee after driver arrived" type="number" min={0} step="any" {...setRider('feeAfterDriverArrived')} />
              <TextField label="No-show fee" type="number" min={0} step="any" {...setRider('noShowFee')} />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Driver cancels</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Driver penalty" type="number" min={0} step="any" {...setDriver('penaltyFee')} />
              <TextField label="Free cancellations per day" type="number" min={0} max={50} step={1} {...setDriver('graceCancellations')} />
            </div>
          </div>
          <Field label="Conditions (optional)" error={fe.conditions} hint="Plain-language rules, for example when the fee is waived.">
            {(p) => <Textarea {...p} rows={2} maxLength={500} value={form.conditions} onChange={(e) => { setForm({ ...form, conditions: e.target.value }); save.reset() }} />}
          </Field>
        </fieldset>
        {canEdit && (
          <div className="flex gap-2">
            <Button type="submit" loading={save.isPending}>{existing ? 'Save policy' : 'Save cancellation policy'}</Button>
            {existing && <Button variant="danger" loading={remove.isPending} onClick={onRemove}>Remove</Button>}
          </div>
        )}
      </form>
    </Card>
  )
}

// ---------------- page ----------------

export default function Pricing() {
  const { user } = useScope()
  const canEdit = can(user, 'pricing.manage')
  const confirm = useConfirm()
  const overview = useOverview()
  const categories = useCategories()
  const regions = useRegions()
  const rules = useFareRules()
  const policies = usePolicies()
  const [categoryId, setCategoryId] = useState('')
  const [scope, setScope] = useState(DEFAULT)
  const complete = useBusinessMutation(api.business.completeSetup, { success: 'Setup confirmed' })
  const remove = useBusinessMutation((id: string) => api.business.deleteFareRule(id), { success: 'Fare rule removed' })

  const active = useMemo(() => (categories.data ?? []).filter((c) => c.active), [categories.data])
  const category = active.find((c) => c.id === categoryId) ?? active[0]
  const regionList = regions.data ?? NO_REGIONS
  const scopes = useMemo(() => category ? category.regionIds.map((id) => regionList.find((r) => r.id === id)).filter((r): r is Region => !!r && r.active) : [], [category, regionList])
  useEffect(() => { if (category && categoryId !== category.id) setCategoryId(category.id) }, [category, categoryId])
  useEffect(() => { if (scope !== DEFAULT && !scopes.some((r) => r.id === scope)) setScope(DEFAULT) }, [scope, scopes])

  const regionId = scope === DEFAULT ? null : scope
  const rule = category ? rules.data?.find((r) => r.categoryId === category.id && r.regionId === regionId) : undefined
  const policy = category ? policies.data?.find((p) => p.categoryId === category.id && p.regionId === regionId) : undefined
  const market = overview.data?.business.market ?? null
  const currency = market?.currency ?? ''
  const formKey = `${category?.id}|${scope}|${rule?.id ?? 'new'}`
  const policyKey = `${category?.id}|${scope}|${policy?.id ?? 'new'}`

  // The page owns the fare form's values so the preview beside it always shows what is being typed. The draft is tied
  // to the selection it was typed for; choosing another category or region starts from that rule's saved values.
  const [draft, setDraft] = useState<{ key: string; fields: FareRuleFields } | null>(null)
  const form = draft && draft.key === formKey ? draft.fields : rule ? toFields(rule) : blankRule
  const setForm = (fields: FareRuleFields) => setDraft({ key: formKey, fields })

  const nameOf = (id: string) => categories.data?.find((c) => c.id === id)?.name ?? 'Unknown'
  const scopeOf = (id: string | null) => (id === null ? 'All regions (default)' : regionName(regionList.find((r) => r.id === id)))

  const ruleColumns: Column<FareRule>[] = [
    { header: 'Category', cell: (r) => <span className="font-medium">{nameOf(r.categoryId)}</span> },
    { header: 'Applies to', cell: (r) => scopeOf(r.regionId) },
    { header: 'Base', cell: (r) => formatMoney(Number(r.baseFare), r.currency) },
    { header: 'Per km', cell: (r) => formatMoney(Number(r.perKm), r.currency) },
    { header: 'Per min', cell: (r) => formatMoney(Number(r.perMinute), r.currency) },
    { header: 'Minimum', cell: (r) => formatMoney(Number(r.minimumFare), r.currency) },
    { header: 'Actions', hideLabel: true, className: 'text-right', cell: (r) => (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => { setCategoryId(r.categoryId); setScope(r.regionId ?? DEFAULT); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{canEdit ? 'Edit' : 'View'}</Button>
        {canEdit && <Button variant="danger" onClick={async () => { if (await confirm({ title: 'Remove this fare rule?', message: `${nameOf(r.categoryId)} · ${scopeOf(r.regionId)} will have no price until you add a rule again.`, confirmLabel: 'Remove', danger: true })) remove.mutate(r.id) }}>Remove</Button>}
      </div>
    ) },
  ]

  if (overview.isLoading || categories.isLoading || regions.isLoading) return <Spinner />
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
  const setup = overview.data!.setup

  return (
    <>
      <PageHeader title="Pricing & Fare Rules" subtitle="Set how each vehicle category is priced, with optional overrides for individual regions." />
      <SetupGuide />
      <div className="mb-6"><Alert kind="info">Rules saved here are stored for this business. The rider app will quote them once pricing is connected to bookings; live fares do not use them yet.</Alert></div>

      {setup.ready && !setup.complete && canEdit && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 border-ok/50 p-4">
          <div><p className="font-medium">Steps 1 to 3 are done</p><p className="text-sm text-muted">Confirm to mark the initial setup as complete. You can still change anything later.</p></div>
          <Button loading={complete.isPending} onClick={() => complete.mutate(undefined)}>Confirm setup</Button>
        </Card>
      )}

      {!market ? (
        <Card><EmptyState title="Choose the operating country first" text="Prices use the currency of your operating country." action={<Link to="/regions"><Button>Go to Regions</Button></Link>} /></Card>
      ) : active.length === 0 ? (
        <Card><EmptyState title="Create a vehicle category first" text="Pricing is set per vehicle category." action={<Link to="/categories"><Button>Go to Vehicle Categories</Button></Link>} /></Card>
      ) : (
        <>
          <Card className="mb-6 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vehicle category">{(p) => <Select {...p} value={category?.id ?? ''} onChange={(e) => { setCategoryId(e.target.value); setScope(DEFAULT) }}>{active.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
              <Field label="Applies to" hint="Region prices override the default for that region only.">
                {(p) => <Select {...p} value={scope} onChange={(e) => setScope(e.target.value)}>
                  <option value={DEFAULT}>All regions (default)</option>
                  {scopes.map((r) => <option key={r.id} value={r.id}>{regionName(r)} only</option>)}
                </Select>}
              </Field>
            </div>
            <p className="mt-3 text-xs text-muted">{rule ? 'Editing the saved rule.' : 'No rule saved for this selection yet.'}{regionId === null ? '' : ' This overrides the default price for the selected region.'}</p>
          </Card>

          {category && (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="lg:col-start-1 lg:row-start-1"><FareRuleForm key={formKey} category={category} regionId={regionId} existing={rule} currency={currency} canEdit={canEdit} form={form} setForm={setForm} /></div>
              <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1"><PreviewPanel rule={form} errors={validateRule(form)} currency={currency} /></div>
              <div className="lg:col-start-1 lg:row-start-2"><PolicyForm key={policyKey} category={category} regionId={regionId} existing={policy} currency={currency} canEdit={canEdit} /></div>
            </div>
          )}

          <Card className="mt-6">
            <div className="border-b border-line p-4"><h2 className="font-semibold">Configured fare rules</h2></div>
            {rules.isLoading ? <Spinner /> : rules.isError ? <ErrorState error={rules.error} onRetry={() => rules.refetch()} /> : (
              <DataTable rows={rules.data ?? []} columns={ruleColumns} rowKey={(r) => r.id} empty={{ title: 'No fare rules yet', text: 'Fill in the form above and save your first rule.' }} />
            )}
          </Card>
        </>
      )}
    </>
  )
}
