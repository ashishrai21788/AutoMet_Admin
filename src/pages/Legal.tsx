import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, ops } from '@/api'
import { useLegal, useLegalAcceptances, useLegalVersions } from '@/api/hooks'
import { useAuth } from '@/store/auth'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { fmtDateTime } from '@/lib/labels'
import type { LegalDoc, LegalOverviewItem } from '@/lib/types'
import { useToast } from '@/components/feedback'
import Modal from '@/components/Modal'
import { Badge, Button, Card, EmptyState, ErrorState, Field, PageHeader, Spinner } from '@/components/ui'

/** The same plain-text rules the server uses (blank line = new paragraph, "# " heading, "- " bullets), escaped, for the preview. */
function Preview({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  return (
    <div className="space-y-3 text-sm">
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) return <p key={i} className="font-semibold">{lines[0].replace(/^#{1,3}\s+/, '')}</p>
        if (lines.every((l) => /^[-*]\s+/.test(l))) return <ul key={i} className="list-disc pl-5">{lines.map((l, j) => <li key={j}>{l.replace(/^[-*]\s+/, '')}</li>)}</ul>
        return <p key={i} className="whitespace-pre-line">{b.replace(/^#{1,3}\s+/gm, '')}</p>
      })}
    </div>
  )
}

function Editor({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [title, setTitle] = useState(doc.title)
  const [content, setContent] = useState(doc.content)
  const [consent, setConsent] = useState(doc.consentRequired)
  const [note, setNote] = useState(doc.changeNote)
  const [busy, setBusy] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function save(e?: FormEvent) {
    e?.preventDefault()
    if (busy) return false
    setBusy('save'); setErrors({})
    try { await ops.legal.update(doc.id, { title, content, consentRequired: consent, changeNote: note }); await qc.invalidateQueries({ queryKey: ['biz'] }); return true }
    catch (err) { if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors); else toast.error(err instanceof Error ? err.message : 'Could not save'); return false }
    finally { setBusy('') }
  }

  return (
    <Modal title={`${doc.title}: version ${doc.version} (draft)`} onClose={onClose} wide>
      <form onSubmit={async (e) => { if (await save(e)) { toast.success('Draft saved'); onClose() } }} noValidate className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" error={errors.title}>{(p) => <input {...p} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />}</Field>
          <Field label="What changed (for your records)" error={errors.changeNote}>{(p) => <input {...p} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />}</Field>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Field label="Text" error={errors.content} hint="Blank line for a new paragraph. Start a line with # for a heading, or with - for a bullet.">
            {(p) => <textarea {...p} rows={16} value={content} onChange={(e) => setContent(e.target.value)} />}
          </Field>
          <div><div className="mb-1 text-xs font-medium text-muted">Preview</div><div className="max-h-96 overflow-auto rounded-lg border border-line p-3"><Preview text={content} /></div></div>
        </div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>People must agree to this version before they continue<span className="block text-xs text-muted">Riders and drivers are asked the next time they open the app, and again whenever you publish a new version.</span></span></label>
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="danger" loading={busy === 'del'} onClick={async () => { setBusy('del'); try { await ops.legal.remove(doc.id); await qc.invalidateQueries({ queryKey: ['biz'] }); toast.success('Draft deleted'); onClose() } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not delete') } finally { setBusy('') } }}>Delete draft</Button>
          <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Close</Button><Button type="submit" loading={busy === 'save'}>Save draft</Button></div>
        </div>
      </form>
    </Modal>
  )
}

function PublishModal({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  async function go(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErrors({})
    try { await ops.legal.publish(doc.id, when ? new Date(when).toISOString() : undefined); await qc.invalidateQueries({ queryKey: ['biz'] }); toast.success('Published'); onClose() }
    catch (err) { if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors); else toast.error(err instanceof Error ? err.message : 'Could not publish') }
    finally { setBusy(false) }
  }
  return (
    <Modal title={`Publish version ${doc.version}`} onClose={onClose}>
      <form onSubmit={go} noValidate className="space-y-3">
        <p className="text-sm">Once published, this version cannot be edited or deleted. A correction is a new version. Riders and drivers see it in the app and on its public web page.{doc.consentRequired ? ' They will be asked to agree to it.' : ''}</p>
        <Field label="Starts to apply" error={errors.effectiveAt} hint="Leave empty to apply now. Choose a later date to publish ahead of time.">{(p) => <input {...p} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />}</Field>
        {errors.content && <p role="alert" className="text-xs text-danger">{errors.content}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Publish</Button></div>
      </form>
    </Modal>
  )
}

function History({ type }: { type: string }) {
  const q = useLegalVersions(type, { page: 1, pageSize: 20 })
  if (q.isLoading) return <Spinner />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  return (
    <ul className="mt-3 divide-y divide-line border-t border-line text-sm">
      {q.data!.items.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>Version {d.version}{d.changeNote ? ` · ${d.changeNote}` : ''}</span>
          <span className="text-xs text-muted">{d.status === 'PUBLISHED' ? `Published ${fmtDateTime(d.publishedAt ?? d.createdAt)}, applies from ${fmtDateTime(d.effectiveAt ?? d.createdAt)}` : 'Draft'}</span>
        </li>
      ))}
    </ul>
  )
}

function TypeCard({ item, canManage, counts }: { item: LegalOverviewItem; canManage: boolean; counts: { riders: number; drivers: number } | undefined }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<LegalDoc | null>(null)
  const [publishing, setPublishing] = useState<LegalDoc | null>(null)
  const [history, setHistory] = useState(false)
  const [busy, setBusy] = useState(false)
  const cur = item.inForce
  const { tenantId } = useScope()
  const url = cur && tenantId ? `${(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')}/legal/${tenantId}/${item.type}` : ''

  async function start() {
    if (busy) return
    setBusy(true)
    try { const d = await ops.legal.createDraft(item.type, { title: item.label }); await qc.invalidateQueries({ queryKey: ['biz'] }); setEditing(d) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not start a draft') } finally { setBusy(false) }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><div className="font-semibold">{item.label}</div><div className="text-xs text-muted">For {item.audience.map((a) => (a === 'rider' ? 'riders' : 'drivers')).join(' and ')}</div></div>
        <div className="flex gap-1">
          {cur ? <Badge kind="ok">Version {cur.version} in force</Badge> : <Badge kind="warn">Not published: the apps use their built-in text</Badge>}
          {item.scheduled && <Badge kind="warn">Version {item.scheduled.version} from {fmtDateTime(item.scheduled.effectiveAt ?? '')}</Badge>}
          {item.draft && <Badge>Draft v{item.draft.version}</Badge>}
        </div>
      </div>
      {cur && (
        <p className="mt-2 text-xs text-muted">In force since {fmtDateTime(cur.effectiveAt ?? cur.createdAt)}{cur.consentRequired ? ' · agreement required' : ''}{counts ? ` · agreed by ${counts.riders} rider${counts.riders === 1 ? '' : 's'} and ${counts.drivers} driver${counts.drivers === 1 ? '' : 's'}` : ''}. Public page: <code className="break-all">{url}</code></p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {canManage && item.draft && <Button onClick={() => setEditing(item.draft)}>Edit draft</Button>}
        {canManage && item.draft && <Button variant="ghost" onClick={() => setPublishing(item.draft)}>Publish…</Button>}
        {canManage && !item.draft && <Button variant="ghost" loading={busy} onClick={start}>{cur ? 'New version' : 'Write it'}</Button>}
        {item.versions > 0 && <Button variant="ghost" onClick={() => setHistory(!history)}>{history ? 'Hide history' : `History (${item.versions})`}</Button>}
      </div>
      {history && <History type={item.type} />}
      {editing && <Editor doc={editing} onClose={() => setEditing(null)} />}
      {publishing && <PublishModal doc={publishing} onClose={() => setPublishing(null)} />}
    </Card>
  )
}

export default function Legal() {
  const user = useAuth((s) => s.session?.user)
  const canManage = can(user, 'settings.manage')
  const list = useLegal()
  const acc = useLegalAcceptances()
  return (
    <>
      <PageHeader title="Legal documents" subtitle="Your privacy policy, terms and notices, in the apps and on public web pages. Each version is kept, and published versions never change." />
      {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data!.items.length === 0 ? <Card><EmptyState title="Nothing here" text="No document types are available." /></Card> : (
        <div className="space-y-3">
          <p className="text-xs text-muted">Write these with your own legal adviser. This page keeps and shows the text; it does not make it legally sufficient.</p>
          {list.data!.items.map((i) => <TypeCard key={i.type} item={i} canManage={canManage} counts={acc.data?.items.find((x) => x.type === i.type && x.version === i.inForce?.version)} />)}
        </div>
      )}
    </>
  )
}
