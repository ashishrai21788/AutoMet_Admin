import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { useAuth } from '@/store/auth'
import { ROLE_LABEL } from '@/lib/permissions'
import { useToast } from '@/components/feedback'
import { Alert, Button, Card, PageHeader, TextField } from '@/components/ui'

export default function Account() {
  const { session, setSession } = useAuth()
  const user = session!.user
  const navigate = useNavigate()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setError('')
    if (next.length < 10) return setError('Use at least 10 characters')
    if (next !== confirm) return setError('The new passwords do not match')
    setBusy(true)
    try {
      setSession(await api.changePassword(current, next))
      toast.success('Password changed')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Admin Profile" subtitle="Your sign-in details." />
      <Card className="mb-6 max-w-md p-5">
        <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted">Name</dt><dd className="font-medium">{user.name}</dd>
          <dt className="text-muted">Email</dt><dd>{user.email}</dd>
          <dt className="text-muted">Role</dt><dd>{ROLE_LABEL[user.role]}</dd>
        </dl>
      </Card>
      {user.mustChangePassword && <div className="mb-4 max-w-md"><Alert kind="warn">You are using a temporary password. Choose a new one to continue.</Alert></div>}
      <Card className="max-w-md p-5">
        <h2 className="mb-4 font-semibold">Change password</h2>
        <form onSubmit={submit} className="space-y-4">
          <TextField label="Current password" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          <TextField label="New password (10+ characters)" type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <TextField label="Confirm new password" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={busy}>Change password</Button>
        </form>
      </Card>
    </>
  )
}
