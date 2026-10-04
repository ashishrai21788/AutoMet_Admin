import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { ApiError, fleet } from '@/api'
import { useDrivers, useRegions, useVehicle, useVehicleHistory } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { fmtDate, regionLabel } from '@/lib/labels'
import type { VehicleDetail as Vehicle } from '@/lib/types'
import DocumentsPanel from '@/components/DocumentsPanel'
import HistoryTimeline from '@/components/HistoryTimeline'
import StatusModal from '@/components/StatusModal'
import { AccountBadge, VerificationBadge } from '@/components/StatusBadge'
import { useConfirm, useToast } from '@/components/feedback'
import { VehicleFormModal } from '@/pages/Vehicles'
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Field, PageHeader, SelectField, Spinner, Textarea } from '@/components/ui'

const TABS = [['overview', 'Overview'], ['documents', 'Documents'], ['driver', 'Assigned driver'], ['history', 'Status history']] as const
type TabKey = (typeof TABS)[number][0]

function Dl({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 break-words">{v || <span className="text-muted">—</span>}</dd></div>)}
    </dl>
  )
}

function DriverTab({ vehicle, canManage }: { vehicle: Vehicle; canManage: boolean }) {
  const { user, tenantId } = useScope()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [pick, setPick] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const canAssign = canManage && can(user, 'drivers.manage') && vehicle.status !== 'SUSPENDED'
  // active drivers of this region (any category; the server checks the match when assigning)
  const drivers = useDrivers({ account: 'ACTIVE', regionId: vehicle.operatingRegionId ?? '', categoryId: '', pageSize: 100 })
  const options = (drivers.data?.items ?? []).filter((d) => !d.vehicle)
  const refresh = () => qc.invalidateQueries({ queryKey: ['biz', tenantId] })

  async function assign() {
    if (!pick || busy) return
    setBusy(true)
    try { await fleet.vehicles.assignDriver(vehicle.id, pick, !!vehicle.driver); toast.success('Driver assigned'); setPick(''); await refresh() }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not assign the driver') } finally { setBusy(false) }
  }
  async function unassign() {
    const ok = await confirm({ title: 'Remove the driver from this vehicle?', message: 'The assignment ends and stays in the history. The driver will not be eligible for rides until another vehicle is assigned.', confirmLabel: 'Unassign', danger: true })
    if (!ok) return
    setBusy(true)
    try { await fleet.vehicles.unassignDriver(vehicle.id, reason.trim()); toast.success('Driver unassigned'); await refresh() }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not unassign') } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {vehicle.driver ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link to={`/drivers/${vehicle.driver.id}`} className="text-lg font-semibold hover:underline">{vehicle.driver.name}</Link>
              <p className="text-sm text-muted">{vehicle.driver.phone} · assigned {fmtDate(vehicle.assignedAt)}</p>
              <p className="mt-1 text-sm">Driver account: <AccountBadge status={vehicle.driver.accountStatus} /></p>
            </div>
            {canAssign && (
              <div className="flex flex-col gap-2 sm:w-64">
                <Field label="Reason (optional)">{(p) => <Textarea {...p} rows={1} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
                <Button variant="danger" loading={busy} onClick={unassign}>Unassign driver</Button>
              </div>
            )}
          </div>
        </Card>
      ) : <Card><EmptyState title="No driver assigned" text="Assign a driver of this vehicle's category and region." /></Card>}

      {canAssign ? (
        <Card className="p-5">
          <h3 className="font-medium">{vehicle.driver ? 'Change driver' : 'Assign a driver'}</h3>
          <p className="mb-3 text-sm text-muted">Active drivers in this vehicle's region who have no vehicle yet. The driver's eligible category has to match the vehicle's.</p>
          {drivers.isLoading ? <Spinner /> : options.length === 0 ? <Alert kind="info">No free active driver in this region. <Link to="/drivers/new" className="underline">Add a driver</Link> first.</Alert> : (
            <div className="flex flex-wrap items-end gap-3">
              <SelectField label="Driver" value={pick} onChange={(e) => setPick(e.target.value)} className="min-w-[16rem] flex-1">
                <option value="">Select a driver…</option>{options.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.phone}</option>)}
              </SelectField>
              <Button onClick={assign} loading={busy} disabled={!pick}>{vehicle.driver ? 'Change driver' : 'Assign driver'}</Button>
            </div>
          )}
        </Card>
      ) : canManage && vehicle.status === 'SUSPENDED' ? <Alert kind="warn">A suspended vehicle cannot be assigned. Reactivate it first.</Alert> : null}
    </div>
  )
}

export default function VehicleDetail() {
  const { id = '' } = useParams()
  const { user, tenantId } = useScope()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const query = useVehicle(id)
  const history = useVehicleHistory(id)
  const regions = useRegions()
  const canManage = can(user, 'vehicles.manage')
  const tab = (TABS.find(([k]) => k === params.get('tab'))?.[0] ?? 'overview') as TabKey
  const [editing, setEditing] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const regionById = useMemo(() => new Map((regions.data ?? []).map((r) => [r.id, r])), [regions.data])

  if (query.isLoading) return <Spinner />
  if (query.isError) {
    return query.error instanceof ApiError && query.error.status === 404
      ? <Card><EmptyState title="Vehicle not found" text="This vehicle does not exist in this business." action={<Link to="/vehicles"><Button>Back to vehicles</Button></Link>} /></Card>
      : <ErrorState error={query.error} onRetry={() => query.refetch()} />
  }
  const v = query.data!
  const setTab = (k: TabKey) => { const p = new URLSearchParams(params); p.set('tab', k); setParams(p, { replace: true }) }

  return (
    <>
      <Link to="/vehicles" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:underline"><ArrowLeft size={14} aria-hidden /> All vehicles</Link>
      <PageHeader title={v.registrationNumber} subtitle={`${v.make} ${v.model}${v.year ? ` · ${v.year}` : ''}`}
        action={canManage ? <div className="flex gap-2"><Button variant="ghost" onClick={() => setEditing(true)}>Edit</Button><Button variant="ghost" onClick={() => setStatusOpen(true)}>Change status</Button></div> : undefined} />
      <div className="mb-5 flex flex-wrap items-center gap-3"><AccountBadge status={v.status} /> <VerificationBadge status={v.verificationStatus} /> <Badge kind={v.operational ? 'ok' : 'neutral'}>{v.operational ? 'Ready for use' : 'Not ready for use'}</Badge></div>

      <div role="tablist" aria-label="Vehicle sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === k ? 'border-brand font-medium' : 'border-transparent text-muted hover:text-ink'}`}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5"><h2 className="mb-3 font-semibold">Vehicle information</h2>
            <Dl rows={[['Registration number', v.registrationNumber], ['Make and model', `${v.make} ${v.model}`], ['Year', v.year ? String(v.year) : ''], ['Colour', v.colour], ['Category', v.categoryName], ['Passengers', String(v.passengerCapacity)], ['Luggage', v.luggageCapacity != null ? String(v.luggageCapacity) : '']]} />
          </Card>
          <Card className="p-5"><h2 className="mb-3 font-semibold">Operation</h2>
            <Dl rows={[['Operating region', v.operatingRegionId ? regionLabel(regionById.get(v.operatingRegionId)) : 'Any region'], ['Status', <AccountBadge status={v.status} />], ['Document verification', <VerificationBadge status={v.verificationStatus} />], ['Assigned driver', v.driver ? <Link className="hover:underline" to={`/drivers/${v.driver.id}`}>{v.driver.name}</Link> : 'Not assigned'], ['Added', fmtDate(v.createdAt)]]} />
            <p className="mt-3 text-xs text-muted">A vehicle is ready for use when it is active and its documents are approved and unexpired. The driver also has to be eligible.</p>
          </Card>
        </div>
      )}
      {tab === 'documents' && <DocumentsPanel kind="vehicles" subjectId={v.id} canUpload={canManage} />}
      {tab === 'driver' && <DriverTab vehicle={v} canManage={canManage} />}
      {tab === 'history' && (
        <Card className="p-5"><h2 className="mb-4 font-semibold">Status and audit history</h2>
          {history.isLoading ? <Spinner /> : history.isError ? <ErrorState error={history.error} onRetry={() => history.refetch()} /> : <HistoryTimeline entries={history.data!} />}
        </Card>
      )}

      {editing && <VehicleFormModal vehicle={v} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      {statusOpen && (
        <StatusModal subject="vehicle" title={`Change status of ${v.registrationNumber}`} current={v.status} onClose={() => setStatusOpen(false)}
          onSubmit={async (status, reason) => { await fleet.vehicles.setStatus(v.id, status, reason); await qc.invalidateQueries({ queryKey: ['biz', tenantId] }) }} />
      )}
    </>
  )
}
