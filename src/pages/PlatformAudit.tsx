import { useEffect, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { platform } from '@/api'
import { dayEndIso, dayStartIso, fmtDateTime, useDebounced } from '@/lib/labels'
import type { PlatformAuditEntry } from '@/lib/types'
import DataTable, { SearchInput, type Column } from '@/components/DataTable'
import { Card, ErrorState, PageHeader, Spinner } from '@/components/ui'

const PAGE_SIZE = 25
const select = 'rounded-lg border border-line bg-bg px-3 py-2 text-sm'
const actionText = (a: string) => { const t = a.replace(/[._]/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1) }

/** Everything admins did, across every business and the platform itself. Details never include secrets, document numbers or links. */
export default function PlatformAudit() {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounced(search.trim())
  useEffect(() => setPage(1), [q, action, from, to])
  const params = { q, action, from: dayStartIso(from), to: dayEndIso(to), page, pageSize: PAGE_SIZE }
  const list = useQuery({ queryKey: ['platform-audit', params], queryFn: () => platform.audit(params), placeholderData: keepPreviousData })
  const filtered = !!(q || action || from || to)

  const columns: Column<PlatformAuditEntry>[] = [
    { header: 'When', cell: (e) => <span className="whitespace-nowrap text-xs">{fmtDateTime(e.at)}</span> },
    { header: 'Business', cell: (e) => <span className="text-sm">{e.businessName}</span> },
    { header: 'Who', cell: (e) => <span className="text-sm">{e.actorEmail ?? 'System'}</span> },
    { header: 'Action', cell: (e) => <div><div className="text-sm">{actionText(e.action)}</div><div className="font-mono text-[11px] text-muted">{e.action}</div></div> },
    { header: 'Target', cell: (e) => e.targetType ? <div><div className="text-sm capitalize">{e.targetType.replace(/_/g, ' ')}</div>{e.targetId && <div className="break-all font-mono text-[11px] text-muted">{e.targetId}</div>}</div> : <span className="text-muted">—</span> },
    { header: 'Details', cell: (e) => e.details ? <dl className="space-y-0.5 text-xs">{Object.entries(e.details).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="text-muted">{k}:</dt><dd className="break-all">{v}</dd></div>)}</dl> : <span className="text-muted">—</span> },
  ]

  return (
    <>
      <PageHeader title="Platform audit" subtitle="What admins did across every business and on the platform. Secrets, document numbers and file links are never recorded." />
      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <div className="min-w-[12rem] flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search who, action or target" /></div>
          <input aria-label="Action starts with" className={select} placeholder="Action, e.g. tenant." value={action} onChange={(e) => setAction(e.target.value)} />
          <label className="text-xs text-muted">From<input type="date" className={`${select} mt-1 block`} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-xs text-muted">To<input type="date" className={`${select} mt-1 block`} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
          {filtered && <button type="button" className="pb-2 text-sm underline" onClick={() => { setSearch(''); setAction(''); setFrom(''); setTo('') }}>Clear filters</button>}
        </div>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
          <DataTable rows={list.data!.items} columns={columns} rowKey={(e) => e.id} loading={list.isFetching}
            paging={{ page: list.data!.page, pageSize: list.data!.pageSize, total: list.data!.total, onPage: setPage }}
            empty={filtered ? { title: 'No events match', text: 'Try a wider date range or fewer filters.' } : { title: 'Nothing recorded yet' }} />
        )}
      </Card>
    </>
  )
}
