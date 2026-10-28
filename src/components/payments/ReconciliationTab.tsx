import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ops } from '@/api'
import { useBusinessMutation, useFindings } from '@/api/hooks'
import { findingLabel, type Finding, type ReconcileRun } from '@/lib/payments'
import { fmtDateTime } from '@/lib/labels'
import ReasonModal from '@/components/ReasonModal'
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Spinner } from '@/components/ui'

const TABS: ['open' | 'resolved' | '', string][] = [['open', 'Open'], ['resolved', 'Resolved'], ['', 'All']]

/**
 * Differences between our payments, the ledger, the rides and the provider. Running it only looks: it never changes a payment or the
 * books. A finding stays open until a person writes what was done about it, and comes back if the problem is still there.
 */
export default function ReconciliationTab({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = useState<'open' | 'resolved' | ''>('open')
  const [last, setLast] = useState<ReconcileRun | null>(null)
  const [resolving, setResolving] = useState<Finding | null>(null)
  const q = useFindings(status)
  const qc = useQueryClient()
  const run = useBusinessMutation(() => ops.payments.reconcile(), {
    success: (r) => (r.discrepancies.length === 0 ? 'Checked: everything agrees' : `Checked: ${r.discrepancies.length} difference${r.discrepancies.length === 1 ? '' : 's'} found`),
    onSuccess: setLast,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted">Compares payments, the ledger, rides and the provider's own records. It finds differences; it never adjusts anything.</p>
        {canManage && <Button loading={run.isPending} onClick={() => run.mutate(undefined as never)}>Run the check</Button>}
      </div>

      {last && (
        <Alert kind={last.discrepancies.length ? 'warn' : 'info'}>
          Checked {last.checked.payments ?? 0} payments, {last.checked.trips ?? 0} rides, {last.checked.refunds ?? 0} refunds and {last.checked.ledgerTransactions ?? 0} ledger entries. {last.newCount} new finding{last.newCount === 1 ? '' : 's'}.
          {last.skippedProviderChecks > 0 && ` ${last.skippedProviderChecks} check${last.skippedProviderChecks === 1 ? ' was' : 's were'} skipped because the provider could not be asked: those are not "fine", they are unchecked.`}
        </Alert>
      )}

      <div role="tablist" aria-label="Findings" className="flex gap-1">
        {TABS.map(([key, label]) => (
          <button key={label} role="tab" aria-selected={status === key} onClick={() => setStatus(key)} className={`rounded-lg px-3 py-1.5 text-sm ${status === key ? 'bg-brand/20 font-medium' : 'text-muted hover:bg-black/5 dark:hover:bg-white/5'}`}>{label}</button>
        ))}
      </div>

      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (q.data!.items.length === 0
        ? <Card><EmptyState title={status === 'open' ? 'Nothing open' : 'Nothing here'} text={status === 'open' ? 'Run the check to look for differences.' : undefined} /></Card>
        : (
          <ul className="space-y-3">
            {q.data!.items.map((f) => (
              <li key={f.discrepancyId}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{findingLabel(f.type)}</div>
                      <div className="text-sm text-muted">{f.detail}</div>
                      <div className="mt-1 text-xs text-muted">
                        {f.ref && /^pay_/.test(f.ref) ? <>Payment <Link className="underline" to={`/collections?payment=${f.ref}`}>{f.ref}</Link> · </> : f.ref ? <>Reference {f.ref} · </> : null}
                        First seen {fmtDateTime(f.firstSeenAt)} · last seen {fmtDateTime(f.lastSeenAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {f.reopenedCount > 0 && <Badge kind="warn">Came back {f.reopenedCount}×</Badge>}
                      <Badge kind={f.status === 'OPEN' ? 'bad' : 'ok'}>{f.status === 'OPEN' ? 'Open' : 'Resolved'}</Badge>
                    </div>
                  </div>
                  {f.status === 'RESOLVED' && <p className="mt-2 text-sm"><span className="text-muted">What was done ({f.resolvedBy}):</span> {f.resolutionNote}</p>}
                  {canManage && f.status === 'OPEN' && <div className="mt-3"><Button variant="ghost" onClick={() => setResolving(f)}>Record what was done…</Button></div>}
                </Card>
              </li>
            ))}
          </ul>
        ))}

      {resolving && (
        <ReasonModal
          title="Record what was done"
          intro={<>Finding: <strong>{findingLabel(resolving.type)}</strong>. Writing this does not change any payment or the books; it records who looked at it and what they did. If the problem is still there the next check reopens it.</>}
          label="What was done"
          confirmLabel="Mark resolved"
          danger={false}
          successText="Recorded"
          onSubmit={async (note) => { await ops.payments.resolveFinding(resolving.discrepancyId, note); await qc.invalidateQueries({ queryKey: ['biz'] }) }}
          onClose={() => setResolving(null)}
        />
      )}
    </div>
  )
}
