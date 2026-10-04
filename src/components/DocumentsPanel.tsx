import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Eye, Upload, XCircle } from 'lucide-react'
import { ApiError, fleet, uploadDocument, type DocumentKind } from '@/api'
import { useScope } from '@/lib/useScope'
import type { DocumentRequirement } from '@/lib/types'
import Modal from './Modal'
import { DocumentBadge, VerificationBadge } from './StatusBadge'
import { useToast } from './feedback'
import { Alert, Badge, Button, Card, ErrorState, Field, Spinner, TextField, Textarea } from './ui'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—')

/** Days until a yyyy-mm-dd date (negative when past). */
function daysUntil(date: string | null): number | null {
  if (!date) return null
  return Math.ceil((new Date(`${date}T23:59:59Z`).getTime() - Date.now()) / 86400000)
}

// ---------------- view ----------------

function ViewerModal({ kind, docId, title, onClose }: { kind: DocumentKind; docId: string; title: string; onClose: () => void }) {
  // a fresh short-lived link every time; the dashboard never keeps or shares it
  const link = useQuery({ queryKey: ['document-link', docId], queryFn: () => fleet.documents.link(kind, docId), gcTime: 0, staleTime: 0 })
  return (
    <Modal title={title} wide onClose={onClose}>
      {link.isLoading ? <Spinner label="Opening the document" /> : link.isError ? <ErrorState error={link.error} onRetry={() => link.refetch()} /> : (
        <div>
          {link.data!.mime === 'application/pdf'
            ? <iframe title={title} src={link.data!.url} className="h-[70vh] w-full rounded-lg border border-line" />
            : <img src={link.data!.url} alt={title} className="mx-auto max-h-[70vh] rounded-lg border border-line object-contain" />}
          <p className="mt-3 text-xs text-muted">This link works for {Math.round(link.data!.expiresInSeconds / 60)} minutes and the view is recorded. A reviewer checks that a document looks right; that does not prove it is authentic.</p>
        </div>
      )}
    </Modal>
  )
}

// ---------------- upload ----------------

function UploadModal({ kind, subjectId, req, onClose, onDone }: { kind: DocumentKind; subjectId: string; req: DocumentRequirement; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [number, setNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const [server, setServer] = useState<Record<string, string>>({})
  const resubmit = !!req.document

  const local: Record<string, string> = {}
  if (!file) local.file = 'Choose a file to upload'
  else if (file.size > MAX_BYTES) local.file = 'The file is larger than 5 MB'
  else if (!ACCEPT.split(',').includes(file.type)) local.file = 'Only JPEG, PNG, WebP or PDF files are accepted'
  if (req.needsNumber && !number.trim()) local.number = `${req.label} number is required`
  if (req.needsExpiry) {
    if (!expiry) local.expiryDate = 'Expiry date is required'
    else if (expiry < new Date().toISOString().slice(0, 10)) local.expiryDate = 'This document has already expired'
  }
  const fe = { ...(touched ? local : {}), ...server }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (busy || Object.keys(local).length > 0 || !file) return
    setBusy(true); setServer({}); setProgress(0)
    try {
      await uploadDocument(kind, subjectId, { type: req.type, number: number.trim(), expiryDate: expiry }, file, setProgress)
      toast.success(`${req.label} ${resubmit ? 'resubmitted' : 'uploaded'}`)
      onDone()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setServer(err.fieldErrors)
      else toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally { setBusy(false) }
  }

  return (
    <Modal title={`${resubmit ? 'Resubmit' : 'Upload'} ${req.label.toLowerCase()}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="upload-doc" loading={busy}>{busy ? 'Uploading…' : 'Upload'}</Button></>}>
      <form id="upload-doc" onSubmit={submit} noValidate className="space-y-4">
        {resubmit && <Alert kind="info">Uploading a new file replaces the current one and sends it for review again. The earlier file stays on record.</Alert>}
        {req.needsNumber && <TextField label={`${req.label} number`} value={number} maxLength={60} onChange={(e) => { setNumber(e.target.value); setServer({}) }} error={fe.number} />}
        {req.needsExpiry && <TextField label="Expiry date" type="date" value={expiry} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { setExpiry(e.target.value); setServer({}) }} error={fe.expiryDate} />}
        <Field label="File (JPEG, PNG, WebP or PDF, up to 5 MB)" error={fe.file}>
          {(p) => (
            <input {...p} ref={input} type="file" accept={ACCEPT} className={`${p.className} file:mr-3 file:rounded file:border-0 file:bg-brand file:px-3 file:py-1 file:text-sm file:font-medium file:text-brand-fg`}
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setServer({}) }} />
          )}
        </Field>
        {busy && (
          <div role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full bg-brand transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <p className="mt-1 text-xs text-muted">{Math.round(progress * 100)}% sent</p>
          </div>
        )}
      </form>
    </Modal>
  )
}

// ---------------- review ----------------

function ReviewModal({ kind, req, onClose, onDone }: { kind: DocumentKind; req: DocumentRequirement; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const revoke = req.document?.status === 'APPROVED'
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>(revoke ? 'REJECT' : 'APPROVE')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const [server, setServer] = useState('')
  const missingReason = decision === 'REJECT' && reason.trim().length < 5

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (busy || missingReason || !req.document) return
    setBusy(true); setServer('')
    try {
      const r = await fleet.documents.review(kind, req.document.id, decision, reason.trim())
      toast.success(decision === 'APPROVE' ? `${req.label} approved` : `${req.label} rejected`)
      void r
      onDone()
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.reason) setServer(err.fieldErrors.reason)
      else toast.error(err instanceof Error ? err.message : 'Could not save the decision')
    } finally { setBusy(false) }
  }

  return (
    <Modal title={`${revoke ? 'Revoke approval of' : 'Review'} ${req.label.toLowerCase()}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="review-doc" variant={decision === 'REJECT' ? 'danger' : 'primary'} loading={busy}>{decision === 'APPROVE' ? 'Approve' : 'Reject'}</Button></>}>
      <form id="review-doc" onSubmit={submit} noValidate className="space-y-4">
        {!revoke && (
          <div className="flex gap-2" role="radiogroup" aria-label="Decision">
            {(['APPROVE', 'REJECT'] as const).map((d) => (
              <button key={d} type="button" role="radio" aria-checked={decision === d} onClick={() => setDecision(d)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${decision === d ? (d === 'APPROVE' ? 'border-ok bg-ok/10' : 'border-danger bg-danger/10') : 'border-line'}`}>
                {d === 'APPROVE' ? 'Approve' : 'Reject'}
              </button>
            ))}
          </div>
        )}
        {decision === 'REJECT' ? (
          <Field label="Reason (shown to the driver; required)" error={server || (touched && missingReason ? 'Give a reason of at least 5 characters' : undefined)}>
            {(p) => <Textarea {...p} rows={3} maxLength={300} value={reason} onChange={(e) => { setReason(e.target.value); setServer('') }} placeholder="For example: the photo is blurry, please upload a clear copy" />}
          </Field>
        ) : (
          <p className="text-sm text-muted">Approving confirms you checked the document. The overall status becomes Approved only when every required document is approved and none has expired.</p>
        )}
      </form>
    </Modal>
  )
}

// ---------------- panel ----------------

type Dialog = { type: 'view' | 'upload' | 'review'; req: DocumentRequirement } | null

export default function DocumentsPanel({ kind, subjectId, canUpload, compact }: { kind: DocumentKind; subjectId: string; canUpload: boolean; compact?: boolean }) {
  const { tenantId } = useScope()
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['biz', tenantId, `${kind}-documents`, subjectId],
    queryFn: () => (kind === 'drivers' ? fleet.drivers.documents(subjectId) : fleet.vehicles.documents(subjectId)),
    enabled: !!tenantId && !!subjectId,
  })
  const [dialog, setDialog] = useState<Dialog>(null)
  useEffect(() => setDialog(null), [subjectId])

  const refresh = () => { void qc.invalidateQueries({ queryKey: ['biz', tenantId] }); setDialog(null) }

  if (query.isLoading) return <Spinner />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const data = query.data!

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Overall verification</span> <VerificationBadge status={data.verificationStatus} />
        {data.verificationStatus === 'INCOMPLETE' && data.verification.missing.length > 0 && <span className="text-xs text-muted">Missing: {data.requirements.filter((r) => data.verification.missing.includes(r.type)).map((r) => r.label).join(', ')}</span>}
      </div>

      {data.requirements.map((r) => {
        const doc = r.document
        const left = daysUntil(doc?.expiryDate ?? null)
        const awaiting = doc?.status === 'SUBMITTED' && !r.photo
        return (
          <Card key={r.type} className={compact ? 'p-3' : 'p-4'}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.label}</span>
                  {r.mandatory ? <Badge kind="neutral">Required</Badge> : <Badge kind="neutral">Optional</Badge>}
                  {doc ? (r.photo ? <Badge kind="ok">Added</Badge> : <DocumentBadge status={doc.effectiveStatus} />) : <Badge kind={r.mandatory ? 'warn' : 'neutral'}>Not submitted</Badge>}
                </div>
                {doc && (
                  <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-3">
                    {!r.photo && r.needsNumber && <div><dt className="inline">Number: </dt><dd className="inline font-mono text-ink">{doc.number || '—'}</dd></div>}
                    {r.needsExpiry && <div><dt className="inline">Expires: </dt><dd className={`inline ${left !== null && left < 0 ? 'text-danger' : left !== null && left <= 30 ? 'text-amber-600' : 'text-ink'}`}>{fmtDate(doc.expiryDate)}{left !== null && left >= 0 && left <= 30 ? ` (${left} days)` : ''}</dd></div>}
                    <div><dt className="inline">Submitted: </dt><dd className="inline text-ink">{fmtDate(doc.submittedAt)}{doc.version > 1 ? ` · version ${doc.version}` : ''}</dd></div>
                    {doc.reviewedAt && !r.photo && <div className="sm:col-span-3"><dt className="inline">Decided: </dt><dd className="inline text-ink">{fmtDate(doc.reviewedAt)}</dd></div>}
                  </dl>
                )}
                {doc?.status === 'REJECTED' && doc.rejectionReason && <p role="note" className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger"><strong>Rejected:</strong> {doc.rejectionReason}</p>}
                {doc?.effectiveStatus === 'EXPIRED' && <p role="note" className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">This document has expired. A new one must be uploaded and approved.</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                {doc && data.canView && <Button variant="ghost" onClick={() => setDialog({ type: 'view', req: r })}><Eye size={15} aria-hidden /> View</Button>}
                {canUpload && <Button variant="ghost" onClick={() => setDialog({ type: 'upload', req: r })}><Upload size={15} aria-hidden /> {doc ? (doc.status === 'REJECTED' || doc.effectiveStatus === 'EXPIRED' ? 'Resubmit' : 'Replace') : 'Upload'}</Button>}
                {data.canReview && awaiting && <Button onClick={() => setDialog({ type: 'review', req: r })}><CheckCircle2 size={15} aria-hidden /> Review</Button>}
                {data.canReview && doc?.status === 'APPROVED' && !r.photo && <Button variant="danger" onClick={() => setDialog({ type: 'review', req: r })}><XCircle size={15} aria-hidden /> Revoke</Button>}
              </div>
            </div>
          </Card>
        )
      })}

      {dialog?.type === 'view' && dialog.req.document && <ViewerModal kind={kind} docId={dialog.req.document.id} title={dialog.req.label} onClose={() => setDialog(null)} />}
      {dialog?.type === 'upload' && <UploadModal kind={kind} subjectId={subjectId} req={dialog.req} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog?.type === 'review' && <ReviewModal kind={kind} req={dialog.req} onClose={() => setDialog(null)} onDone={refresh} />}
    </div>
  )
}
