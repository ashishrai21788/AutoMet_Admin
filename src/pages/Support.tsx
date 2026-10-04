import { useState, type FormEvent } from 'react'
import { usePage } from '@/lib/usePage'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { ApiError, ops } from '@/api'
import { useIssue, useIssues } from '@/api/hooks'
import { fmtDateTime, timeAgo, useDebounced } from '@/lib/labels'
import type { IssueItem, IssueStatus } from '@/lib/types'
import { useToast } from '@/components/feedback'
import { SearchInput } from '@/components/DataTable'
import { Badge, Button, Card, EmptyState, ErrorState, Field, PageHeader, SelectField, Spinner, Textarea } from '@/components/ui'

const TABS = [['', 'All'], ['issue submitted', 'New'], ['under process', 'In progress'], ['complete', 'Resolved']] as const
const LABEL: Record<IssueStatus, string> = { 'issue submitted': 'New', 'under process': 'In progress', complete: 'Resolved' }
const PAGE_SIZE = 12

export const IssueBadge = ({ status }: { status: IssueStatus }) => <Badge kind={status === 'complete' ? 'ok' : status === 'under process' ? 'warn' : 'bad'}>{LABEL[status]}</Badge>

function IssuePanel({ id }: { id: string }) {
  const toast = useToast()
  const qc = useQueryClient()
  const issue = useIssue(id)
  const [status, setStatus] = useState<IssueStatus | ''>('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (issue.isLoading) return <Spinner />
  if (issue.isError) return <ErrorState error={issue.error} onRetry={() => issue.refetch()} />
  const d = issue.data!
  const changed = (status !== '' && status !== d.status) || note.trim() !== ''

  async function save(e: FormEvent) {
    e.preventDefault()
    if (busy || !changed) return
    setBusy(true); setErrors({})
    try {
      await ops.support.update(id, { ...(status !== '' && status !== d.status ? { status } : {}), ...(note.trim() ? { note: note.trim() } : {}) })
      await qc.invalidateQueries({ queryKey: ['biz'] })
      setStatus(''); setNote('')
      toast.success('Saved')
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
      else toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><div className="flex items-center gap-2 font-semibold">{d.driverName}<Badge>{d.reporterType === 'rider' ? 'Rider' : 'Driver'}</Badge></div><div className="text-xs text-muted">{d.driverPhone ?? d.reporterId} · reported {fmtDateTime(d.createdAt)}</div></div>
          <IssueBadge status={d.status} />
        </div>
        <p className="mt-4 whitespace-pre-wrap break-words text-sm">{d.text}</p>
        {d.imageUrls.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Attached images">
            {d.imageUrls.map((u, i) => <li key={u}><a href={u} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs underline">Image {i + 1} <ExternalLink size={11} aria-hidden /></a></li>)}
          </ul>
        )}
        {d.imageCount > d.imageUrls.length && <p className="mt-2 text-xs text-muted">{d.imageCount - d.imageUrls.length} attachment(s) are not shown because they are not secure links.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={d.reporterType === 'rider' ? `/riders/${d.reporterId}` : `/drivers/${d.reporterId}`}><Button variant="ghost">{d.reporterType === 'rider' ? 'Open rider' : 'Open driver'}</Button></Link>
          {d.tripId && <Link to={`/trips/${d.tripId}`}><Button variant="ghost">Open trip {d.tripId}</Button></Link>}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 font-semibold">Update</h3>
        <form onSubmit={save} noValidate className="space-y-3">
          <SelectField label="Status" value={status || d.status} onChange={(e) => { setStatus(e.target.value as IssueStatus); setErrors({}) }} error={errors.status}>
            {(Object.keys(LABEL) as IssueStatus[]).map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
          </SelectField>
          <Field label="Internal note (the driver app shows the latest note)" error={errors.note}>
            {(p) => <Textarea {...p} rows={3} maxLength={1000} value={note} onChange={(e) => { setNote(e.target.value); setErrors({}) }} />}
          </Field>
          <Button type="submit" loading={busy} disabled={!changed}>Save</Button>
        </form>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 font-semibold">History</h3>
        {d.notes.length === 0 ? <p className="text-sm text-muted">Nobody has worked on this yet.</p> : (
          <ol className="space-y-3 border-l border-line pl-4">
            {[...d.notes].reverse().map((n, i) => (
              <li key={`${n.at}-${i}`} className="relative text-sm"><span aria-hidden className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-brand" />
                <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{n.by}</span>{n.status && <IssueBadge status={n.status} />}<span className="text-xs text-muted">{fmtDateTime(n.at)}</span></div>
                <p className="mt-0.5 whitespace-pre-wrap break-words">{n.text}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}

export default function Support() {
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<string>('')
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim())
  const [page, setPage] = usePage(JSON.stringify([status, q]))
  const list = useIssues({ status, q, page, pageSize: PAGE_SIZE })
  const selected = params.get('i') ?? ''
  const select = (id: string) => { const p = new URLSearchParams(params); p.set('i', id); setParams(p, { replace: true }) }
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1

  return (
    <>
      <PageHeader title="Support" subtitle="Problems reported by drivers and riders from the apps." action={list.data ? <Badge kind={list.data.open ? 'warn' : 'ok'}>{list.data.open} open</Badge> : undefined} />
      <div className="grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card>
          <div className="space-y-3 border-b border-line p-4">
            <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1">
              {TABS.map(([k, label]) => <button key={k || 'all'} type="button" role="tab" aria-selected={status === k} onClick={() => setStatus(k)} className={`rounded-full border px-3 py-1 text-sm ${status === k ? 'border-brand bg-brand/15 font-medium' : 'border-line text-muted hover:text-ink'}`}>{label}</button>)}
            </div>
            <SearchInput value={search} onChange={setSearch} placeholder="Search text or reporter" />
          </div>
          {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data!.items.length === 0 ? (
            <EmptyState title={status || q ? 'No reports match' : 'No reports yet'} text={status || q ? 'Try another status or search.' : 'Reports appear here when a driver or rider reports a problem from their app.'} />
          ) : (
            <>
              <ul className="divide-y divide-line" aria-label="Reports">
                {list.data!.items.map((i: IssueItem) => (
                  <li key={i.id}>
                    <button type="button" onClick={() => select(i.id)} aria-current={i.id === selected} className={`block w-full px-4 py-3 text-left hover:bg-black/[.03] dark:hover:bg-white/5 ${i.id === selected ? 'bg-brand/10' : ''}`}>
                      <div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5"><span className="truncate text-sm font-medium">{i.driverName}</span><span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">{i.reporterType}</span></span><IssueBadge status={i.status} /></div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{i.text}</p>
                      <div className="mt-1 text-[11px] text-muted">{timeAgo(i.createdAt)}{i.noteCount ? ` · ${i.noteCount} note${i.noteCount === 1 ? '' : 's'}` : ''}{i.imageCount ? ` · ${i.imageCount} image${i.imageCount === 1 ? '' : 's'}` : ''}</div>
                    </button>
                  </li>
                ))}
              </ul>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-line px-4 py-2 text-sm">
                  <span className="text-muted">Page {page} of {pages}</span>
                  <div className="flex gap-2"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></div>
                </div>
              )}
            </>
          )}
        </Card>
        <div className="min-w-0">{selected ? <IssuePanel key={selected} id={selected} /> : <Card><EmptyState title="Choose a report" text="Select a report on the left to read it, change its status and add notes." /></Card>}</div>
      </div>
    </>
  )
}
