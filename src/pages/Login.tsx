import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { api, API_CONFIGURED, NOT_CONFIGURED_MESSAGE } from '@/api'
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

  if (session) return <Navigate to={session.user.role === 'super_admin' ? '/platform' : '/'} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return // no double submits
    setBusy(true)
    setError('')
    setWrong(false)
    try {
      const next = await api.login(email, password)
      if ((next.user.role === 'super_admin') !== platform) { setError(platform ? 'This sign-in is for the platform owner only. Business admins sign in at' : 'This sign-in is for business accounts only. The platform owner signs in at'); setWrong(true); return }
      setSession(next)
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
            <h1 className="text-lg font-semibold leading-tight">{platform ? 'AutoMet Platform' : 'Business Admin'}</h1>
            <p className="text-sm text-muted">{platform ? 'Platform owner sign-in' : 'Business admin sign-in'}</p>
          </div>
        </div>
        {notice && <div className="mb-4"><Alert kind="info">{notice}</Alert></div>}
        {!API_CONFIGURED && <div className="mb-4"><Alert kind="error">{NOT_CONFIGURED_MESSAGE}</Alert></div>}
        <form onSubmit={submit} className="space-y-4">
          <TextField label="Email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p role="alert" className="text-sm text-danger">{error}{wrong && <> <Link className="underline" to={platform ? BUSINESS_LOGIN : PLATFORM_LOGIN}>{platform ? BUSINESS_LOGIN : PLATFORM_LOGIN}</Link>.</>}</p>}
          <Button type="submit" className="w-full" loading={busy} disabled={!API_CONFIGURED}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          <div className="text-center"><Link to={platform ? '/platform/forgot-password' : '/forgot-password'} className="text-sm underline">Forgot your password?</Link></div>
        </form>
      </Card>
    </div>
  )
}
