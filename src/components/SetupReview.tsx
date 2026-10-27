import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/api'
import { useBusinessMutation, useRegions, useSetupDraft } from '@/api/hooks'
import { SETUP_FIELD_LABEL, showSetupValue } from '@/lib/setupLabels'
import type { SetupChange } from '@/lib/types'
import { useConfirm, useToast } from '@/components/feedback'
import Modal from '@/components/Modal'
import { Alert, Badge, Button, Card, Field, Spinner, Toggle } from '@/components/ui'

const KIND: Record<SetupChange['kind'], { label: string; kind: 'ok' | 'warn' }> = { ADDED: { label: 'New', kind: 'ok' }, CHANGED: { label: 'Changed', kind: 'warn' } }

/**
 * The review switch for regions and categories and, when changes wait to be published, the list of them with Publish and Discard.
 * Riders and drivers keep seeing the live regions and categories until Publish. Shown on both the Regions and the Categories page.
 */
export default function SetupReview({ canEdit }: { canEdit: boolean }) {
  const q = useSetupDraft()
  const regions = useRegions()
  const toast = useToast()
  const confirm = useConfirm()
  const qc = useQueryClient()
  const [publishing, setPublishing] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const mode = useBusinessMutation((m: 'direct' | 'draft') => api.business.setSetupWorkflow(m), { success: 'Setup workflow changed' })

  if (q.isLoading) return <Card className="mb-6 p-5"><Spinner /></Card>
  if (q.isError) return null
  const d = q.data!
  const draftMode = d.mode === 'draft'
  const stale = new Set(d.stale)
  const regionName = (id: string) => { const r = regions.data?.find((x) => x.id === id); return r ? `${r.city} (${r.zoneName})` : id }

  async function run(fn: () => Promise<unknown>, ok: string) {
    if (busy) return
    setBusy(true)
    try { await fn(); await qc.invalidateQueries({ queryKey: ['biz'] }); toast.success(ok) } catch (err) {
      const problems = err instanceof ApiError ? (err.fieldErrors as Record<string, unknown>).problems : undefined
      toast.error(err instanceof ApiError ? (problems ? 'Some changes cannot be published. Fix or discard them.' : err.message) : 'Something went wrong. Please try again.')
    } finally { setBusy(false) }
  }

  async function discardAll() {
    if (!(await confirm({ title: 'Discard all pending changes?', message: 'The drafts are deleted. The live regions and categories are not touched.', confirmLabel: 'Discard', danger: true }))) return
    await run(() => api.business.discardSetupDraft(), 'Pending changes discarded')
  }

  return (
    <>
      <Card className="mb-6 p-5">
        <Toggle label="Review region and category changes before they go live" checked={draftMode} disabled={!canEdit || mode.isPending} onChange={(on) => mode.mutate(on ? 'draft' : 'direct')} />
        <p className="mt-2 text-sm text-muted">
          {draftMode
            ? 'On: saving a region or category saves a draft. Riders and drivers keep seeing the live ones until you publish all pending changes together.'
            : 'Off: a saved region or category goes live at once. Turn on to prepare several changes and publish them together.'}
          {mode.error instanceof ApiError && mode.error.status === 409 ? <span className="block text-danger">{mode.error.message}</span> : null}
        </p>
      </Card>

      {draftMode && d.changes.length > 0 && (
        <Card className="mb-6 overflow-hidden border-warn/50">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <h2 className="font-semibold">Pending changes ({d.changes.length})</h2>
              <p className="text-sm text-muted">Not live yet. {d.summary.added} new, {d.summary.changed} changed.</p>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Button variant="ghost" disabled={busy} onClick={discardAll}>Discard all</Button>
                <Button disabled={busy || stale.size > 0} onClick={() => setPublishing(true)}>Publish changes</Button>
              </div>
            )}
          </div>
          {stale.size > 0 && <div className="px-4 pb-3"><Alert kind="warn">Something changed after some drafts were made (marked below). Discard those drafts and make them again.</Alert></div>}
          <ul className="divide-y divide-line border-t border-line">
            {d.changes.map((c) => (
              <li key={c.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge kind={KIND[c.kind].kind}>{KIND[c.kind].label} {c.entity}</Badge>
                  <span className="font-medium">{c.label}</span>
                  {stale.has(c.id) && <span className="text-xs text-danger">changed since this draft was made</span>}
                  {canEdit && <Button variant="ghost" className="ml-auto" disabled={busy} onClick={() => run(() => api.business.discardSetupDraft(c.id), 'Draft discarded')}>Discard</Button>}
                </div>
                {c.fields.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {c.fields.map((f) => (
                      <li key={f.field} className="grid gap-1 sm:grid-cols-[9rem_1fr]">
                        <span className="text-muted">{SETUP_FIELD_LABEL[f.field] ?? f.field}</span>
                        <span>{c.kind === 'CHANGED' ? `${showSetupValue(f.field, f.from, regionName)} → ${showSetupValue(f.field, f.to, regionName)}` : showSetupValue(f.field, f.to, regionName)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {publishing && (
        <Modal title="Publish pending changes" onClose={() => setPublishing(false)}>
          <div className="space-y-4">
            <p className="text-sm">{d.changes.length} change{d.changes.length === 1 ? '' : 's'} go live together, right away. If anything cannot be applied, nothing is applied.</p>
            <Field label="Note (optional)" hint="Kept in the audit log, for example why the areas changed.">{(p) => <input {...p} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />}</Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPublishing(false)}>Cancel</Button>
              <Button loading={busy} onClick={async () => { await run(() => api.business.publishSetup(note.trim()), 'Changes published'); setPublishing(false); setNote('') }}>Publish</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
