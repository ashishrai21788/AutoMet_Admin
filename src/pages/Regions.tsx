import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { api } from '@/api'
import { useBusinessMutation, useGeo, useOverview, useRegions } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { citiesFor, countryName, currenciesFor, statesFor, timezonesFor, type GeoData } from '@/lib/geo'
import type { Business, Region } from '@/lib/types'
import DataTable, { SearchInput, type Column } from '@/components/DataTable'
import Modal from '@/components/Modal'
import SetupGuide from '@/components/SetupGuide'
import { useConfirm } from '@/components/feedback'
import { Badge, Button, Card, ErrorState, PageHeader, SelectField, Spinner, TextField } from '@/components/ui'

// ---------------- market (country, currency, time zone) ----------------

function MarketCard({ business, geo, locked, canEdit }: { business: Business; geo: GeoData; locked: { country: boolean; currency: boolean }; canEdit: boolean }) {
  const market = business.market
  const [editing, setEditing] = useState(!market)
  const [country, setCountry] = useState(market?.country ?? '')
  const [currency, setCurrency] = useState(market?.currency ?? '')
  const [timezone, setTimezone] = useState(market?.timezone ?? '')
  const save = useBusinessMutation(api.business.setMarket, { success: 'Country and currency saved', onSuccess: () => setEditing(false) })

  const currencies = useMemo(() => (country ? currenciesFor(geo, country) : []), [geo, country])
  const zones = useMemo(() => (country ? timezonesFor(geo, country) : []), [geo, country])

  function pickCountry(code: string) {
    setCountry(code)
    const cs = code ? currenciesFor(geo, code) : []
    const zs = code ? timezonesFor(geo, code) : []
    setCurrency(cs[0] ?? '')
    setTimezone(zs.length === 1 ? zs[0] : '')
    save.reset()
  }

  function submit(e: FormEvent) { e.preventDefault(); if (country && currency && timezone) save.mutate({ country, currency, timezone }) }
  const fe = save.fieldErrors

  if (market && !editing) {
    return (
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Operating market</h2>
            <dl className="mt-2 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted">Country</dt><dd className="font-medium">{countryName(geo, market.country)}</dd></div>
              <div><dt className="text-xs text-muted">Currency</dt><dd className="font-medium">{market.currency}</dd></div>
              <div><dt className="text-xs text-muted">Time zone</dt><dd className="font-medium">{market.timezone}</dd></div>
            </dl>
          </div>
          {canEdit && <Button variant="ghost" onClick={() => setEditing(true)}>Edit</Button>}
        </div>
      </Card>
    )
  }

  return (
    <Card className="mb-6 p-5">
      <h2 className="font-semibold">Operating market</h2>
      <p className="mb-4 text-sm text-muted">Choose where this business operates. The currency and time zone follow the country.</p>
      {!canEdit ? <p className="text-sm text-muted">Only a business admin can set the market.</p> : (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Country" required value={country} disabled={locked.country} onChange={(e) => pickCountry(e.target.value)} error={fe.country}
            hint={locked.country ? 'Locked while regions or pricing exist' : undefined}>
            <option value="">Select a country…</option>
            {geo.countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </SelectField>
          <SelectField label="Currency" required value={currency} disabled={!country || locked.currency} onChange={(e) => setCurrency(e.target.value)} error={fe.currency}
            hint={locked.currency ? 'Locked while pricing exists' : undefined}>
            <option value="">Select a currency…</option>
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </SelectField>
          <SelectField label="Time zone" required value={timezone} disabled={!country} onChange={(e) => setTimezone(e.target.value)} error={fe.timezone}>
            <option value="">Select a time zone…</option>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </SelectField>
          <div className="flex gap-2 sm:col-span-3">
            <Button type="submit" loading={save.isPending} disabled={!country || !currency || !timezone}>Save market</Button>
            {market && <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
          </div>
        </form>
      )}
    </Card>
  )
}

// ---------------- add regions ----------------

function AddRegionsModal({ country, geo, onClose }: { country: string; geo: GeoData; onClose: () => void }) {
  const states = useMemo(() => statesFor(geo, country), [geo, country])
  const [stateChoice, setStateChoice] = useState(states[0] ?? '__other')
  const [customState, setCustomState] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [filter, setFilter] = useState('')
  const [zoneName, setZoneName] = useState('')
  const [touched, setTouched] = useState(false)

  const state = stateChoice === '__other' ? customState.trim() : stateChoice
  const known = useMemo(() => (stateChoice === '__other' ? [] : citiesFor(geo, country, stateChoice)), [geo, country, stateChoice])
  const visible = known.filter((c) => c.toLowerCase().includes(filter.trim().toLowerCase()))

  const add = useBusinessMutation(api.business.addRegions, {
    success: (r) => `${r.created.length} region${r.created.length === 1 ? '' : 's'} added${r.skipped.length ? `, ${r.skipped.length} already existed` : ''}`,
    onSuccess: onClose,
  })

  const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))
  function addCustom() {
    const c = custom.trim()
    if (c && !picked.includes(c)) setPicked([...picked, c])
    setCustom('')
  }
  const local: Record<string, string> = {}
  if (!state) local.state = 'Choose or enter a state or province'
  if (picked.length === 0) local.cities = 'Select or add at least one city'
  const fe = { ...(touched ? local : {}), ...add.fieldErrors }

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(local).length === 0) add.mutate({ state, cities: picked, zoneName: zoneName.trim() })
  }

  return (
    <Modal title="Add service regions" wide onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="add-regions" loading={add.isPending}>Add {picked.length || ''} region{picked.length === 1 ? '' : 's'}</Button></>}>
      <form id="add-regions" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="State or province" value={stateChoice} onChange={(e) => { setStateChoice(e.target.value); setPicked([]); add.reset() }} error={fe.state}>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="__other">Other (type it)…</option>
          </SelectField>
          {stateChoice === '__other'
            ? <TextField label="State or province name" value={customState} onChange={(e) => setCustomState(e.target.value)} maxLength={80} />
            : <TextField label="Zone name (optional)" placeholder="All areas" value={zoneName} onChange={(e) => setZoneName(e.target.value)} maxLength={80} error={fe.zoneName} hint="For example Airport, Old town. Leave empty for the whole city." />}
        </div>
        {stateChoice === '__other' && <TextField label="Zone name (optional)" placeholder="All areas" value={zoneName} onChange={(e) => setZoneName(e.target.value)} maxLength={80} error={fe.zoneName} />}

        <div>
          <span className="mb-1 block text-xs font-medium text-muted">Cities</span>
          {known.length > 0 && (
            <>
              <input aria-label="Filter cities" placeholder="Filter cities" value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand" />
              <ul className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-3">
                {visible.map((c) => (
                  <li key={c}><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--brand)]" checked={picked.includes(c)} onChange={() => toggle(c)} />{c}</label></li>
                ))}
                {visible.length === 0 && <li className="col-span-full text-sm text-muted">No listed city matches. Add it below.</li>}
              </ul>
            </>
          )}
          <div className="mt-2 flex gap-2">
            <input aria-label="Add a city that is not listed" placeholder="Add a city not in the list" value={custom} maxLength={80}
              onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand" />
            <Button variant="ghost" onClick={addCustom} disabled={!custom.trim()}><Plus size={15} aria-hidden /> Add</Button>
          </div>
          {fe.cities && <p role="alert" className="mt-1 text-xs text-danger">{fe.cities}</p>}
          {picked.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Selected cities">
              {picked.map((c) => (
                <li key={c} className="inline-flex items-center gap-1 rounded-full bg-brand/15 py-1 pl-3 pr-1 text-xs">
                  {c}<button type="button" aria-label={`Remove ${c}`} onClick={() => toggle(c)} className="rounded-full p-0.5 hover:bg-black/10"><X size={13} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </form>
    </Modal>
  )
}

// ---------------- edit zone ----------------

function EditRegionModal({ region, onClose }: { region: Region; onClose: () => void }) {
  const [zoneName, setZoneName] = useState(region.zoneName)
  const save = useBusinessMutation((zone: string) => api.business.updateRegion(region.id, { zoneName: zone }), { success: 'Region updated', onSuccess: onClose })
  const local = zoneName.trim() ? '' : 'Zone name is required'
  return (
    <Modal title={`Edit ${region.city}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="edit-region" loading={save.isPending}>Save</Button></>}>
      <form id="edit-region" noValidate onSubmit={(e) => { e.preventDefault(); if (!local) save.mutate(zoneName.trim()) }}>
        <p className="mb-3 text-sm text-muted">{region.city}, {region.state}. The city and state cannot be changed; add a new region instead.</p>
        <TextField label="Zone name" value={zoneName} maxLength={80} onChange={(e) => { setZoneName(e.target.value); save.reset() }} error={save.fieldErrors.zoneName ?? (save.isIdle ? undefined : local)} />
      </form>
    </Modal>
  )
}

// ---------------- page ----------------

export default function Regions() {
  const { user } = useScope()
  const canEdit = can(user, 'settings.manage')
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const overview = useOverview()
  const regions = useRegions()
  const geoQuery = useGeo()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Region | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const toggleActive = useBusinessMutation((r: Region) => api.business.updateRegion(r.id, { active: !r.active }), { success: (r) => `${r.city} is now ${r.active ? 'active' : 'inactive'}` })

  // "?new=1" comes from the dashboard's quick action
  useEffect(() => {
    if (params.get('new') === '1' && overview.data?.business.market && canEdit) { setAdding(true); setParams({}, { replace: true }) }
  }, [params, overview.data, canEdit, setParams])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (regions.data ?? []).filter((r) =>
      (status === 'all' || (status === 'active') === r.active) &&
      (!term || [r.city, r.state, r.zoneName].some((v) => v.toLowerCase().includes(term))))
  }, [regions.data, search, status])

  async function onToggle(r: Region) {
    if (r.active) {
      const ok = await confirm({ title: `Deactivate ${r.city} (${r.zoneName})?`, message: 'Riders will not be served in this region until you activate it again. Existing categories and prices are kept.', confirmLabel: 'Deactivate', danger: true })
      if (!ok) return
    }
    toggleActive.mutate(r)
  }

  if (overview.isLoading || geoQuery.isLoading) return <Spinner />
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
  if (geoQuery.isError) return <ErrorState error={geoQuery.error} onRetry={() => geoQuery.refetch()} />
  const business = overview.data!.business
  const geo = geoQuery.data!
  const locked = { country: (regions.data?.length ?? 0) > 0 || overview.data!.counts.fareRules > 0, currency: overview.data!.counts.fareRules > 0 }

  const columns: Column<Region>[] = [
    { header: 'City', cell: (r) => <span className="font-medium">{r.city}</span> },
    { header: 'State / province', cell: (r) => r.state },
    { header: 'Zone', cell: (r) => r.zoneName },
    { header: 'Status', cell: (r) => <Badge kind={r.active ? 'ok' : 'neutral'}>{r.active ? 'Active' : 'Inactive'}</Badge> },
    ...(canEdit ? [{
      header: 'Actions', hideLabel: true, className: 'text-right',
      cell: (r: Region) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(r)}>Edit</Button>
          <Button variant={r.active ? 'danger' : 'ghost'} loading={toggleActive.isPending && toggleActive.variables?.id === r.id} onClick={() => onToggle(r)}>{r.active ? 'Deactivate' : 'Activate'}</Button>
        </div>
      ),
    } satisfies Column<Region>] : []),
  ]

  return (
    <>
      <PageHeader title="Regions" subtitle="Where this business operates. Choose the country first, then add the cities and zones you serve." />
      <SetupGuide />
      <MarketCard key={business.market ? 'set' : 'unset'} business={business} geo={geo} locked={locked} canEdit={canEdit} />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="min-w-[12rem] flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search regions" /></div>
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm">
            <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
          {canEdit && <Button disabled={!business.market} onClick={() => setAdding(true)}><Plus size={15} aria-hidden /> Add regions</Button>}
        </div>
        {regions.isLoading ? <Spinner /> : regions.isError ? <ErrorState error={regions.error} onRetry={() => regions.refetch()} /> : (
          <DataTable
            rows={rows} columns={columns} rowKey={(r) => r.id}
            empty={regions.data?.length
              ? { title: 'No region matches your filters' }
              : { title: 'No service regions yet', text: business.market ? 'Add the cities and zones where riders can book.' : 'Save the operating country above, then add your first region.', action: canEdit && business.market ? <Button onClick={() => setAdding(true)}>Add regions</Button> : undefined }}
          />
        )}
      </Card>

      {adding && business.market && <AddRegionsModal country={business.market.country} geo={geo} onClose={() => setAdding(false)} />}
      {editing && <EditRegionModal region={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
