import { useState } from 'react'
import { usePage } from '@/lib/usePage'
import { useAudit } from '@/api/hooks'
import { dayEndIso, dayStartIso, fmtDateTime, useDebounced } from '@/lib/labels'
import type { AuditEntry } from '@/lib/types'
import DataTable, { SearchInput, type Column } from '@/components/DataTable'
import ExportButton from '@/components/ExportButton'
import { Card, ErrorState, PageHeader, Spinner } from '@/components/ui'

const PAGE_SIZE = 20
const select = 'rounded-lg border border-line bg-bg px-3 py-2 text-sm'

/** "driver.status_changed" -> "Driver status changed" */
const actionText = (a: string) => { const t = a.replace(/[._]/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1) }

function Details({ details }: { details: AuditEntry['details'] }) {
  if (!details) return <span className="text-muted">—</span>
  return (
    <dl className="space-y-0.5 text-xs">
      {Object.entries(details).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="text-muted">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}:</dt><dd className="break-all">{v}</dd></div>)}
    </dl>
  )
}

export default function AuditLog() {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [targetType, setTargetType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const q = useDebounced(search.trim())
  const [page, setPage] = usePage(JSON.stringify([q, action, actor, targetType, from, to]))

  const list = useAudit({ q, action, actor, targetType, from: dayStartIso(from), to: dayEndIso(to), page, pageSize: PAGE_SIZE })
  const facets = list.data?.facets
  const filtered = !!(q || action || actor || targetType || from || to)
  const clear = () => { setSearch(''); setAction(''); setActor(''); setTargetType(''); setFrom(''); setTo('') }

  const columns: Column<AuditEntry>[] = [
    { header: 'When', cell: (e) => <span className="whitespace-nowrap text-xs">{fmtDateTime(e.at)}</span> },
    { header: 'Who', cell: (e) => <span className="text-sm">{e.actorEmail ?? 'System'}</span> },
    { header: 'Action', cell: (e) => <div><div className="text-sm">{actionText(e.action)}</div><div className="font-mono text-[11px] text-muted">{e.action}</div></div> },
    { header: 'Target', cell: (e) => e.targetType ? <div><div className="text-sm capitalize">{e.targetType.replace(/_/g, ' ')}</div>{e.targetId && <div className="break-all font-mono text-[11px] text-muted">{e.targetId}</div>}</div> : <span className="text-muted">—</span> },
    { header: 'Details', cell: (e) => <Details details={e.details} /> },
  ]

  return (
    <>
      <PageHeader title="Audit log" subtitle="Who did what in this business. Secrets, document numbers and file links are never recorded here."
        action={<ExportButton fileName="audit-log.csv" path={`/api/admin/business/audit.csv?${new URLSearchParams(Object.entries({ q, action, actor, targetType, from: dayStartIso(from), to: dayEndIso(to) }).filter(([, v]) => v) as [string, string][]).toString()}`} />} />
      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <div className="min-w-[12rem] flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search who, action or target" /></div>
          <select aria-label="Action" className={select} value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            {facets?.actions.map((a) => <option key={a} value={a}>{actionText(a)}</option>)}
          </select>
          <select aria-label="Person" className={select} value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">Everyone</option>
            {facets?.actors.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select aria-label="Target" className={select} value={targetType} onChange={(e) => setTargetType(e.target.value)}>
            <option value="">All targets</option>
            {facets?.targetTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <label className="text-xs text-muted">From<input type="date" className={`${select} mt-1 block`} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-xs text-muted">To<input type="date" className={`${select} mt-1 block`} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
          {filtered && <button type="button" className="pb-2 text-sm underline" onClick={clear}>Clear filters</button>}
        </div>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
          <DataTable
            rows={list.data!.items} columns={columns} rowKey={(e) => e.id} pageSize={PAGE_SIZE} loading={list.isFetching}
            paging={{ page: list.data!.page, pageSize: list.data!.pageSize, total: list.data!.total, onPage: setPage }}
            empty={filtered ? { title: 'No events match', text: 'Try a wider date range or fewer filters.' } : { title: 'Nothing recorded yet', text: 'Changes made by this business\'s admins appear here.' }}
          />
        )}
      </Card>
    </>
  )
}
