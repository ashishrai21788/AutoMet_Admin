import { useEffect, useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import { api, ApiError } from '@/api'
import { useAuth } from '@/store/auth'
import type { TwoFactorSetup } from '@/lib/types'
import { useToast } from '@/components/feedback'
import { Alert, Button, Card, TextField } from '@/components/ui'

/** The QR code is drawn in the browser from the link, so the secret is never sent to anyone else to render. */
function Qr({ uri }: { uri: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => { let live = true; QRCode.toDataURL(uri, { margin: 1, width: 192 }).then((d) => { if (live) setSrc(d) }).catch(() => {}); return () => { live = false } }, [uri])
  return src ? <img src={src} alt="QR code to scan with your authenticator app" width={192} height={192} className="rounded-lg bg-white p-1" /> : <div className="h-48 w-48 animate-pulse rounded-lg bg-black/5" aria-hidden />
}

/** Two-step verification with an authenticator app. Required for the platform owner; optional for everyone else. */
export default function TwoFactorCard() {
  const { session, setSession } = useAuth()
  const user = session!.user
  const toast = useToast()
  const required = user.role === 'super_admin'
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState<string[] | null>(null)
  const [saved, setSaved] = useState(false)
  const [password, setPassword] = useState('')
  const [disabling, setDisabling] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run<T>(fn: () => Promise<T>, then: (r: T) => void) {
    if (busy) return
    setBusy(true); setError('')
    try { then(await fn()) } catch (e) { setError(e instanceof ApiError && Object.values(e.fieldErrors)[0] ? Object.values(e.fieldErrors)[0] : e instanceof Error ? e.message : 'That did not work') } finally { setBusy(false) }
  }

  const start = () => run(api.twoFactor.setup, (s) => { setSetup(s); setCode('') })
  const confirm = (e: FormEvent) => { e.preventDefault(); void run(() => api.twoFactor.enable(code.replace(/\s/g, '')), (r) => { setSession({ token: r.token, user: r.user }); setRecovery(r.recoveryCodes); setSetup(null); setCode(''); toast.success('Two-step verification is on') }) }
  const turnOff = (e: FormEvent) => { e.preventDefault(); void run(() => api.twoFactor.disable(password, code.replace(/\s/g, '')), (s) => { setSession(s); setDisabling(false); setPassword(''); setCode(''); toast.success('Two-step verification is off') }) }

  // the recovery codes are shown once, right after turning it on, and must be acknowledged
  if (recovery) {
    return (
      <Card className="mb-6 max-w-md border-brand p-5">
        <h2 className="font-semibold">Save your recovery codes</h2>
        <p className="mt-1 text-sm text-muted">If you lose your phone, each code signs you in once. They are shown only now. Store them somewhere safe, not on the same phone.</p>
        <ul className="my-3 grid grid-cols-2 gap-2 font-mono text-sm" aria-label="Recovery codes">{recovery.map((c) => <li key={c} className="rounded-lg border border-line px-2 py-1 text-center">{c}</li>)}</ul>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(recovery.join('\n')); toast.success('Codes copied') } catch { toast.error('Could not copy; select and copy them by hand') } }}>Copy codes</Button>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I have saved them</label>
        </div>
        <div className="mt-4"><Button disabled={!saved} onClick={() => setRecovery(null)}>Done</Button></div>
      </Card>
    )
  }

  return (
    <Card className="mb-6 max-w-md p-5">
      <div className="mb-1 flex items-center justify-between gap-2"><h2 className="font-semibold">Two-step verification</h2><span className={user.twoFactorEnabled ? 'text-xs font-medium text-ok' : 'text-xs text-muted'}>{user.twoFactorEnabled ? 'On' : 'Off'}</span></div>
      {user.twoFactorSetupRequired && <div className="mb-3"><Alert kind="warn">Two-step verification is required for the platform owner. Turn it on to continue to the dashboard.</Alert></div>}
      <p className="text-sm text-muted">Signing in also needs a 6-digit code from an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, Authy…), so a stolen password alone is not enough.</p>

      {!user.twoFactorEnabled && !setup && <div className="mt-4"><Button loading={busy} onClick={start}>Set up</Button></div>}

      {setup && (
        <form onSubmit={confirm} className="mt-4 space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Open your authenticator app and add an account by scanning this code.</li>
            <li>Enter the 6-digit code it shows to confirm.</li>
          </ol>
          <Qr uri={setup.otpauthUri} />
          <details className="text-xs text-muted"><summary className="cursor-pointer">Cannot scan? Enter the key by hand</summary><code className="mt-1 block break-all rounded bg-black/5 p-2 text-ink dark:bg-white/10">{setup.secret}</code></details>
          <TextField label="6-digit code" required autoComplete="one-time-code" inputMode="numeric" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2"><Button type="submit" loading={busy}>Turn on</Button><Button variant="ghost" onClick={() => { setSetup(null); setError('') }}>Cancel</Button></div>
        </form>
      )}

      {user.twoFactorEnabled && !required && !disabling && <div className="mt-4"><Button variant="danger" onClick={() => { setDisabling(true); setError('') }}>Turn off</Button></div>}
      {user.twoFactorEnabled && required && <p className="mt-3 text-xs text-muted">It cannot be turned off for the platform owner. If you lose your phone, another platform account can reset it from Platform Team.</p>}
      {disabling && (
        <form onSubmit={turnOff} className="mt-4 space-y-4">
          <TextField label="Your password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <TextField label="Current 6-digit code" required autoComplete="one-time-code" inputMode="numeric" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2"><Button type="submit" variant="danger" loading={busy}>Turn off</Button><Button variant="ghost" onClick={() => { setDisabling(false); setError('') }}>Cancel</Button></div>
        </form>
      )}
      {!setup && !disabling && error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </Card>
  )
}
