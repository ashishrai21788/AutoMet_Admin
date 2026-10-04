import { useState, type FormEvent, type ReactNode } from 'react'
import { ApiError } from '@/api'
import Modal from './Modal'
import { useToast } from './feedback'
import { Button, Field, Textarea } from './ui'

/**
 * Asks for a written reason before an action that affects someone else (suspending a rider, cancelling a trip). The reason
 * is sent to the server, shown in the audit log, and the action does nothing until it is long enough.
 */
export default function ReasonModal({
  title, intro, label = 'Reason', confirmLabel, danger = true, required = true, successText, onSubmit, onClose,
}: {
  title: string
  intro: ReactNode
  label?: string
  confirmLabel: string
  danger?: boolean
  required?: boolean
  successText: string
  onSubmit: (reason: string) => Promise<unknown>
  onClose: () => void
}) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const [server, setServer] = useState('')
  const tooShort = required && reason.trim().length < 5
  const error = server || (touched && tooShort ? 'Give a reason of at least 5 characters' : undefined)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (busy || tooShort) return
    setBusy(true); setServer('')
    try {
      await onSubmit(reason.trim())
      toast.success(successText)
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.reason) setServer(err.fieldErrors.reason)
      else toast.error(err instanceof Error ? err.message : 'That did not work')
    } finally { setBusy(false) }
  }

  return (
    <Modal title={title} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Not now</Button><Button type="submit" form="reason-form" variant={danger ? 'danger' : 'primary'} loading={busy}>{confirmLabel}</Button></>}>
      <form id="reason-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="text-sm">{intro}</div>
        <Field label={required ? `${label} (required)` : `${label} (optional)`} error={error}>
          {(p) => <Textarea {...p} rows={3} maxLength={300} value={reason} onChange={(e) => { setReason(e.target.value); setServer('') }} />}
        </Field>
      </form>
    </Modal>
  )
}
