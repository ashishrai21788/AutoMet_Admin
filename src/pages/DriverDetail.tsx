import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { ApiError, fleet } from '@/api'
import { useCategories, useDriver, useDriverHistory, useRegions, useVehicles } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { fmtDate, fmtDateTime, regionLabel, timeAgo } from '@/lib/labels'
import type { DriverDetail as Driver } from '@/lib/types'
import DocumentsPanel from '@/components/DocumentsPanel'
import HistoryTimeline from '@/components/HistoryTimeline'
import Modal from '@/components/Modal'
import StatusModal from '@/components/StatusModal'
import { AccountBadge, EligibleBadge, PresenceBadge, VerificationBadge } from '@/components/StatusBadge'
import { useConfirm, useToast } from '@/components/feedback'
import { Avatar } from '@/pages/Drivers'
import { Alert, Button, Card, EmptyState, ErrorState, Field, PageHeader, SelectField, Spinner, TextField, Textarea } from '@/components/ui'

const TABS = [
  ['overview', 'Overview'], ['personal', 'Personal information'], ['documents', 'Documents'], ['vehicle', 'Assigned vehicle'],
  ['region', 'Operating region'], ['activity', 'Account activity'], ['history', 'Status history'],
] as const
type TabKey = (typeof TABS)[number][0]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Dl({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 break-words">{v || <span className="text-muted">—</span>}</dd></div>)}
    </dl>
  )
}

// ---------------- edit ----------------

function EditModal({ driver, section, onClose }: { driver: Driver; section: 'personal' | 'operating'; onClose: () => void }) {
  const { tenantId } = useScope()
  const qc = useQueryClient()
  const toast = useToast()
  const regions = useRegions()
  const categories = useCategories()
  const [f, setF] = useState({
    fullName: driver.fullName, phone: driver.phone, email: driver.email ?? '', dob: driver.dateOfBirth ?? '',
    country: driver.address?.country ?? '', state: driver.address?.state ?? '', city: driver.address?.city ?? '', line: driver.address?.line ?? '',
    regionId: driver.operatingRegionId ?? '', categoryId: driver.eligibleCategoryId ?? '',
  })
  const [touched, setTouched] = useState(false)
  const [server, setServer] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((x) => ({ ...x, [k]: e.target.value })); setServer({}) }
  const offered = (categories.data ?? []).filter((c) => c.active && (!f.regionId || c.regionIds.includes(f.regionId)))

  const local: Record<string, string> = {}
  if (section === 'personal') {
    if (f.fullName.trim().length < 2) local.fullName = 'Full name is required'
    if (!/^\+[1-9]\d{6,14}$/.test(f.phone.replace(/[\s().-]/g, ''))) local.phone = 'Use the international format, for example +919876543210'
    if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) local.email = 'Enter a valid email address'
  } else {
    if (!f.regionId) local.operatingRegionId = 'Choose a region'
    if (!f.categoryId) local.eligibleCategoryId = 'Choose a category'
  }
  const fe = { ...(touched ? local : {}), ...server }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (busy || Object.keys(local).length) return
    setBusy(true); setServer({})
    try {
      await fleet.drivers.update(driver.id, section === 'personal'
        ? { fullName: f.fullName.trim(), phone: f.phone, email: f.email.trim(), dateOfBirth: f.dob, address: { country: f.country, state: f.state.trim(), city: f.city.trim(), line: f.line.trim() } }
        : { operatingRegionId: f.regionId, eligibleCategoryId: f.categoryId })
      await qc.invalidateQueries({ queryKey: ['biz', tenantId] })
      toast.success('Driver updated')
      onClose()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setServer(err.fieldErrors)
      else toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally { setBusy(false) }
  }

  return (
    <Modal title={section === 'personal' ? 'Edit personal information' : 'Edit operating region'} wide onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="edit-driver" loading={busy}>Save</Button></>}>
      <form id="edit-driver" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {section === 'personal' ? (
          <>
            <TextField label="Full name" value={f.fullName} onChange={set('fullName')} maxLength={80} error={fe.fullName} className="sm:col-span-2" />
            <TextField label="Phone (with country code)" value={f.phone} onChange={set('phone')} error={fe.phone} />
            <TextField label="Email (optional)" type="email" value={f.email} onChange={set('email')} error={fe.email} />
            <TextField label="Date of birth (optional)" type="date" value={f.dob} onChange={set('dob')} error={fe.dateOfBirth} />
            <div />
            <TextField label="Country (2-letter code)" value={f.country} onChange={set('country')} maxLength={2} error={fe['address.country']} />
            <TextField label="State or province" value={f.state} onChange={set('state')} maxLength={80} />
            <TextField label="City" value={f.city} onChange={set('city')} maxLength={80} />
            <TextField label="Address" value={f.line} onChange={set('line')} maxLength={200} />
          </>
        ) : (
          <>
            <SelectField label="Operating region" value={f.regionId} onChange={set('regionId')} error={fe.operatingRegionId}>
              <option value="">Select…</option>{(regions.data ?? []).filter((r) => r.active || r.id === driver.operatingRegionId).map((r) => <option key={r.id} value={r.id}>{regionLabel(r)}</option>)}
            </SelectField>
            <SelectField label="Eligible vehicle category" value={f.categoryId} onChange={set('categoryId')} error={fe.eligibleCategoryId}>
              <option value="">Select…</option>{offered.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectField>
            <p className="text-xs text-muted sm:col-span-2">If the driver has a vehicle assigned, it has to match the new region and category, otherwise the driver stops being eligible until it is changed.</p>
          </>
        )}
      </form>
    </Modal>
  )
}

// ---------------- assigned vehicle ----------------

function VehicleTab({ driver, canManage }: { driver: Driver; canManage: boolean }) {
  const { user, tenantId } = useScope()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [pick, setPick] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const canAssign = canManage && can(user, 'vehicles.manage') && driver.accountStatus !== 'SUSPENDED'
  // vehicles that suit this driver and have nobody driving them
  const free = useVehicles({ assignment: 'unassigned', categoryId: driver.eligibleCategoryId ?? '', regionId: driver.operatingRegionId ?? '', pageSize: 100 }, canAssign)
  const options = (free.data?.items ?? []).filter((v) => v.status !== 'SUSPENDED')
  const refresh = () => qc.invalidateQueries({ queryKey: ['biz', tenantId] })

  async function assign() {
    if (!pick || busy) return
    setBusy(true)
    try {
      await fleet.drivers.assignVehicle(driver.id, pick, !!driver.vehicle)
      toast.success('Vehicle assigned'); setPick(''); await refresh()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not assign the vehicle') } finally { setBusy(false) }
  }
  async function unassign() {
    const ok = await confirm({ title: 'Remove the vehicle from this driver?', message: 'The assignment ends and stays in the history. The driver will not be eligible for rides until another vehicle is assigned.', confirmLabel: 'Unassign', danger: true })
    if (!ok) return
    setBusy(true)
    try { await fleet.drivers.unassignVehicle(driver.id, reason.trim()); toast.success('Vehicle unassigned'); await refresh() }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not unassign') } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {driver.vehicle ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link to={`/vehicles/${driver.vehicle.id}`} className="text-lg font-semibold hover:underline">{driver.vehicle.registrationNumber}</Link>
              <p className="text-sm text-muted">{driver.vehicle.make} {driver.vehicle.model} · assigned {fmtDate(driver.assignedAt)}</p>
              <p className="mt-1 text-sm">Vehicle status: <AccountBadge status={driver.vehicle.status} /></p>
            </div>
            {canAssign && (
              <div className="flex flex-col gap-2 sm:w-64">
                <Field label="Reason (optional)">{(p) => <Textarea {...p} rows={1} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
                <Button variant="danger" loading={busy} onClick={unassign}>Unassign vehicle</Button>
              </div>
            )}
          </div>
        </Card>
      ) : <Card><EmptyState title="No vehicle assigned" text="Assign a vehicle of this driver's category and region. A driver cannot receive rides without one." /></Card>}

      {canAssign ? (
        <Card className="p-5">
          <h3 className="font-medium">{driver.vehicle ? 'Change vehicle' : 'Assign a vehicle'}</h3>
          <p className="mb-3 text-sm text-muted">Only unassigned vehicles of this driver's category and region are listed.</p>
          {free.isLoading ? <Spinner /> : options.length === 0 ? <Alert kind="info">No free vehicle matches. <Link to="/vehicles" className="underline">Add a vehicle</Link> of the right category and region first.</Alert> : (
            <div className="flex flex-wrap items-end gap-3">
              <SelectField label="Vehicle" value={pick} onChange={(e) => setPick(e.target.value)} className="min-w-[16rem] flex-1">
                <option value="">Select a vehicle…</option>
                {options.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} · {v.make} {v.model}</option>)}
              </SelectField>
              <Button onClick={assign} loading={busy} disabled={!pick}>{driver.vehicle ? 'Change vehicle' : 'Assign vehicle'}</Button>
            </div>
          )}
        </Card>
      ) : canManage && driver.accountStatus === 'SUSPENDED' ? <Alert kind="warn">A suspended driver cannot be assigned a vehicle. Reactivate the account first.</Alert> : null}
    </div>
  )
}

// ---------------- page ----------------

export default function DriverDetail() {
  const { id = '' } = useParams()
  const { user, tenantId } = useScope()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const query = useDriver(id)
  const history = useDriverHistory(id)
  const regions = useRegions()
  const canManage = can(user, 'drivers.manage')
  const tab = (TABS.find(([k]) => k === params.get('tab'))?.[0] ?? 'overview') as TabKey
  // undefined = not chosen yet: a "?edit=1" link opens the personal-information dialog
  const [chosenEdit, setEdit] = useState<'personal' | 'operating' | null | undefined>(undefined)
  const [statusOpen, setStatusOpen] = useState(false)
  const regionById = useMemo(() => new Map((regions.data ?? []).map((r) => [r.id, r])), [regions.data])

  const editFromLink = params.get('edit') === '1' && canManage && !!query.data

  if (query.isLoading) return <Spinner />
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404
    return notFound
      ? <Card><EmptyState title="Driver not found" text="This driver does not exist in this business." action={<Link to="/drivers"><Button>Back to drivers</Button></Link>} /></Card>
      : <ErrorState error={query.error} onRetry={() => query.refetch()} />
  }
  const d = query.data!
  const edit = chosenEdit === undefined ? (editFromLink ? 'personal' : null) : chosenEdit
  const closeEdit = () => { setEdit(null); if (editFromLink) { const p = new URLSearchParams(params); p.delete('edit'); setParams(p, { replace: true }) } }
  const setTab = (k: TabKey) => { const p = new URLSearchParams(params); p.set('tab', k); setParams(p, { replace: true }) }
  const region = regionById.get(d.operatingRegionId ?? '')
  const addr = d.address ? [d.address.line, d.address.city, d.address.state, d.address.country].filter(Boolean).join(', ') : ''

  return (
    <>
      <Link to="/drivers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:underline"><ArrowLeft size={14} aria-hidden /> All drivers</Link>
      <PageHeader
        title={d.name}
        subtitle={`Driver ID ${d.id} · ${d.phone}`}
        action={canManage ? <div className="flex gap-2"><Button variant="ghost" onClick={() => setEdit('personal')}>Edit</Button><Button variant="ghost" onClick={() => setStatusOpen(true)}>Change status</Button></div> : undefined}
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Avatar name={d.name} url={d.photoUrl} size={48} />
        <AccountBadge status={d.accountStatus} /> <VerificationBadge status={d.verificationStatus} /> <EligibleBadge eligible={d.eligibility.eligible} />
      </div>

      <div role="tablist" aria-label="Driver sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === k ? 'border-brand font-medium' : 'border-transparent text-muted hover:text-ink'}`}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5"><h2 className="mb-3 font-semibold">Summary</h2>
            <Dl rows={[['Account status', <AccountBadge key="v" status={d.accountStatus} />], ['Availability', <PresenceBadge key="v" presence={d.presence} ageSeconds={d.locationAgeSeconds} />], ['Current trip', d.currentTripId ? <Link key="v" className="hover:underline" to={`/trips/${d.currentTripId}`}>{d.currentTripId}</Link> : 'None'], ['Last seen', d.lastSeenAt ? `${timeAgo(d.lastSeenAt)} · ${fmtDateTime(d.lastSeenAt)}` : 'Never'], ['Verification', <VerificationBadge key="v" status={d.verificationStatus} />], ['Operating region', regionLabel(region)], ['Eligible category', d.eligibleCategoryName], ['Vehicle', d.vehicle ? <Link key="v" className="hover:underline" to={`/vehicles/${d.vehicle.id}`}>{d.vehicle.registrationNumber}</Link> : 'Not assigned'], ['Registered', fmtDate(d.createdAt)]]} />
          </Card>
          <Card className="p-5"><h2 className="mb-1 font-semibold">Ride eligibility</h2>
            <p className="mb-3 text-sm text-muted">Whether this driver could be offered rides. It is worked out from the account status, verification, region and vehicle; none of them alone is enough.</p>
            {d.eligibility.eligible ? <Alert kind="info">Eligible: the account is active, verification is approved and an approved, active vehicle is assigned.</Alert> : (
              <ul className="space-y-1.5 text-sm">{d.eligibility.reasons.map((r) => <li key={r.code} className="flex gap-2"><span aria-hidden className="text-danger">✕</span>{r.message}</li>)}</ul>
            )}
          </Card>
        </div>
      )}

      {tab === 'personal' && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Personal information</h2>{canManage && <Button variant="ghost" onClick={() => setEdit('personal')}>Edit</Button>}</div>
          <Dl rows={[['Full name', d.fullName], ['Phone', d.phone], ['Email', d.email], ['Date of birth', d.dateOfBirth ? fmtDate(d.dateOfBirth) : ''], ['Address', addr]]} />
        </Card>
      )}

      {tab === 'documents' && <DocumentsPanel kind="drivers" subjectId={d.id} canUpload={canManage} />}
      {tab === 'vehicle' && <VehicleTab driver={d} canManage={canManage} />}

      {tab === 'region' && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Operating region</h2>{canManage && <Button variant="ghost" onClick={() => setEdit('operating')}>Edit</Button>}</div>
          <Dl rows={[['Region', regionLabel(region)], ['Region status', region ? (region.active ? 'Active' : 'Inactive') : ''], ['Eligible vehicle category', d.eligibleCategoryName]]} />
        </Card>
      )}

      {tab === 'activity' && (
        <Card className="p-5">
          <h2 className="mb-1 font-semibold">Account activity</h2>
          <p className="mb-3 text-sm text-muted">Only what is recorded today. Ride history, earnings and ratings are not shown because they are not recorded for this dashboard yet.</p>
          <Dl rows={[['Registered', fmtDateTime(d.activity.registeredAt)], ['Added from', d.activity.createdByAdmin ? 'The dashboard' : 'The driver app'], ['Phone verified', d.activity.phoneVerified ? 'Yes' : 'No'], ['Last active in the app', d.activity.lastActiveAt ? fmtDateTime(d.activity.lastActiveAt) : 'Never'], ['Signed in on the app', d.activity.signedInOnApp ? 'Yes' : 'No']]} />
          {d.appReportedVehicle && (
            <div className="mt-5 border-t border-line pt-4"><h3 className="mb-2 text-sm font-medium">Vehicle details entered in the driver app</h3>
              <Dl rows={[['Registration', d.appReportedVehicle.registrationNumber], ['Model', d.appReportedVehicle.model], ['Type', d.appReportedVehicle.type], ['Colour', d.appReportedVehicle.colour]]} />
              <p className="mt-2 text-xs text-muted">For information only. Vehicles used for rides are the ones managed under Vehicles.</p></div>
          )}
        </Card>
      )}

      {tab === 'history' && (
        <Card className="p-5"><h2 className="mb-4 font-semibold">Status history</h2>
          {history.isLoading ? <Spinner /> : history.isError ? <ErrorState error={history.error} onRetry={() => history.refetch()} /> : <HistoryTimeline entries={history.data!} />}
        </Card>
      )}

      {edit && <EditModal driver={d} section={edit} onClose={closeEdit} />}
      {statusOpen && (
        <StatusModal subject="driver" title={`Change status of ${d.name}`} current={d.accountStatus} onClose={() => setStatusOpen(false)}
          onSubmit={async (status, reason) => { await fleet.drivers.setStatus(d.id, status, reason); await qc.invalidateQueries({ queryKey: ['biz', tenantId] }) }} />
      )}
    </>
  )
}
