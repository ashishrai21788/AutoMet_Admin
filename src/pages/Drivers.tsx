import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { fleet } from '@/api'
import { useCategories, useDrivers, useRegions } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { fmtDate, initials, regionLabel, timeAgo, useDebounced } from '@/lib/labels'
import type { DriverListItem } from '@/lib/types'
import DataTable, { SearchInput, type Column } from '@/components/DataTable'
import StatusModal from '@/components/StatusModal'
import { AccountBadge, PresenceBadge, VerificationBadge } from '@/components/StatusBadge'
import { Button, Card, ErrorState, PageHeader, Spinner } from '@/components/ui'

const PAGE_SIZE = 15
const select = 'rounded-lg border border-line bg-bg px-3 py-2 text-sm'

export function Avatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [url])
  return url && !broken
    ? <img src={url} alt="" width={size} height={size} onError={() => setBroken(true)} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
    : <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-brand/20 text-xs font-semibold" style={{ width: size, height: size }}>{initials(name)}</span>
}

export default function Drivers() {
  const { user } = useScope()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { tenantId } = useScope()
  const canManage = can(user, 'drivers.manage')
  const [search, setSearch] = useState('')
  const [regionId, setRegionId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [verification, setVerification] = useState('')
  const [account, setAccount] = useState('')
  const [page, setPage] = useState(1)
  const [statusFor, setStatusFor] = useState<DriverListItem | null>(null)
  const q = useDebounced(search.trim())
  useEffect(() => setPage(1), [q, regionId, categoryId, verification, account])

  const regions = useRegions()
  const categories = useCategories()
  const list = useDrivers({ search: q, regionId, categoryId, verification, account, page, pageSize: PAGE_SIZE })
  const regionById = useMemo(() => new Map((regions.data ?? []).map((r) => [r.id, r])), [regions.data])
  const filtered = !!(q || regionId || categoryId || verification || account)

  const columns: Column<DriverListItem>[] = [
    { header: 'Driver', cell: (d) => (
      <Link to={`/drivers/${d.id}`} className="flex items-center gap-3 font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
        <Avatar name={d.name} url={d.photoUrl} />{d.name}
      </Link>
    ) },
    { header: 'Phone', cell: (d) => d.phone },
    { header: 'Driver ID', cell: (d) => <span className="font-mono text-xs">{d.id}</span> },
    { header: 'Vehicle', cell: (d) => d.vehicle ? <Link to={`/vehicles/${d.vehicle.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{d.vehicle.registrationNumber}<span className="block text-xs text-muted">{d.vehicle.make} {d.vehicle.model}</span></Link> : <span className="text-muted">Not assigned</span> },
    { header: 'Region', cell: (d) => regionLabel(regionById.get(d.operatingRegionId ?? '')) },
    { header: 'Availability', cell: (d) => (
      <div className="space-y-0.5">
        <PresenceBadge presence={d.presence} ageSeconds={d.locationAgeSeconds} />
        <div className="text-xs text-muted" title={d.lastSeenAt ?? undefined}>{d.currentTripId ? <Link to={`/trips/${d.currentTripId}`} className="underline" onClick={(e) => e.stopPropagation()}>On a trip</Link> : d.lastSeenAt ? `Seen ${timeAgo(d.lastSeenAt)}` : 'Never seen'}</div>
      </div>
    ) },
    { header: 'Verification', cell: (d) => <VerificationBadge status={d.verificationStatus} /> },
    { header: 'Account', cell: (d) => <AccountBadge status={d.accountStatus} /> },
    { header: 'Registered', cell: (d) => fmtDate(d.registeredAt) },
    { header: 'Actions', hideLabel: true, className: 'text-right', cell: (d) => (
      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        <Link to={`/drivers/${d.id}`}><Button variant="ghost">View</Button></Link>
        {canManage && <Link to={`/drivers/${d.id}?edit=1`}><Button variant="ghost">Edit</Button></Link>}
        {canManage && <Button variant={d.accountStatus === 'ACTIVE' ? 'ghost' : 'primary'} onClick={() => setStatusFor(d)}>Status</Button>}
      </div>
    ) },
  ]

  const reset = () => { setSearch(''); setRegionId(''); setCategoryId(''); setVerification(''); setAccount('') }

  return (
    <>
      <PageHeader
        title="Drivers"
        subtitle="Everyone who drives for this business. Verification and account status are separate: a driver must be active, verified and have a vehicle before getting rides."
        action={canManage ? <Link to="/drivers/new"><Button><Plus size={15} aria-hidden /> Add driver</Button></Link> : undefined}
      />
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-2"><SearchInput value={search} onChange={setSearch} placeholder="Search name, phone or driver ID" /></div>
          <select aria-label="Region" className={select} value={regionId} onChange={(e) => setRegionId(e.target.value)}>
            <option value="">All regions</option>{(regions.data ?? []).map((r) => <option key={r.id} value={r.id}>{regionLabel(r)}</option>)}
          </select>
          <select aria-label="Vehicle category" className={select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>{(categories.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="Verification status" className={select} value={verification} onChange={(e) => setVerification(e.target.value)}>
            <option value="">Any verification</option><option value="INCOMPLETE">Incomplete</option><option value="PENDING_REVIEW">Pending review</option>
            <option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="EXPIRED">Expired</option>
          </select>
          <select aria-label="Account status" className={select} value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">Any account status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="SUSPENDED">Suspended</option>
          </select>
          {filtered && <div className="flex items-center"><Button variant="ghost" onClick={reset}>Clear filters</Button></div>}
        </div>

        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
          <DataTable
            rows={list.data!.items} columns={columns} rowKey={(d) => d.id} loading={list.isFetching}
            onRowClick={(d) => navigate(`/drivers/${d.id}`)}
            paging={{ page: list.data!.page, pageSize: list.data!.pageSize, total: list.data!.total, onPage: setPage }}
            empty={filtered
              ? { title: 'No driver matches these filters', action: <Button variant="ghost" onClick={reset}>Clear filters</Button> }
              : { title: 'No drivers yet', text: 'Add a driver, upload their documents, and approve them to start.', action: canManage ? <Link to="/drivers/new"><Button>Add driver</Button></Link> : undefined }}
          />
        )}
      </Card>

      {statusFor && (
        <StatusModal subject="driver" title={`Change status of ${statusFor.name}`} current={statusFor.accountStatus} onClose={() => setStatusFor(null)}
          onSubmit={async (status, reason) => { await fleet.drivers.setStatus(statusFor.id, status, reason); await qc.invalidateQueries({ queryKey: ['biz', tenantId] }) }} />
      )}
    </>
  )
}
