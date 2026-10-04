import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import { useBusinessMutation, useGeo, useOverview } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { countryName } from '@/lib/geo'
import type { Business } from '@/lib/types'
import { Badge, Button, Card, ErrorState, PageHeader, Spinner, TextField } from '@/components/ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9 ()-]{6,20}$/

function SettingsForm({ business, canEdit }: { business: Business; canEdit: boolean }) {
  const [form, setForm] = useState({ name: business.name, appName: business.appName, brandColor: business.brandColor, supportEmail: business.supportEmail, supportPhone: business.supportPhone })
  const [touched, setTouched] = useState(false)
  const save = useBusinessMutation(api.business.updateSettings, { success: 'Business settings saved' })

  const local: Record<string, string> = {}
  if (form.name.trim().length < 2) local.name = 'Business name is required'
  if (form.appName.trim().length < 2) local.appName = 'App name is required'
  if (form.supportEmail.trim() && !EMAIL_RE.test(form.supportEmail.trim())) local.supportEmail = 'Enter a valid email address'
  if (form.supportPhone.trim() && !PHONE_RE.test(form.supportPhone.trim())) local.supportPhone = 'Enter a valid phone number'
  const fe = { ...(touched ? local : {}), ...save.fieldErrors }
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => { setForm({ ...form, [k]: e.target.value }); save.reset() }

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(local).length === 0) save.mutate({ name: form.name.trim(), appName: form.appName.trim(), brandColor: form.brandColor, supportEmail: form.supportEmail.trim(), supportPhone: form.supportPhone.trim() })
  }

  return (
    <Card className="p-5">
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <fieldset disabled={!canEdit} className="contents">
          <TextField label="Business name" value={form.name} maxLength={80} onChange={set('name')} error={fe.name} />
          <TextField label="App name (shown to riders)" value={form.appName} maxLength={40} onChange={set('appName')} error={fe.appName} />
          <TextField label="Brand colour" type="color" value={form.brandColor} onChange={set('brandColor')} error={fe.brandColor} className="[&_input]:h-10 [&_input]:p-1" />
          <div />
          <TextField label="Support email" type="email" value={form.supportEmail} onChange={set('supportEmail')} error={fe.supportEmail} />
          <TextField label="Support phone" type="tel" value={form.supportPhone} onChange={set('supportPhone')} error={fe.supportPhone} />
        </fieldset>
        <div className="sm:col-span-2">
          {canEdit ? <Button type="submit" loading={save.isPending}>Save settings</Button> : <p className="text-sm text-muted">Your role can view these settings but not change them.</p>}
        </div>
      </form>
    </Card>
  )
}

export default function BusinessSettings() {
  const { user } = useScope()
  const canEdit = can(user, 'settings.manage')
  const overview = useOverview()
  const geo = useGeo()

  if (overview.isLoading) return <Spinner />
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
  const b = overview.data!.business

  return (
    <>
      <PageHeader title="Business Settings" subtitle="Identity, branding and contacts for this business." />

      <Card className="mb-6 p-5">
        <h2 className="mb-3 font-semibold">Identity</h2>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-muted">App ID</dt><dd className="font-mono">{b.appId}</dd></div>
          <div><dt className="text-xs text-muted">Android package</dt><dd className="font-mono">{b.packageName}</dd></div>
          <div><dt className="text-xs text-muted">Plan</dt><dd className="capitalize">{b.plan}</dd></div>
          <div><dt className="text-xs text-muted">Status</dt><dd><Badge kind={b.status === 'suspended' ? 'bad' : b.status === 'trial' ? 'warn' : 'ok'}>{b.status}</Badge></dd></div>
          <div><dt className="text-xs text-muted">Operating market</dt><dd>{b.market ? `${countryName(geo.data, b.market.country)} · ${b.market.currency} · ${b.market.timezone}` : <Link to="/regions" className="underline">Not set yet</Link>}</dd></div>
          <div><dt className="text-xs text-muted">Created</dt><dd>{b.createdAt}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted">The App ID and package name are fixed. Contact the platform owner if a package name needs to change.</p>
      </Card>

      <SettingsForm business={b} canEdit={canEdit} />

      {can(user, 'team.manage') && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
          <div><h2 className="font-semibold">Team</h2><p className="text-sm text-muted">Add admins and staff for this business and control their access.</p></div>
          <Link to="/team"><Button variant="ghost">Manage team</Button></Link>
        </Card>
      )}
    </>
  )
}
