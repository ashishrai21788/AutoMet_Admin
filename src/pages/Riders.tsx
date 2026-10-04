import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRiders } from '@/api/hooks'
import { fmtDate, timeAgo, useDebounced } from '@/lib/labels'
import type { RiderItem } from '@/lib/types'
import DataTable, { SearchInput, type Column } from '@/components/DataTable'
import { Badge, Card, ErrorState, PageHeader, Spinner } from '@/components/ui'

const PAGE_SIZE = 15

export function RiderStatus({ status }: { status: string }) {
  const s = status.toUpperCase()
  return <Badge kind={s === 'ACTIVE' ? 'ok' : s === 'SUSPENDED' || s === 'BLOCKED' ? 'bad' : 'neutral'}>{s.charAt(0) + s.slice(1).toLowerCase()}</Badge>
}

export default function Riders() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounced(search.trim())
  useEffect(() => setPage(1), [q])
  const list = useRiders({ q, page, pageSize: PAGE_SIZE })

  const columns: Column<RiderItem>[] = [
    { header: 'Rider', cell: (r) => <div><div className="text-sm font-medium">{r.name}</div><div className="text-xs text-muted">{r.id}</div></div> },
    { header: 'Phone', cell: (r) => <div className="text-sm">{r.phone}{r.phoneVerified ? '' : <div className="text-xs text-muted">not verified</div>}</div> },
    { header: 'Trips', cell: (r) => <span className="text-sm">{r.trips.total}<span className="text-xs text-muted"> · {r.trips.completed} done</span></span> },
    { header: 'Joined', cell: (r) => <span className="whitespace-nowrap text-xs">{fmtDate(r.registeredAt)}</span> },
    { header: 'Last active', cell: (r) => <span className="whitespace-nowrap text-xs" title={r.lastActiveAt ?? undefined}>{timeAgo(r.lastActiveAt)}</span> },
    { header: 'Status', cell: (r) => <RiderStatus status={r.accountStatus} /> },
  ]

  return (
    <>
      <PageHeader title="Riders" subtitle="People who signed up through this business's rider app." />
      <Card>
        <div className="border-b border-line p-4"><div className="max-w-md"><SearchInput value={search} onChange={setSearch} placeholder="Search name, phone, email or ID" /></div></div>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
          <DataTable
            rows={list.data!.items} columns={columns} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/riders/${r.id}`)}
            loading={list.isFetching} paging={{ page: list.data!.page, pageSize: list.data!.pageSize, total: list.data!.total, onPage: setPage }}
            empty={q ? { title: 'No rider matches', text: 'Check the spelling or try the phone number.' } : { title: 'No riders yet', text: 'Riders appear here after they sign up in this business\'s rider app.' }}
          />
        )}
      </Card>
    </>
  )
}
