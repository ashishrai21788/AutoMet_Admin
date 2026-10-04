import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bike, Bus, Car, CarFront, Crown, Plus, Truck, TramFront, Zap } from 'lucide-react'
import { api } from '@/api'
import { useBusinessMutation, useCategories, useOverview, useRegions } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { ICON_KEYS, RIDE_TYPES, type Category, type CategoryInput, type IconKey, type Region } from '@/lib/types'
import DataTable, { SearchInput, type Column } from '@/components/DataTable'
import Modal from '@/components/Modal'
import SetupGuide from '@/components/SetupGuide'
import { useConfirm } from '@/components/feedback'
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, SelectField, Spinner, TextField, Textarea, Field } from '@/components/ui'

const ICONS: Record<IconKey, typeof Car> = { car: Car, suv: Truck, hatchback: CarFront, premium: Crown, auto: TramFront, bike: Bike, electric: Zap, van: Bus }
const rideTypeLabel = (v: string) => RIDE_TYPES.find((t) => t.value === v)?.label ?? v

export function CategoryIcon({ icon, size = 18 }: { icon: IconKey; size?: number }) {
  const I = ICONS[icon] ?? Car
  return <I size={size} aria-hidden />
}

const blank: CategoryInput = { name: '', description: '', icon: 'car', imageUrl: '', passengerCapacity: 4, luggageCapacity: '', rideType: 'economy', regionIds: [] }

function validate(f: CategoryInput): Record<string, string> {
  const e: Record<string, string> = {}
  const name = f.name.trim()
  if (name.length < 2 || name.length > 40) e.name = 'Name is required (2 to 40 characters)'
  const pc = Number(f.passengerCapacity)
  if (!Number.isInteger(pc) || pc < 1 || pc > 20) e.passengerCapacity = 'Enter a whole number from 1 to 20'
  if (f.luggageCapacity !== '' && f.luggageCapacity !== null) {
    const lc = Number(f.luggageCapacity)
    if (!Number.isInteger(lc) || lc < 0 || lc > 20) e.luggageCapacity = 'Enter a whole number from 0 to 20, or leave empty'
  }
  if (f.imageUrl.trim() && !/^https:\/\/\S+$/i.test(f.imageUrl.trim())) e.imageUrl = 'The link must start with https://'
  if (f.regionIds.length === 0) e.regionIds = 'Choose at least one region where this category is available'
  return e
}

function CategoryModal({ category, regions, onClose }: { category: Category | null; regions: Region[]; onClose: () => void }) {
  const [form, setForm] = useState<CategoryInput>(category ? {
    name: category.name, description: category.description, icon: category.icon, imageUrl: category.imageUrl,
    passengerCapacity: category.passengerCapacity, luggageCapacity: category.luggageCapacity ?? '', rideType: category.rideType, regionIds: category.regionIds,
  } : blank)
  const [touched, setTouched] = useState(false)
  const save = useBusinessMutation(
    (input: CategoryInput) => category ? api.business.updateCategory(category.id, input) : api.business.createCategory(input),
    { success: category ? 'Category updated' : 'Category created', onSuccess: onClose },
  )
  const local = validate(form)
  const fe = { ...(touched ? local : {}), ...save.fieldErrors }
  const set = <K extends keyof CategoryInput>(k: K, v: CategoryInput[K]) => { setForm((f) => ({ ...f, [k]: v })); save.reset() }
  const toggleRegion = (id: string) => { setForm((f) => ({ ...f, regionIds: f.regionIds.includes(id) ? f.regionIds.filter((r) => r !== id) : [...f.regionIds, id] })); save.reset() }

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(local).length === 0) save.mutate({ ...form, name: form.name.trim(), description: form.description.trim(), imageUrl: form.imageUrl.trim() })
  }

  return (
    <Modal title={category ? `Edit ${category.name}` : 'Add vehicle category'} wide onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="category-form" loading={save.isPending}>{category ? 'Save changes' : 'Create category'}</Button></>}>
      <form id="category-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextField label="Category name" required maxLength={40} value={form.name} onChange={(e) => set('name', e.target.value)} error={fe.name} placeholder="Sedan, SUV, Bike, Auto-rickshaw…" />
        <SelectField label="Ride type" value={form.rideType} onChange={(e) => set('rideType', e.target.value)} error={fe.rideType}>
          {RIDE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </SelectField>
        <TextField label="Passenger capacity" type="number" min={1} max={20} step={1} required value={form.passengerCapacity} onChange={(e) => set('passengerCapacity', e.target.value)} error={fe.passengerCapacity} />
        <TextField label="Luggage capacity (optional)" type="number" min={0} max={20} step={1} value={form.luggageCapacity ?? ''} onChange={(e) => set('luggageCapacity', e.target.value)} error={fe.luggageCapacity} hint="Number of bags" />
        <Field label="Description (optional)" className="sm:col-span-2" error={fe.description}>
          {(p) => <Textarea {...p} rows={2} maxLength={300} value={form.description} onChange={(e) => set('description', e.target.value)} />}
        </Field>

        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-xs font-medium text-muted">Icon</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Icon">
            {ICON_KEYS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={form.icon === k} aria-label={k} title={k} onClick={() => set('icon', k)}
                className={`grid h-11 w-11 place-items-center rounded-lg border ${form.icon === k ? 'border-brand bg-brand/15' : 'border-line hover:bg-black/5 dark:hover:bg-white/5'}`}>
                <CategoryIcon icon={k} size={20} />
              </button>
            ))}
          </div>
        </fieldset>
        <TextField label="Image link (optional)" className="sm:col-span-2" type="url" placeholder="https://…" value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} error={fe.imageUrl} hint="A picture shown instead of the icon, if you have one." />

        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-xs font-medium text-muted">Available in these regions</legend>
          {regions.length === 0 ? <p className="text-sm text-muted">There are no regions yet. <Link to="/regions" className="underline">Add a region</Link> first.</p> : (
            <ul className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-2">
              {regions.map((r) => {
                const selected = form.regionIds.includes(r.id)
                return (
                  <li key={r.id}>
                    <label className={`flex items-center gap-2 text-sm ${!r.active && !selected ? 'opacity-50' : ''}`}>
                      <input type="checkbox" className="accent-[var(--brand)]" checked={selected} disabled={!r.active && !selected} onChange={() => toggleRegion(r.id)} />
                      {r.city} <span className="text-muted">({r.zoneName}){!r.active && ' · inactive'}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
          {fe.regionIds && <p role="alert" className="mt-1 text-xs text-danger">{fe.regionIds}</p>}
        </fieldset>
      </form>
    </Modal>
  )
}

export default function Categories() {
  const { user } = useScope()
  const canEdit = can(user, 'settings.manage')
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const overview = useOverview()
  const categories = useCategories()
  const regions = useRegions()
  const [modal, setModal] = useState<Category | 'new' | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const toggle = useBusinessMutation((c: Category) => api.business.updateCategory(c.id, { active: !c.active }), { success: (c) => `${c.name} is now ${c.active ? 'active' : 'inactive'}` })

  const regionList = regions.data ?? []
  const hasRegions = regionList.some((r) => r.active)
  useEffect(() => {
    if (params.get('new') === '1' && canEdit && regions.data) { setModal('new'); setParams({}, { replace: true }) }
  }, [params, canEdit, regions.data, setParams])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (categories.data ?? []).filter((c) =>
      (status === 'all' || (status === 'active') === c.active) &&
      (!term || [c.name, c.description, rideTypeLabel(c.rideType)].some((v) => v.toLowerCase().includes(term))))
  }, [categories.data, search, status])

  async function onToggle(c: Category) {
    if (c.active) {
      const ok = await confirm({ title: `Deactivate ${c.name}?`, message: 'Riders will no longer see this category. Its prices are kept, and you can activate it again at any time.', confirmLabel: 'Deactivate', danger: true })
      if (!ok) return
    }
    toggle.mutate(c)
  }

  const regionLabel = (c: Category) => c.regionIds.map((id) => regionList.find((r) => r.id === id)).filter(Boolean).map((r) => `${r!.city}${r!.zoneName !== 'All areas' ? ` (${r!.zoneName})` : ''}`)

  const columns: Column<Category>[] = [
    { header: 'Category', cell: (c) => <span className="inline-flex items-center gap-2 font-medium"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15"><CategoryIcon icon={c.icon} /></span><span>{c.name}{c.description && <span className="block max-w-xs truncate text-xs font-normal text-muted">{c.description}</span>}</span></span> },
    { header: 'Ride type', cell: (c) => rideTypeLabel(c.rideType) },
    { header: 'Capacity', cell: (c) => `${c.passengerCapacity} passenger${c.passengerCapacity === 1 ? '' : 's'}${c.luggageCapacity != null ? `, ${c.luggageCapacity} bag${c.luggageCapacity === 1 ? '' : 's'}` : ''}` },
    { header: 'Regions', cell: (c) => { const l = regionLabel(c); return <span title={l.join(', ')}>{l.length ? (l.length > 2 ? `${l.slice(0, 2).join(', ')} +${l.length - 2}` : l.join(', ')) : '—'}</span> } },
    { header: 'Status', cell: (c) => <Badge kind={c.active ? 'ok' : 'neutral'}>{c.active ? 'Active' : 'Inactive'}</Badge> },
    ...(canEdit ? [{
      header: 'Actions', hideLabel: true, className: 'text-right',
      cell: (c: Category) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModal(c)}>Edit</Button>
          <Button variant={c.active ? 'danger' : 'ghost'} loading={toggle.isPending && toggle.variables?.id === c.id} onClick={() => onToggle(c)}>{c.active ? 'Deactivate' : 'Activate'}</Button>
        </div>
      ),
    } satisfies Column<Category>] : []),
  ]

  if (overview.isLoading) return <Spinner />
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />

  return (
    <>
      <PageHeader title="Vehicle Categories" subtitle="The kinds of vehicles riders can book. Each category can be offered in some regions and not others." />
      <SetupGuide />

      {!hasRegions && !regions.isLoading && (
        <Card className="mb-6"><EmptyState title="Add a region first" text="Categories are offered in specific regions, so at least one active region is needed." action={<Link to="/regions"><Button>Go to Regions</Button></Link>} /></Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="min-w-[12rem] flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search categories" /></div>
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm">
            <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
          {canEdit && <Button disabled={!hasRegions} onClick={() => setModal('new')}><Plus size={15} aria-hidden /> Add category</Button>}
        </div>
        {categories.isLoading ? <Spinner /> : categories.isError ? <ErrorState error={categories.error} onRetry={() => categories.refetch()} /> : (
          <DataTable
            rows={rows} columns={columns} rowKey={(c) => c.id}
            empty={categories.data?.length ? { title: 'No category matches your filters' } : { title: 'No vehicle categories yet', text: 'Create categories such as Sedan, Bike or Auto-rickshaw.', action: canEdit && hasRegions ? <Button onClick={() => setModal('new')}>Add category</Button> : undefined }}
          />
        )}
      </Card>

      {modal && <CategoryModal category={modal === 'new' ? null : modal} regions={regionList} onClose={() => setModal(null)} />}
    </>
  )
}
