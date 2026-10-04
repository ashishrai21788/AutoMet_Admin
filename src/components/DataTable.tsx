import { useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button, EmptyState } from './ui'

export interface Column<T> {
  header: string
  cell: (row: T) => ReactNode
  /** hide this column's label on the mobile card (for the primary and action cells) */
  hideLabel?: boolean
  className?: string
}

export function SearchInput({ value, onChange, placeholder = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-bg py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
      />
    </div>
  )
}

/** Table on wide screens, stacked cards on phones. Pages of `pageSize` rows. */
export default function DataTable<T>({
  rows, columns, rowKey, pageSize = 8, empty,
}: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; pageSize?: number; empty: { title: string; text?: string; action?: ReactNode } }) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  useEffect(() => { if (page > pages - 1) setPage(pages - 1) }, [page, pages])
  const slice = rows.slice(page * pageSize, page * pageSize + pageSize)

  if (rows.length === 0) return <EmptyState {...empty} />

  return (
    <div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>{columns.map((c) => <th key={c.header} scope="col" className={`px-4 py-3 font-medium ${c.className ?? ''}`}>{c.hideLabel ? <span className="sr-only">{c.header}</span> : c.header}</th>)}</tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr key={rowKey(row)} className="border-b border-line last:border-0">
                {columns.map((c) => <td key={c.header} className={`px-4 py-3 align-middle ${c.className ?? ''}`}>{c.cell(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line sm:hidden">
        {slice.map((row) => (
          <li key={rowKey(row)} className="space-y-1.5 px-4 py-3 text-sm">
            {columns.map((c) => (
              <div key={c.header} className={c.hideLabel ? 'pt-1' : 'flex justify-between gap-3'}>
                {!c.hideLabel && <span className="text-muted">{c.header}</span>}
                <span className={c.hideLabel ? '' : 'text-right'}>{c.cell(row)}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
          <span className="text-muted">{page * pageSize + 1}–{Math.min(rows.length, (page + 1) * pageSize)} of {rows.length}</span>
          <div className="flex gap-2">
            <Button variant="ghost" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></Button>
            <Button variant="ghost" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></Button>
          </div>
        </nav>
      )}
    </div>
  )
}
