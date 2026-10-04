import { useState } from 'react'
import { usePage } from '@/lib/usePage'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCategories, useRegions, useTrips } from '@/api/hooks'
import { dayEndIso, dayStartIso, fmtDateTime, fmtMoney, regionLabel, useDebounced } from '@/lib/labels'
import type { TripItem } from '@/lib/types'
import DataTable, { SearchInput, type Column } from '@/components/DataTable'
import ExportButton from '@/components/ExportButton'
import { TripStatusBadge } from '@/components/StatusBadge'
import { Alert, Card, ErrorState, PageHeader, Spinner } from '@/components/ui'

const GROUPS = [
  ['', 'All'], ['searching', 'Searching'], ['active', 'Active'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['unanswered', 'No driver response'],
] as const
const PAGE_SIZE = 15
const select = 'rounded-lg border border-line bg-bg px-3 py-2 text-sm'

export function RouteCell({ from, to }: { from: string; to: string }) {
  return (
    <div className="max-w-[16rem] text-xs">
      <div className="truncate" title={from}>{from || '—'}</div>
      <div className="truncate text-muted" title={to}>→ {to || '—'}</div>
    </div>
  )
}

export default function Trips() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const group = params.get('group') ?? ''
  const [search, setSearch] = useState('')
  const [regionId, setRegionId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const q = useDebounced(search.trim())
  const [page, setPage] = usePage(JSON.stringify([group, q, regionId, categoryId, from, to]))

  const regions = useRegions()
  const categories = useCategories()
  const list = useTrips({
    statusGroup: group, q, regionId, categoryId, from: dayStartIso(from), to: dayEndIso(to), page, pageSize: PAGE_SIZE,
    riderId: params.get('riderId') ?? undefined, driverId: params.get('driverId') ?? undefined,
  })
  const filtered = !!(group || q || regionId || categoryId || from || to || params.get('riderId') || params.get('driverId'))
  const setGroup = (g: string) => { const p = new URLSearchParams(params); if (g) p.set('group', g); else p.delete('group'); setParams(p, { replace: true }) }
  const clearOwner = () => { const p = new URLSearchParams(params); p.delete('riderId'); p.delete('driverId'); setParams(p, { replace: true }) }

  const columns: Column<TripItem>[] = [
    { header: 'Trip', cell: (t) => <span className="font-mono text-xs">{t.id}</span> },
    { header: 'Requested', cell: (t) => <span className="whitespace-nowrap text-xs">{fmtDateTime(t.requestedAt)}</span> },
    { header: 'Rider', cell: (t) => <div><div className="text-sm">{t.rider.name ?? '—'}</div><div className="text-xs text-muted">{t.rider.phone ?? t.rider.id}</div></div> },
    { header: 'Driver', cell: (t) => <span className="text-sm">{t.driver.name ?? t.driver.id}</span> },
    { header: 'Route', cell: (t) => <RouteCell from={t.pickup} to={t.drop} /> },
    { header: 'Fare', cell: (t) => <div className="whitespace-nowrap text-sm">{fmtMoney(t.fare, t.currency)}{t.fare !== null && t.fareBasis === 'ESTIMATE' && <div className="text-xs text-muted">estimate</div>}</div> },
    { header: 'Status', cell: (t) => <TripStatusBadge status={t.status} cancelledBy={t.cancelledBy} /> },
  ]

  return (
    <>
      <PageHeader title="Trips" subtitle="Every ride request of this business, from search to completion. The list refreshes every 30 seconds."
        action={<ExportButton fileName="trips.csv" path={`/api/admin/business/export/trips.csv?${new URLSearchParams(Object.entries({ statusGroup: group, regionId, categoryId, from: from || undefined, to: to || undefined, driverId: params.get('driverId') ?? undefined }).filter(([, v]) => v) as [string, string][]).toString()}`} />} />
      <div className="mb-4 flex flex-wrap gap-1" role="tablist" aria-label="Trip status">
        {GROUPS.map(([k, label]) => (
          <button key={k || 'all'} type="button" role="tab" aria-selected={group === k} onClick={() => setGroup(k)}
            className={`rounded-full border px-3 py-1 text-sm ${group === k ? 'border-brand bg-brand/15 font-medium' : 'border-line text-muted hover:text-ink'}`}>{label}</button>
        ))}
      </div>
      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <div className="min-w-[12rem] flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search by trip ID" /></div>
          <select aria-label="Region" className={select} value={regionId} onChange={(e) => setRegionId(e.target.value)}>
            <option value="">All regions</option>
            {regions.data?.map((r) => <option key={r.id} value={r.id}>{regionLabel(r)}</option>)}
          </select>
          <select aria-label="Vehicle category" className={select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="text-xs text-muted">From<input type="date" className={`${select} mt-1 block`} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-xs text-muted">To<input type="date" className={`${select} mt-1 block`} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        {(params.get('riderId') || params.get('driverId')) && (
          <div className="border-b border-line px-4 py-2 text-sm">
            Showing trips of {params.get('riderId') ? `rider ${params.get('riderId')}` : `driver ${params.get('driverId')}`}. <button type="button" className="underline" onClick={clearOwner}>Show all trips</button>
          </div>
        )}
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
          <DataTable
            rows={list.data!.items} columns={columns} rowKey={(t) => t.id} onRowClick={(t) => navigate(`/trips/${t.id}`)}
            loading={list.isFetching} paging={{ page: list.data!.page, pageSize: list.data!.pageSize, total: list.data!.total, onPage: setPage }}
            empty={filtered
              ? { title: 'No trips match', text: 'Try a different status, date range or search.' }
              : { title: 'No trips yet', text: 'Trips appear here as soon as riders of this business request rides.' }}
          />
        )}
      </Card>
      {list.isError && <div className="mt-4"><Alert kind="error">Trips could not be loaded.</Alert></div>}
    </>
  )
}
