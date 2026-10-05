import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { api, ApiError, API_CONFIGURED, NOT_CONFIGURED_MESSAGE } from '@/api'
import { useAuth } from '@/store/auth'
import { BUSINESS_LOGIN, PLATFORM_LOGIN } from '@/lib/portal'
import { Alert, Button, Card, TextField } from '@/components/ui'

export default function Login({ kind }: { kind: 'platform' | 'business' }) {
  const platform = kind === 'platform'
  const { session, setSession } = useAuth()
  const navigate = useNavigate()
  const routeState = useLocation().state as { from?: string; notice?: string } | null
  const from = routeState?.from ?? (platform ? '/platform' : '/')
  const notice = routeState?.notice
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(false)
  const [challenge, setChallenge] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)

  if (session) return <Navigate to={session.user.role === 'super_admin' ? '/platform' : '/'} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return // no double submits
    setBusy(true)
    setError('')
    setWrong(false)
    try {
      const first = await api.login(email, password)
      if ('twoFactorRequired' in first) { setChallenge(first.challenge); setCode(''); return }
      const next = first
      if ((next.user.role === 'super_admin') !== platform) { setError(platform ? 'This sign-in is for the platform owner only. Business admins sign in at' : 'This sign-in is for business accounts only. The platform owner signs in at'); setWrong(true); return }
      setSession(next)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault()
    if (busy || !challenge) return
    setBusy(true)
    setError('')
    setWrong(false)
    try {
      const next = await api.verifyTwoFactor(challenge, useRecovery ? { recoveryCode: code.trim() } : { code: code.replace(/\s/g, '') })
      if ((next.user.role === 'super_admin') !== platform) { setError(platform ? 'This sign-in is for the platform owner only. Business admins sign in at' : 'This sign-in is for business accounts only. The platform owner signs in at'); setWrong(true); setChallenge(null); return }
      setSession(next)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
      // an expired sign-in cannot be retried with a new code: start again
      if (err instanceof ApiError && err.status === 401 && /expired/i.test(err.message)) setChallenge(null)
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
            <h1 className="text-lg font-semibold leading-tight">{platform ? 'AutoMet Platform' : 'Business Admin'}</h1>
            <p className="text-sm text-muted">{platform ? 'Platform owner sign-in' : 'Business admin sign-in'}</p>
          </div>
        </div>
        {notice && <div className="mb-4"><Alert kind="info">{notice}</Alert></div>}
        {!API_CONFIGURED && <div className="mb-4"><Alert kind="error">{NOT_CONFIGURED_MESSAGE}</Alert></div>}
        {challenge ? (
          <form onSubmit={submitCode} className="space-y-4">
            <p className="text-sm text-muted">{useRecovery ? 'Enter one of your recovery codes. Each works once.' : 'Open your authenticator app and enter the 6-digit code.'}</p>
            <TextField label={useRecovery ? 'Recovery code' : 'Code'} required autoFocus autoComplete="one-time-code" inputMode={useRecovery ? 'text' : 'numeric'} maxLength={useRecovery ? 12 : 7} value={code} onChange={(e) => setCode(e.target.value)} />
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" loading={busy}>{busy ? 'Checking…' : 'Verify'}</Button>
            <div className="flex justify-between text-sm">
              <button type="button" className="underline" onClick={() => { setUseRecovery(!useRecovery); setCode(''); setError('') }}>{useRecovery ? 'Use the app instead' : 'Use a recovery code'}</button>
              <button type="button" className="underline" onClick={() => { setChallenge(null); setPassword(''); setError('') }}>Start again</button>
            </div>
          </form>
        ) : (
        <form onSubmit={submit} className="space-y-4">
          <TextField label="Email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p role="alert" className="text-sm text-danger">{error}{wrong && <> <Link className="underline" to={platform ? BUSINESS_LOGIN : PLATFORM_LOGIN}>{platform ? BUSINESS_LOGIN : PLATFORM_LOGIN}</Link>.</>}</p>}
          <Button type="submit" className="w-full" loading={busy} disabled={!API_CONFIGURED}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          <div className="text-center"><Link to={platform ? '/platform/forgot-password' : '/forgot-password'} className="text-sm underline">Forgot your password?</Link></div>
        </form>
        )}
      </Card>
    </div>
  )
}
