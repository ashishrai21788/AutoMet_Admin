import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { api, ApiError } from '@/api'
import { BUSINESS_LOGIN, PLATFORM_LOGIN } from '@/lib/portal'
import { useAuth } from '@/store/auth'
import { Alert, Button, Card, TextField } from '@/components/ui'

const MIN = 10

/** The page the emailed link opens. The token comes from the address and is sent once; afterwards the person signs in normally. */
export default function ResetPassword() {
  const token = useSearchParams()[0].get('token') ?? ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)

  const local = password.length < MIN ? `Use at least ${MIN} characters` : password !== confirm ? 'The two passwords do not match' : ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (busy || local) return
    setBusy(true); setError('')
    try {
      const { role } = await api.resetPassword(token, password)
      useAuth.getState().logout() // nobody should stay signed in on this browser under the old password
      navigate(role === 'super_admin' ? PLATFORM_LOGIN : BUSINESS_LOGIN, { replace: true, state: { notice: 'Your password was changed. Sign in with it now.' } })
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'That did not work. Try again.')
    } finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-full place-items-center p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-brand-fg"><KeyRound size={22} aria-hidden /></div>
          <div><h1 className="text-lg font-semibold leading-tight">Choose a new password</h1><p className="text-sm text-muted">You'll be signed out everywhere else.</p></div>
        </div>
        {!/^[0-9a-f]{64}$/.test(token) ? (
          <div className="space-y-4"><Alert kind="error">This reset link is not valid. Ask for a new one.</Alert><Link to={BUSINESS_LOGIN} className="text-sm underline">Back to sign in</Link></div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <TextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint={`At least ${MIN} characters.`} />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={touched ? local || undefined : undefined} />
            {error && <p role="alert" className="text-sm text-danger">{error} <Link to="/forgot-password" className="underline">Ask for a new link</Link></p>}
            <Button type="submit" className="w-full" loading={busy}>{busy ? 'Saving…' : 'Set password'}</Button>
          </form>
        )}
      </Card>
    </div>
  )
}
