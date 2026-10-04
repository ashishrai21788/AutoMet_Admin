import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { ApiError, fleet } from '@/api'
import { useCategories, useRegions, useVehicles } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { regionLabel, useDebounced } from '@/lib/labels'
import type { AccountStatus, VehicleDetail, VehicleInput, VehicleListItem } from '@/lib/types'
import DataTable, { SearchInput, type Column } from '@/components/DataTable'
import Modal from '@/components/Modal'
import StatusModal from '@/components/StatusModal'
import { AccountBadge, VerificationBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/feedback'
import { Button, Card, ErrorState, PageHeader, SelectField, Spinner, TextField } from '@/components/ui'

const PAGE_SIZE = 15
const select = 'rounded-lg border border-line bg-bg px-3 py-2 text-sm'
const thisYear = new Date().getFullYear()

const blank: VehicleInput = { registrationNumber: '', make: '', model: '', year: '', colour: '', categoryId: '', passengerCapacity: '4', luggageCapacity: '', operatingRegionId: '', status: 'INACTIVE' }

export function VehicleFormModal({ vehicle, onClose, onSaved }: { vehicle: VehicleDetail | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { tenantId } = useScope()
  const qc = useQueryClient()
  const toast = useToast()
  const regions = useRegions()
  const categories = useCategories()
  const [f, setF] = useState<VehicleInput>(vehicle ? {
    registrationNumber: vehicle.registrationNumber, make: vehicle.make, model: vehicle.model, year: vehicle.year ? String(vehicle.year) : '', colour: vehicle.colour,
    categoryId: vehicle.categoryId, passengerCapacity: String(vehicle.passengerCapacity), luggageCapacity: vehicle.luggageCapacity != null ? String(vehicle.luggageCapacity) : '',
    operatingRegionId: vehicle.operatingRegionId ?? '', status: vehicle.status,
  } : blank)
  const [touched, setTouched] = useState(false)
  const [server, setServer] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const set = (k: keyof VehicleInput) => (e: { target: { value: string } }) => { setF((x) => ({ ...x, [k]: e.target.value })); setServer({}) }

  const activeRegions = (regions.data ?? []).filter((r) => r.active || r.id === vehicle?.operatingRegionId)
  const category = (categories.data ?? []).find((c) => c.id === f.categoryId)
  const regionOptions = category ? activeRegions.filter((r) => category.regionIds.includes(r.id) || r.id === f.operatingRegionId) : activeRegions

  const local: Record<string, string> = {}
  const reg = f.registrationNumber.replace(/[^A-Za-z0-9]/g, '')
  if (reg.length < 4 || reg.length > 15) local.registrationNumber = 'Enter the registration number (4 to 15 letters and digits)'
  if (!f.make.trim()) local.make = 'Make is required'
  if (!f.model.trim()) local.model = 'Model is required'
  if (f.year && !(Number(f.year) >= 1980 && Number(f.year) <= thisYear + 1)) local.year = 'Enter a valid year'
  if (!f.categoryId) local.categoryId = 'Choose a vehicle category'
  const pc = Number(f.passengerCapacity)
  if (!Number.isInteger(pc) || pc < 1 || pc > 20) local.passengerCapacity = 'Enter a whole number from 1 to 20'
  if (f.luggageCapacity && !(Number.isInteger(Number(f.luggageCapacity)) && Number(f.luggageCapacity) >= 0 && Number(f.luggageCapacity) <= 20)) local.luggageCapacity = 'Enter a whole number from 0 to 20'
  const fe = { ...(touched ? local : {}), ...server }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (busy || Object.keys(local).length) return
    setBusy(true); setServer({})
    try {
      const body = { ...f, registrationNumber: f.registrationNumber.trim(), make: f.make.trim(), model: f.model.trim(), colour: f.colour.trim() }
      let id: string
      if (vehicle) { const { status: _s, ...rest } = body; void _s; await fleet.vehicles.update(vehicle.id, rest); id = vehicle.id }
      else id = (await fleet.vehicles.create(body)).id
      await qc.invalidateQueries({ queryKey: ['biz', tenantId] })
      toast.success(vehicle ? 'Vehicle updated' : 'Vehicle added')
      onSaved(id)
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setServer(err.fieldErrors)
      else toast.error(err instanceof Error ? err.message : 'Could not save the vehicle')
    } finally { setBusy(false) }
  }

  return (
    <Modal title={vehicle ? `Edit ${vehicle.registrationNumber}` : 'Add vehicle'} wide onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="vehicle-form" loading={busy}>{vehicle ? 'Save changes' : 'Add vehicle'}</Button></>}>
      <form id="vehicle-form" onSubmit={submit} noValidate className="space-y-5">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Vehicle details</legend>
          <TextField label="Registration number" required value={f.registrationNumber} onChange={set('registrationNumber')} maxLength={20} error={fe.registrationNumber} hint="Spaces and dashes are ignored when checking for duplicates" />
          <SelectField label="Vehicle category" required value={f.categoryId} onChange={set('categoryId')} error={fe.categoryId}>
            <option value="">Select a category…</option>{(categories.data ?? []).filter((c) => c.active || c.id === vehicle?.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <TextField label="Make" required value={f.make} onChange={set('make')} maxLength={40} error={fe.make} />
          <TextField label="Model" required value={f.model} onChange={set('model')} maxLength={40} error={fe.model} />
          <TextField label="Manufacturing year (optional)" type="number" min={1980} max={thisYear + 1} value={f.year} onChange={set('year')} error={fe.year} />
          <TextField label="Colour (optional)" value={f.colour} onChange={set('colour')} maxLength={30} error={fe.colour} />
          <TextField label="Passenger capacity" required type="number" min={1} max={20} value={f.passengerCapacity} onChange={set('passengerCapacity')} error={fe.passengerCapacity} />
          <TextField label="Luggage capacity (optional)" type="number" min={0} max={20} value={f.luggageCapacity} onChange={set('luggageCapacity')} error={fe.luggageCapacity} />
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Operating details</legend>
          <SelectField label="Operating region (optional)" value={f.operatingRegionId} onChange={set('operatingRegionId')} error={fe.operatingRegionId}
            hint={category ? 'Regions where this category is offered' : 'Choose a category first to narrow the regions'}>
            <option value="">Any region</option>{regionOptions.map((r) => <option key={r.id} value={r.id}>{regionLabel(r)}</option>)}
          </SelectField>
          {!vehicle ? (
            <SelectField label="Status" value={f.status} onChange={set('status')} error={fe.status} hint="Documents still have to be approved before the vehicle can be used">
              <option value="INACTIVE">Inactive</option><option value="ACTIVE">Active</option>
            </SelectField>
          ) : <div className="text-sm"><span className="mb-1 block text-xs font-medium text-muted">Status</span><AccountBadge status={vehicle.status} /><span className="mt-1 block text-xs text-muted">Change it with the status action on the vehicle page.</span></div>}
        </fieldset>
        <p className="text-xs text-muted">Registration certificate, insurance and other documents are added from the vehicle's page after it is created.</p>
      </form>
    </Modal>
  )
}

export default function Vehicles() {
  const { user, tenantId } = useScope()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const canManage = can(user, 'vehicles.manage')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [regionId, setRegionId] = useState('')
  const [status, setStatus] = useState('')
  const [verification, setVerification] = useState('')
  const [assignment, setAssignment] = useState('')
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  const [statusFor, setStatusFor] = useState<VehicleListItem | null>(null)
  const q = useDebounced(search.trim())
  useEffect(() => setPage(1), [q, categoryId, regionId, status, verification, assignment])

  const regions = useRegions()
  const categories = useCategories()
  const list = useVehicles({ search: q, categoryId, regionId, status, verification, assignment, page, pageSize: PAGE_SIZE })
  const filtered = !!(q || categoryId || regionId || status || verification || assignment)
  const reset = () => { setSearch(''); setCategoryId(''); setRegionId(''); setStatus(''); setVerification(''); setAssignment('') }
  const regionById = useMemo(() => new Map((regions.data ?? []).map((r) => [r.id, r])), [regions.data])

  const columns: Column<VehicleListItem>[] = [
    { header: 'Registration', cell: (v) => <Link to={`/vehicles/${v.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{v.registrationNumber}</Link> },
    { header: 'Vehicle', cell: (v) => <span>{v.make} {v.model}{v.year ? <span className="text-muted"> · {v.year}</span> : null}</span> },
    { header: 'Category', cell: (v) => v.categoryName ?? '—' },
    { header: 'Driver', cell: (v) => v.driver ? <Link to={`/drivers/${v.driver.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{v.driver.name}</Link> : <span className="text-muted">Not assigned</span> },
    { header: 'Region', cell: (v) => (v.operatingRegionId ? regionLabel(regionById.get(v.operatingRegionId)) : 'Any') },
    { header: 'Documents', cell: (v) => <VerificationBadge status={v.verificationStatus} /> },
    { header: 'Status', cell: (v) => <AccountBadge status={v.status as AccountStatus} /> },
    { header: 'Actions', hideLabel: true, className: 'text-right', cell: (v) => (
      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        <Link to={`/vehicles/${v.id}`}><Button variant="ghost">View</Button></Link>
        {canManage && <Button variant="ghost" onClick={() => setStatusFor(v)}>Status</Button>}
      </div>
    ) },
  ]

  return (
    <>
      <PageHeader title="Vehicles" subtitle="The actual registered vehicles. A vehicle category such as Sedan is the type of ride; a vehicle is one car with its own plate and documents."
        action={canManage ? <Button onClick={() => setAdding(true)}><Plus size={15} aria-hidden /> Add vehicle</Button> : undefined} />
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2"><SearchInput value={search} onChange={setSearch} placeholder="Search plate, make or model" /></div>
          <select aria-label="Category" className={select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">All categories</option>{(categories.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select aria-label="Region" className={select} value={regionId} onChange={(e) => setRegionId(e.target.value)}><option value="">All regions</option>{(regions.data ?? []).map((r) => <option key={r.id} value={r.id}>{regionLabel(r)}</option>)}</select>
          <select aria-label="Status" className={select} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="SUSPENDED">Suspended</option></select>
          <select aria-label="Document verification" className={select} value={verification} onChange={(e) => setVerification(e.target.value)}>
            <option value="">Any verification</option><option value="INCOMPLETE">Incomplete</option><option value="PENDING_REVIEW">Pending review</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="EXPIRED">Expired</option>
          </select>
          <select aria-label="Assignment" className={select} value={assignment} onChange={(e) => setAssignment(e.target.value)}><option value="">Assigned or not</option><option value="assigned">Has a driver</option><option value="unassigned">No driver</option></select>
          {filtered && <div className="flex items-center"><Button variant="ghost" onClick={reset}>Clear filters</Button></div>}
        </div>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
          <DataTable rows={list.data!.items} columns={columns} rowKey={(v) => v.id} loading={list.isFetching} onRowClick={(v) => navigate(`/vehicles/${v.id}`)}
            paging={{ page: list.data!.page, pageSize: list.data!.pageSize, total: list.data!.total, onPage: setPage }}
            empty={filtered ? { title: 'No vehicle matches these filters', action: <Button variant="ghost" onClick={reset}>Clear filters</Button> }
              : { title: 'No vehicles yet', text: 'Add the vehicles that drivers will use, then upload their documents.', action: canManage ? <Button onClick={() => setAdding(true)}>Add vehicle</Button> : undefined }} />
        )}
      </Card>

      {adding && <VehicleFormModal vehicle={null} onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); navigate(`/vehicles/${id}?tab=documents`) }} />}
      {statusFor && (
        <StatusModal subject="vehicle" title={`Change status of ${statusFor.registrationNumber}`} current={statusFor.status as AccountStatus} onClose={() => setStatusFor(null)}
          onSubmit={async (s, reason) => { await fleet.vehicles.setStatus(statusFor.id, s, reason); await qc.invalidateQueries({ queryKey: ['biz', tenantId] }) }} />
      )}
    </>
  )
}
