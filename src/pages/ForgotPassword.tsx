import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { api } from '@/api'
import { BUSINESS_LOGIN, PLATFORM_LOGIN } from '@/lib/portal'
import { Alert, Button, Card, TextField } from '@/components/ui'

/** Asks for a reset link. The answer is the same whether or not the address has an account. */
export default function ForgotPassword() {
  const back = useLocation().pathname.startsWith('/platform') ? PLATFORM_LOGIN : BUSINESS_LOGIN
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try { await api.forgotPassword(email.trim()); setDone(true) } catch (err) { setError(err instanceof Error ? err.message : 'That did not work. Try again.') } finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-full place-items-center p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-brand-fg"><KeyRound size={22} aria-hidden /></div>
          <div><h1 className="text-lg font-semibold leading-tight">Forgot your password?</h1><p className="text-sm text-muted">We'll email you a reset link.</p></div>
        </div>
        {done ? (
          <div className="space-y-4">
            <Alert kind="info">If that email belongs to an account, a reset link is on its way. It works once and expires in 30 minutes. Check your spam folder if it doesn't arrive.</Alert>
            <p className="text-xs text-muted">Nothing arriving? Ask the person who manages your account to reset your password, or the platform owner if you are a business admin.</p>
            <Link to={back} className="text-sm underline">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <TextField label="Email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" loading={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
            <div className="text-center"><Link to={back} className="text-sm underline">Back to sign in</Link></div>
          </form>
        )}
      </Card>
    </div>
  )
}
