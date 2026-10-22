import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/api'
import { usePricingDraft, useBusinessMutation } from '@/api/hooks'
import { FIELD_LABEL, showValue } from '@/lib/pricingLabels'
import type { PricingChange, PricingFieldChange } from '@/lib/types'
import { useConfirm, useToast } from '@/components/feedback'
import Modal from '@/components/Modal'
import { Alert, Badge, Button, Card, Field, Spinner, Toggle } from '@/components/ui'

const KIND_TEXT: Record<PricingChange['kind'], { label: string; kind: 'ok' | 'warn' | 'bad' }> = {
  ADDED: { label: 'New rule', kind: 'ok' }, CHANGED: { label: 'Changed', kind: 'warn' }, REMOVED: { label: 'Removed', kind: 'bad' },
}

/** One rule's change: what it is, and field by field what moves. */
export function ChangeRow({ change, name, scope, currency, onDiscard }: { change: PricingChange; name: string; scope: string; currency: string; onDiscard?: () => void }) {
  const k = KIND_TEXT[change.kind]
  const rows: PricingFieldChange[] = change.kind === 'CHANGED' ? change.fields : []
  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge kind={k.kind}>{k.label}</Badge>
        <span className="font-medium">{name}</span><span className="text-muted">{scope}</span>
        {onDiscard && <Button variant="ghost" className="ml-auto" onClick={onDiscard}>Discard</Button>}
      </div>
      {rows.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {rows.map((r) => (
            <li key={r.field} className="grid gap-1 sm:grid-cols-[9rem_1fr]"><span className="text-muted">{FIELD_LABEL[r.field] ?? r.field}</span><span>{showValue(r.field, r.from, currency)} <span className="text-muted">→</span> <strong>{showValue(r.field, r.to, currency)}</strong></span></li>
          ))}
        </ul>
      )}
      {change.kind === 'ADDED' && <p className="mt-1 text-xs text-muted">Base {showValue('baseFare', change.fields.find((f) => f.field === 'baseFare')?.to, currency)}, per km {showValue('perKm', change.fields.find((f) => f.field === 'perKm')?.to, currency)}, per minute {showValue('perMinute', change.fields.find((f) => f.field === 'perMinute')?.to, currency)}</p>}
    </li>
  )
}

/**
 * The pricing workflow switch and, when changes wait to be published, the list of them with Publish and Discard.
 * Riders keep being priced by the live rules until Publish.
 */
export default function PricingReview({ canEdit, currency, nameOf, scopeOf }: { canEdit: boolean; currency: string; nameOf: (categoryId: string) => string; scopeOf: (regionId: string | null) => string }) {
  const q = usePricingDraft()
  const toast = useToast()
  const confirm = useConfirm()
  const qc = useQueryClient()
  const [publishing, setPublishing] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const mode = useBusinessMutation((m: 'direct' | 'draft') => api.business.setPricingWorkflow(m), { success: 'Pricing workflow changed' })

  if (q.isLoading) return <Card className="mb-6 p-5"><Spinner /></Card>
  if (q.isError) return null
  const d = q.data!
  const draftMode = d.mode === 'draft'
  const stale = new Set(d.stale)

  async function run(fn: () => Promise<unknown>, ok: string) {
    if (busy) return
    setBusy(true)
    try { await fn(); await qc.invalidateQueries({ queryKey: ['biz'] }); toast.success(ok) } catch (err) {
      const detail = err instanceof ApiError ? ((err.fieldErrors as Record<string, unknown>).problems ? 'Some drafts cannot be published. Fix or discard them.' : err.message) : err instanceof Error ? err.message : 'Something went wrong'
      toast.error(detail)
    } finally { setBusy(false) }
  }

  async function discardAll() {
    if (!(await confirm({ title: 'Discard all pending pricing changes?', message: 'The drafts are deleted. The live pricing is not touched.', confirmLabel: 'Discard', danger: true }))) return
    await run(() => api.business.discardPricingDraft(), 'Pending changes discarded')
  }

  return (
    <>
      <Card className="mb-6 p-5">
        <Toggle label="Review pricing changes before they go live" checked={draftMode} disabled={!canEdit || mode.isPending} onChange={(on) => mode.mutate(on ? 'draft' : 'direct')} />
        <p className="mt-2 text-sm text-muted">
          {draftMode
            ? 'On: saving a fare rule saves a draft. Riders keep being priced by the live rules until you publish all pending changes together.'
            : 'Off: a saved fare rule goes live for new ride requests at once. Turn on to prepare several changes and publish them together.'}
          {mode.error instanceof ApiError && mode.error.status === 409 ? <span className="block text-danger">{mode.error.message}</span> : null}
        </p>
      </Card>

      {draftMode && d.changes.length > 0 && (
        <Card className="mb-6 overflow-hidden border-warn/50">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><h2 className="font-semibold">Pending pricing changes ({d.changes.length})</h2><p className="text-sm text-muted">Not live yet. Nothing changes for riders until you publish.</p></div>
            {canEdit && <div className="flex gap-2"><Button variant="ghost" disabled={busy} onClick={discardAll}>Discard all</Button><Button disabled={busy || stale.size > 0} onClick={() => setPublishing(true)}>Publish changes</Button></div>}
          </div>
          {stale.size > 0 && <div className="px-4 pb-3"><Alert kind="warn">Live pricing changed after some drafts were made (marked below). Discard those drafts and make them again before publishing.</Alert></div>}
          <ul className="divide-y divide-line border-t border-line">
            {d.changes.map((c) => (
              <ChangeRow key={c.key} change={c} name={nameOf(c.categoryId)} scope={`${scopeOf(c.regionId)}${stale.has(c.key) ? ' · live pricing changed since' : ''}`} currency={currency}
                onDiscard={canEdit ? () => run(() => api.business.discardPricingDraft(c.key), 'Draft discarded') : undefined} />
            ))}
          </ul>
        </Card>
      )}

      {publishing && (
        <Modal title="Publish pricing changes" onClose={() => setPublishing(false)}>
          <div className="space-y-4">
            <p className="text-sm">{d.changes.length} change{d.changes.length === 1 ? '' : 's'} go live for new ride requests right away. Rides already booked keep the fare they were quoted. You can go back to the earlier pricing from the history below.</p>
            <Field label="Note (optional)" hint="Shown in the pricing history, for example why prices changed.">{(p) => <input {...p} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />}</Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPublishing(false)}>Cancel</Button>
              <Button loading={busy} onClick={async () => { await run(() => api.business.publishPricing(note.trim()), 'Pricing published'); setPublishing(false); setNote('') }}>Publish now</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
