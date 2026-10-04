import { useState, type FormEvent } from 'react'
import { ApiError } from '@/api'
import type { AccountStatus } from '@/lib/types'
import Modal from './Modal'
import { useToast } from './feedback'
import { Alert, Button, Field, SelectField, Textarea } from './ui'

const LABEL: Record<AccountStatus, string> = { ACTIVE: 'Active', INACTIVE: 'Inactive', SUSPENDED: 'Suspended' }
const HELP: Record<AccountStatus, string> = {
  ACTIVE: 'The account can be used again. A driver still needs to be verified and have a suitable vehicle to receive rides.',
  INACTIVE: 'Paused, for example a driver on leave. Records and history are kept.',
  SUSPENDED: 'A restriction. A suspended driver or vehicle cannot be assigned, and a suspended driver is never eligible for rides.',
}

/** Change an account status. A suspension needs a written reason; every change is recorded with who made it. */
export default function StatusModal({
  title, current, subject, onSubmit, onClose,
}: { title: string; current: AccountStatus; subject: 'driver' | 'vehicle'; onSubmit: (status: AccountStatus, reason: string) => Promise<unknown>; onClose: () => void }) {
  const toast = useToast()
  const options = (['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const).filter((s) => s !== current)
  const [status, setStatus] = useState<AccountStatus>(options[0])
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const [server, setServer] = useState<Record<string, string>>({})
  const needsReason = status === 'SUSPENDED'
  const reasonError = server.reason ?? (touched && needsReason && reason.trim().length < 5 ? 'Give a reason of at least 5 characters' : undefined)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (busy || (needsReason && reason.trim().length < 5)) return
    setBusy(true); setServer({})
    try {
      await onSubmit(status, reason.trim())
      toast.success(`${subject === 'driver' ? 'Driver' : 'Vehicle'} is now ${LABEL[status].toLowerCase()}`)
      onClose()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setServer(err.fieldErrors)
      else toast.error(err instanceof Error ? err.message : 'Could not change the status')
    } finally { setBusy(false) }
  }

  return (
    <Modal title={title} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="status-form" variant={status === 'SUSPENDED' ? 'danger' : 'primary'} loading={busy}>Change to {LABEL[status].toLowerCase()}</Button></>}>
      <form id="status-form" onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm text-muted">Currently <strong className="text-ink">{LABEL[current].toLowerCase()}</strong>.</p>
        <SelectField label="New status" value={status} onChange={(e) => { setStatus(e.target.value as AccountStatus); setServer({}) }} error={server.status}>
          {options.map((o) => <option key={o} value={o}>{LABEL[o]}</option>)}
        </SelectField>
        <p className="text-sm">{HELP[status]}</p>
        <Field label={needsReason ? 'Reason (required)' : 'Note (optional)'} error={reasonError}>
          {(p) => <Textarea {...p} rows={3} maxLength={300} value={reason} onChange={(e) => { setReason(e.target.value); setServer({}) }} />}
        </Field>
        {server.status && <Alert kind="error">{server.status}</Alert>}
      </form>
    </Modal>
  )
}
