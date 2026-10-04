import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { api, API_CONFIGURED, NOT_CONFIGURED_MESSAGE } from '@/api'
import { useAuth } from '@/store/auth'
import { Alert, Button, Card, TextField } from '@/components/ui'

export default function Login() {
  const { session, setSession } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return // no double submits
    setBusy(true)
    setError('')
    try {
      setSession(await api.login(email, password))
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-full place-items-center p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-brand-fg"><ShieldCheck size={22} aria-hidden /></div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">AutoMet Admin</h1>
            <p className="text-sm text-muted">Sign in to your dashboard</p>
          </div>
        </div>
        {!API_CONFIGURED && <div className="mb-4"><Alert kind="error">{NOT_CONFIGURED_MESSAGE}</Alert></div>}
        <form onSubmit={submit} className="space-y-4">
          <TextField label="Email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" loading={busy} disabled={!API_CONFIGURED}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
      </Card>
    </div>
  )
}
