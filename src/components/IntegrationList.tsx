import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react'
import type { PlatformOverview } from '@/lib/types'

type Integrations = PlatformOverview['integrations']

function Integration({ name, ok, text, tone }: { name: string; ok: boolean | null; text: string; tone?: 'neutral' }) {
  const Icon = ok === null || tone === 'neutral' ? MinusCircle : ok ? CheckCircle2 : XCircle
  const cls = tone === 'neutral' ? 'text-muted' : ok ? 'text-ok' : 'text-danger'
  return (
    <li className="flex items-start gap-3 py-2.5 text-sm">
      <Icon size={18} className={`mt-0.5 shrink-0 ${cls}`} aria-hidden />
      <div className="min-w-0"><div className="font-medium">{name}</div><div className="text-xs text-muted">{text}</div></div>
    </li>
  )
}

export default function IntegrationList({ i }: { i: Integrations }) {
  return (
    <ul className="divide-y divide-line" aria-label="Integrations">
      <Integration name="Database" ok={i.database.connected} text={i.database.connected ? 'Connected' : i.database.configured ? 'Configured but not connected' : 'Not configured'} />
      <Integration name="Document storage" ok={i.documentStorage.configured} text={i.documentStorage.configured ? `${i.documentStorage.provider} settings are present (an upload has not been tested from here)` : `${i.documentStorage.provider} settings are missing; document uploads will fail`} />
      <Integration name="Push notifications" ok={i.pushNotifications.configured} text={i.pushNotifications.configured ? `${i.pushNotifications.provider} settings are present` : `${i.pushNotifications.provider} settings are missing; ride requests cannot reach drivers`} />
      <Integration name="Admin sign-in security" ok={i.adminSecurity.configured} text={i.adminSecurity.configured ? 'Signing key is set' : 'Signing key is missing'} />
      <Integration name="Sign-in code delivery (SMS)" ok={false} text="Not built yet: riders and drivers cannot receive their codes by text message" />
      <Integration name="Payments" ok={false} tone="neutral" text="Not built yet: trips are paid in cash outside the platform" />
    </ul>
  )
}
