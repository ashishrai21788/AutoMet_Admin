import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDriverHistory, useDrivers, useVehicleHistory, useVehicles } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { useDebounced } from '@/lib/labels'
import DocumentsPanel from '@/components/DocumentsPanel'
import HistoryTimeline from '@/components/HistoryTimeline'
import { SearchInput } from '@/components/DataTable'
import { AccountBadge, VerificationBadge } from '@/components/StatusBadge'
import { Avatar } from '@/pages/Drivers'
import { Alert, Button, Card, EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui'

const STATUSES = [
  ['PENDING_REVIEW', 'Pending review'], ['REJECTED', 'Rejected'], ['EXPIRED', 'Expired'], ['INCOMPLETE', 'Incomplete'], ['APPROVED', 'Approved'],
] as const
type Status = (typeof STATUSES)[number][0]

const PAGE_SIZE = 10

function Tabs<T extends string>({ items, value, onChange, label }: { items: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1">
      {items.map(([k, text]) => (
        <button key={k} role="tab" type="button" aria-selected={value === k} onClick={() => onChange(k)}
          className={`rounded-full border px-3 py-1 text-sm ${value === k ? 'border-brand bg-brand/15 font-medium' : 'border-line text-muted hover:text-ink'}`}>{text}</button>
      ))}
    </div>
  )
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-2 text-sm">
      <span className="text-muted">Page {page} of {pages}</span>
      <div className="flex gap-2"><Button variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button><Button variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button></div>
    </div>
  )
}

function DriversQueue({ status, search }: { status: Status; search: string }) {
  const { user } = useScope()
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const q = useDebounced(search.trim())
  useEffect(() => setPage(1), [status, q])
  const list = useDrivers({ verification: status, search: q, page, pageSize: PAGE_SIZE, sort: 'oldest' })
  const selected = params.get('d') ?? ''
  const history = useDriverHistory(selected)
  const select = (id: string) => { const p = new URLSearchParams(params); p.set('d', id); setParams(p, { replace: true }) }
  const current = list.data?.items.find((d) => d.id === selected)

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Card>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data!.items.length === 0 ? (
          <EmptyState title={status === 'PENDING_REVIEW' ? 'Nothing is waiting for review' : 'No drivers here'} text={q ? 'No driver matches your search.' : 'Drivers appear here as their documents come in.'} />
        ) : (
          <>
            <ul className="divide-y divide-line" aria-label="Drivers">
              {list.data!.items.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => select(d.id)} aria-current={d.id === selected} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[.03] dark:hover:bg-white/5 ${d.id === selected ? 'bg-brand/10' : ''}`}>
                    <Avatar name={d.name} url={d.photoUrl} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{d.name}</span><span className="block truncate text-xs text-muted">{d.phone} · {d.id}</span></span>
                    <VerificationBadge status={d.verificationStatus} />
                  </button>
                </li>
              ))}
            </ul>
            <Pager page={list.data!.page} total={list.data!.total} onPage={setPage} />
          </>
        )}
      </Card>

      <div className="min-w-0">
        {!selected ? <Card><EmptyState title="Choose a driver" text="Select a driver on the left to see their documents and decide on them." /></Card> : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {current && <Avatar name={current.name} url={current.photoUrl} size={44} />}
                <div><h2 className="text-lg font-semibold">{current?.name ?? 'Driver'}</h2><p className="text-xs text-muted">Driver ID {selected}</p></div>
                {current && <AccountBadge status={current.accountStatus} />}
              </div>
              <Link to={`/drivers/${selected}`}><Button variant="ghost">Open full profile</Button></Link>
            </div>
            {!can(user, 'documents.view') && <Alert kind="warn">Your role cannot open documents.</Alert>}
            <DocumentsPanel kind="drivers" subjectId={selected} canUpload={can(user, 'drivers.manage')} compact />
            <Card className="p-5"><h3 className="mb-4 font-semibold">Verification history</h3>
              {history.isLoading ? <Spinner /> : history.isError ? <ErrorState error={history.error} onRetry={() => history.refetch()} /> : <HistoryTimeline entries={history.data!} kind={['VERIFICATION', 'DOCUMENT']} />}
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function VehiclesQueue({ status, search }: { status: Status; search: string }) {
  const { user } = useScope()
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const q = useDebounced(search.trim())
  useEffect(() => setPage(1), [status, q])
  const list = useVehicles({ verification: status, search: q, page, pageSize: PAGE_SIZE })
  const selected = params.get('v') ?? ''
  const history = useVehicleHistory(selected)
  const select = (id: string) => { const p = new URLSearchParams(params); p.set('v', id); setParams(p, { replace: true }) }
  const current = list.data?.items.find((v) => v.id === selected)

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Card>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data!.items.length === 0 ? (
          <EmptyState title={status === 'PENDING_REVIEW' ? 'Nothing is waiting for review' : 'No vehicles here'} />
        ) : (
          <>
            <ul className="divide-y divide-line" aria-label="Vehicles">
              {list.data!.items.map((v) => (
                <li key={v.id}>
                  <button type="button" onClick={() => select(v.id)} aria-current={v.id === selected} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[.03] dark:hover:bg-white/5 ${v.id === selected ? 'bg-brand/10' : ''}`}>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{v.registrationNumber}</span><span className="block truncate text-xs text-muted">{v.make} {v.model}</span></span>
                    <VerificationBadge status={v.verificationStatus} />
                  </button>
                </li>
              ))}
            </ul>
            <Pager page={list.data!.page} total={list.data!.total} onPage={setPage} />
          </>
        )}
      </Card>
      <div className="min-w-0">
        {!selected ? <Card><EmptyState title="Choose a vehicle" text="Select a vehicle on the left to review its documents." /></Card> : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-semibold">{current?.registrationNumber ?? 'Vehicle'}</h2>{current && <p className="text-xs text-muted">{current.make} {current.model}</p>}</div>
              <Link to={`/vehicles/${selected}`}><Button variant="ghost">Open vehicle</Button></Link>
            </div>
            <DocumentsPanel kind="vehicles" subjectId={selected} canUpload={can(user, 'vehicles.manage')} compact />
            <Card className="p-5"><h3 className="mb-4 font-semibold">Verification history</h3>
              {history.isLoading ? <Spinner /> : history.isError ? <ErrorState error={history.error} onRetry={() => history.refetch()} /> : <HistoryTimeline entries={history.data!} kind={['VERIFICATION', 'DOCUMENT']} />}
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Verification() {
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<Status>('PENDING_REVIEW')
  const [search, setSearch] = useState('')
  const subject = params.get('subject') === 'vehicles' ? 'vehicles' : 'drivers'
  const setSubject = (s: 'drivers' | 'vehicles') => { setParams(new URLSearchParams({ subject: s }), { replace: true }) }

  return (
    <>
      <PageHeader title="Driver Verification" subtitle="Review the documents drivers and vehicles have submitted. A driver is approved only when every required document is approved and none has expired." />
      <Alert kind="info">Approving means a reviewer checked the document. It does not prove the document is genuine; use the checks your market requires.</Alert>
      <div className="my-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs label="What to review" value={subject} onChange={setSubject} items={[['drivers', 'Drivers'], ['vehicles', 'Vehicles']] as const} />
        <div className="w-full sm:w-72"><SearchInput value={search} onChange={setSearch} placeholder={subject === 'drivers' ? 'Search name, phone or ID' : 'Search plate, make or model'} /></div>
      </div>
      <div className="mb-5"><Tabs label="Status" value={status} onChange={setStatus} items={STATUSES} /></div>
      {subject === 'drivers' ? <DriversQueue status={status} search={search} /> : <VehiclesQueue status={status} search={search} />}
    </>
  )
}
