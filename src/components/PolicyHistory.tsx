import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/api'
import { usePolicyHistory } from '@/api/hooks'
import { fmtDateTime } from '@/lib/labels'
import { formatMoney } from '@/lib/geo'
import { useConfirm, useToast } from '@/components/feedback'
import { Badge, Button, Card, EmptyState, ErrorState, Spinner } from '@/components/ui'
import type { PolicyChange } from '@/lib/types'

const OP: Record<PolicyChange['op'], string> = { SAVE: 'Saved', DELETE: 'Removed', RESTORE: 'Restored an earlier version' }

/** A term as the business reads it: a fee in the business currency, a count, minutes or text. */
function show(field: string, value: number | string | null, currency: string): string {
  if (value === null) return 'none'
  if (field === 'conditions') return value === '' ? 'empty' : `“${value}”`
  if (field === 'rider.freeCancellationMinutes') return `${value} min`
  if (field === 'driver.graceCancellations') return String(value)
  return formatMoney(Number(value), currency)
}

/** Every change to a cancellation policy, newest first, with what each changed and a way to put the earlier terms back. */
export default function PolicyHistory({ canEdit, currency }: { canEdit: boolean; currency: string }) {
  const q = usePolicyHistory()
  const confirm = useConfirm()
  const toast = useToast()
  const qc = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)

  async function restore(item: PolicyChange) {
    if (busy) return
    const where = `${item.category ?? 'this category'}${item.region ? ` · ${item.region}` : ''}`
    const ok = await confirm({
      title: 'Put the earlier cancellation terms back?',
      message: `${where}: the terms from before this change apply again, right away, to cancellations from now on. Trips already cancelled keep the fee they were charged. This is recorded as a new change, so you can undo it too.`,
      confirmLabel: 'Put them back', danger: true,
    })
    if (!ok) return
    setBusy(item.id)
    try {
      try {
        await api.business.restorePolicy(item.id, false)
      } catch (err) {
        // changed again since: say so, and only overwrite if the person still wants to
        if (!(err instanceof ApiError) || err.status !== 409 || err.fieldErrors.code !== 'CHANGED_SINCE') throw err
        const again = await confirm({ title: 'This policy changed again since', message: `${err.message} Do you still want to put the earlier terms back?`, confirmLabel: 'Overwrite', danger: true })
        if (!again) return
        await api.business.restorePolicy(item.id, true)
      }
      await qc.invalidateQueries({ queryKey: ['biz'] })
      toast.success('Cancellation terms restored')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not restore') } finally { setBusy(null) }
  }

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="border-b border-line p-4"><h2 className="font-semibold">Cancellation policy history</h2><p className="text-sm text-muted">Every save and removal of a cancellation policy, with what changed. Put an earlier version back if a change was a mistake.</p></div>
      {q.isLoading ? <div className="p-6"><Spinner /></div> : q.isError ? <div className="p-5"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div> : q.data!.items.length === 0 ? (
        <EmptyState title="No policy changes recorded yet" text="The first time a cancellation policy is saved or removed, it appears here with how it was before." />
      ) : (
        <ul className="divide-y divide-line">
          {q.data!.items.map((c) => (
            <li key={c.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{OP[c.op]} · {c.category ?? 'Unknown category'}{c.region ? ` · ${c.region}` : ''}</span>
                  <span className="block text-xs text-muted">{fmtDateTime(c.at)}{c.by ? ` · ${c.by}` : ''}</span>
                </span>
                {c.op === 'DELETE' && <Badge kind="warn">Removed</Badge>}
                {canEdit && <Button variant="ghost" loading={busy === c.id} onClick={() => restore(c)}>Put earlier terms back</Button>}
              </div>
              {c.changes.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-sm text-muted">
                  {c.changes.map((f) => <li key={f.field}>{f.label}: {show(f.field, f.from, currency)} → {show(f.field, f.to, currency)}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
