import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { usePricingVersion, usePricingVersions } from '@/api/hooks'
import { fmtDateTime } from '@/lib/labels'
import { useConfirm, useToast } from '@/components/feedback'
import Modal from '@/components/Modal'
import { ChangeRow } from '@/components/PricingReview'
import { Badge, Button, Card, EmptyState, ErrorState, Spinner } from '@/components/ui'

const SOURCE: Record<string, string> = { baseline: 'Starting point (before changes were recorded)', publish: 'Published', direct: 'Saved', rollback: 'Went back' }

function Detail({ version, current, canEdit, currency, nameOf, scopeOf, onClose }: { version: number; current: number | null; canEdit: boolean; currency: string; nameOf: (id: string) => string; scopeOf: (r: string | null) => string; onClose: () => void }) {
  const q = usePricingVersion(version)
  const confirm = useConfirm()
  const toast = useToast()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)

  async function rollback() {
    if (busy) return
    const ok = await confirm({
      title: `Go back to the pricing of version ${version}?`,
      message: 'These fare rules go live right away for new ride requests. Rides already booked keep their quoted fare. This is recorded as a new version, so you can go back again.',
      confirmLabel: 'Go back to this pricing', danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      const r = await api.business.rollbackPricing(version)
      await qc.invalidateQueries({ queryKey: ['biz'] })
      toast.success(`Pricing restored from version ${version} (now version ${r.version})`)
      onClose()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not go back') } finally { setBusy(false) }
  }

  return (
    <Modal title={`Pricing version ${version}`} onClose={onClose}>
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-sm font-semibold">What this version changed</h3>
            {q.data!.changes.length === 0
              ? <p className="text-sm text-muted">{version === 1 ? 'The pricing as it was before changes were recorded.' : 'Nothing differs from the version before.'}</p>
              : <ul className="divide-y divide-line rounded-lg border border-line">{q.data!.changes.map((c) => <ChangeRow key={c.key} change={c} name={nameOf(c.categoryId)} scope={scopeOf(c.regionId)} currency={currency} />)}</ul>}
          </section>
          {version !== current && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">If you go back to it, the live pricing changes like this</h3>
              {q.data!.comparedToNow.length === 0
                ? <p className="text-sm text-muted">The live pricing already matches this version.</p>
                : <ul className="divide-y divide-line rounded-lg border border-line">{q.data!.comparedToNow.map((c) => <ChangeRow key={c.key} change={c} name={nameOf(c.categoryId)} scope={scopeOf(c.regionId)} currency={currency} />)}</ul>}
            </section>
          )}
          {canEdit && version !== current && q.data!.comparedToNow.length > 0 && <div className="flex justify-end"><Button variant="danger" loading={busy} onClick={rollback}>Go back to this pricing</Button></div>}
        </div>
      )}
    </Modal>
  )
}

/** Every change to live pricing, newest first, with who made it and a way back. */
export default function PricingHistory({ canEdit, currency, nameOf, scopeOf }: { canEdit: boolean; currency: string; nameOf: (id: string) => string; scopeOf: (r: string | null) => string }) {
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<number | null>(null)
  const q = usePricingVersions(page)

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="border-b border-line p-4"><h2 className="font-semibold">Pricing history</h2><p className="text-sm text-muted">Every change to the live fare rules. Open one to see what changed or to go back to it.</p></div>
      {q.isLoading ? <div className="p-6"><Spinner /></div> : q.isError ? <div className="p-5"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div> : q.data!.items.length === 0 ? (
        <EmptyState title="No pricing changes recorded yet" text="The first time live pricing changes, it appears here together with how it was before." />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {q.data!.items.map((v) => {
              const s = v.summary
              const parts = s ? [s.added && `${s.added} added`, s.changed && `${s.changed} changed`, s.removed && `${s.removed} removed`].filter(Boolean).join(', ') : ''
              return (
                <li key={v.version}>
                  <button type="button" onClick={() => setOpen(v.version)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-brand dark:hover:bg-white/5">
                    <span className="w-12 shrink-0 font-semibold tabular-nums">v{v.version}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{SOURCE[v.source] ?? v.source}{parts ? ` · ${parts}` : ''}{v.rollbackOf ? ` · to version ${v.rollbackOf}` : ''}</span>
                      <span className="block text-xs text-muted">{fmtDateTime(v.at)}{v.by ? ` · ${v.by}` : ''}{v.note ? ` · “${v.note}”` : ''}</span>
                    </span>
                    {v.version === q.data!.current && <Badge kind="ok">Live now</Badge>}
                  </button>
                </li>
              )
            })}
          </ul>
          {q.data!.total > q.data!.pageSize && (
            <div className="flex items-center justify-between border-t border-line px-4 py-2 text-sm">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</Button>
              <span className="text-muted">Page {page} of {Math.ceil(q.data!.total / q.data!.pageSize)}</span>
              <Button variant="ghost" disabled={page * q.data!.pageSize >= q.data!.total} onClick={() => setPage(page + 1)}>Older</Button>
            </div>
          )}
        </>
      )}
      {open !== null && <Detail version={open} current={q.data?.current ?? null} canEdit={canEdit} currency={currency} nameOf={nameOf} scopeOf={scopeOf} onClose={() => setOpen(null)} />}
    </Card>
  )
}
