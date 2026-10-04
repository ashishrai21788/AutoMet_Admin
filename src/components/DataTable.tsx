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

/** Paging controlled by the server: the rows are already the current page. */
export interface ServerPaging {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}

/**
 * Table on wide screens, stacked cards on phones. By default it pages the rows it is given in the browser; with `paging`
 * the rows are one page from the server and the controls ask the parent for another.
 */
export default function DataTable<T>({
  rows, columns, rowKey, pageSize = 8, empty, paging, loading, onRowClick,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  pageSize?: number
  empty: { title: string; text?: string; action?: ReactNode }
  paging?: ServerPaging
  /** dims the table while the next page loads */
  loading?: boolean
  onRowClick?: (row: T) => void
}) {
  const [localPage, setLocalPage] = useState(0)
  const size = paging ? paging.pageSize : pageSize
  const total = paging ? paging.total : rows.length
  const pages = Math.max(1, Math.ceil(total / size))
  const page = paging ? paging.page - 1 : localPage
  useEffect(() => { if (!paging && localPage > pages - 1) setLocalPage(pages - 1) }, [paging, localPage, pages])
  const slice = paging ? rows : rows.slice(localPage * size, localPage * size + size)
  const go = (p: number) => (paging ? paging.onPage(p + 1) : setLocalPage(p))

  if (total === 0 && rows.length === 0) return <EmptyState {...empty} />

  const clickable = onRowClick ? 'cursor-pointer hover:bg-black/[.03] dark:hover:bg-white/5' : ''
  return (
    <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={loading}>
      {/* relative: the screen-reader-only header labels are absolutely positioned and must stay inside this scroller */}
      <div className="relative hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>{columns.map((c) => <th key={c.header} scope="col" className={`px-4 py-3 font-medium ${c.className ?? ''}`}>{c.hideLabel ? <span className="sr-only">{c.header}</span> : c.header}</th>)}</tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={`border-b border-line last:border-0 ${clickable}`}>
                {columns.map((c) => <td key={c.header} className={`px-4 py-3 align-middle ${c.className ?? ''}`}>{c.cell(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line sm:hidden">
        {slice.map((row) => (
          <li key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={`space-y-1.5 px-4 py-3 text-sm ${clickable}`}>
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
          <span className="text-muted">{page * size + 1}–{Math.min(total, (page + 1) * size)} of {total}</span>
          <div className="flex gap-2">
            <Button variant="ghost" aria-label="Previous page" disabled={page === 0} onClick={() => go(page - 1)}><ChevronLeft size={16} /></Button>
            <Button variant="ghost" aria-label="Next page" disabled={page >= pages - 1} onClick={() => go(page + 1)}><ChevronRight size={16} /></Button>
          </div>
        </nav>
      )}
    </div>
  )
}
