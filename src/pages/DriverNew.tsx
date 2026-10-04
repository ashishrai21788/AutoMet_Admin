import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, fleet, uploadDocument } from '@/api'
import { useCategories, useGeo, useOverview, useRegions } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import { regionLabel } from '@/lib/labels'
import type { DriverInput } from '@/lib/types'
import { useToast } from '@/components/feedback'
import { Alert, Button, Card, EmptyState, ErrorState, Field, PageHeader, SelectField, Spinner, TextField } from '@/components/ui'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const PHOTO_ACCEPT = ['image/jpeg', 'image/png', 'image/webp']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const todayIso = () => new Date().toISOString().slice(0, 10)

interface DocDraft { number: string; expiry: string; file: File | null }
const blankDoc: DocDraft = { number: '', expiry: '', file: null }

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mb-4 mt-1 text-sm text-muted">{hint}</p>}
      <div className={`grid gap-4 sm:grid-cols-2 ${hint ? '' : 'mt-4'}`}>{children}</div>
    </Card>
  )
}

/** Files are checked here for a quick answer; the server checks the real type and size again. */
function fileProblem(file: File | null, accept: string[]): string | undefined {
  if (!file) return undefined
  if (file.size > MAX_BYTES) return 'The file is larger than 5 MB'
  if (!accept.includes(file.type)) return accept === PHOTO_ACCEPT ? 'A photo must be a JPEG, PNG or WebP image' : 'Only JPEG, PNG, WebP or PDF files are accepted'
  return undefined
}

export default function DriverNew() {
  const { tenantId } = useScope()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const overview = useOverview()
  const regions = useRegions()
  const categories = useCategories()
  const geoQuery = useGeo()
  const market = overview.data?.business.market ?? null

  const [f, setF] = useState({ fullName: '', dial: '', national: '', email: '', dob: '', country: '', state: '', city: '', line: '', regionId: '', categoryId: '' })
  const [licence, setLicence] = useState<DocDraft>(blankDoc)
  const [identity, setIdentity] = useState<DocDraft>(blankDoc)
  const [photo, setPhoto] = useState<File | null>(null)
  const [touched, setTouched] = useState(false)
  const [server, setServer] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [steps, setSteps] = useState<{ label: string; state: 'wait' | 'run' | 'done' | 'fail'; note?: string; progress?: number }[]>([])
  const seeded = useRef(false)

  // start from the business's own country: the dialling code and the address country
  useEffect(() => {
    if (seeded.current || !market || !geoQuery.data) return
    seeded.current = true
    const dial = geoQuery.data.countries.find((c) => c.code === market.country)?.dialCode ?? ''
    setF((x) => ({ ...x, dial, country: market.country }))
  }, [market, geoQuery.data])

  const activeRegions = (regions.data ?? []).filter((r) => r.active)
  const offered = useMemo(() => (categories.data ?? []).filter((c) => c.active && (!f.regionId || c.regionIds.includes(f.regionId))), [categories.data, f.regionId])
  useEffect(() => { if (f.categoryId && !offered.some((c) => c.id === f.categoryId)) setF((x) => ({ ...x, categoryId: '' })) }, [offered, f.categoryId])

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((x) => ({ ...x, [k]: e.target.value })); setServer({}) }

  const local: Record<string, string> = {}
  if (f.fullName.trim().length < 2) local.fullName = 'Full name is required'
  const digits = f.national.replace(/\D/g, '')
  if (!f.dial) local.phone = 'Choose the country code'
  else if (digits.length < 6 || digits.length + f.dial.length > 15) local.phone = 'Enter the phone number without the country code'
  if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) local.email = 'Enter a valid email address'
  if (f.dob) {
    const limit = new Date(); limit.setFullYear(limit.getFullYear() - 18)
    if (f.dob > limit.toISOString().slice(0, 10)) local.dob = 'The driver must be at least 18 years old'
  }
  if (!f.regionId) local.regionId = 'Choose the region this driver operates in'
  if (!f.categoryId) local.categoryId = 'Choose the vehicle category this driver is eligible for'
  const licenceStarted = !!(licence.number || licence.expiry || licence.file)
  if (licenceStarted) {
    if (!licence.number.trim()) local['licence.number'] = 'Licence number is required'
    if (!licence.expiry) local['licence.expiry'] = 'Expiry date is required'
    else if (licence.expiry < todayIso()) local['licence.expiry'] = 'This licence has already expired'
    if (!licence.file) local['licence.file'] = 'Attach the licence'
  }
  const identityStarted = !!(identity.number || identity.file)
  if (identityStarted) {
    if (!identity.number.trim()) local['identity.number'] = 'Identity document number is required'
    if (!identity.file) local['identity.file'] = 'Attach the document'
  }
  const fileErrors: Record<string, string> = {}
  for (const [key, file, accept] of [['licence.file', licence.file, ACCEPT], ['identity.file', identity.file, ACCEPT], ['photo', photo, PHOTO_ACCEPT]] as const) {
    const p = fileProblem(file as File | null, accept as string[])
    if (p) fileErrors[key] = p
  }
  const all = { ...local, ...fileErrors }
  const fe = { ...(touched ? all : fileErrors), ...server }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (busy || Object.keys(all).length > 0) return
    setBusy(true); setServer({})
    const input: DriverInput = {
      fullName: f.fullName.trim(), phone: `+${f.dial}${digits}`, email: f.email.trim(), dateOfBirth: f.dob,
      address: { country: f.country, state: f.state.trim(), city: f.city.trim(), line: f.line.trim() },
      operatingRegionId: f.regionId, eligibleCategoryId: f.categoryId,
    }
    let id: string
    try {
      id = (await fleet.drivers.create(input)).id
    } catch (err) {
      setBusy(false)
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        const map: Record<string, string> = { ...err.fieldErrors }
        if (map.phone) map.phone = map.phone // shown under the phone field
        setServer(map)
        toast.error(err.status === 409 ? 'This driver is already registered' : 'Please fix the highlighted fields')
      } else toast.error(err instanceof Error ? err.message : 'Could not add the driver')
      return
    }

    // the driver exists now; upload whatever documents were attached, one by one
    const jobs: { label: string; run: (onProgress: (n: number) => void) => Promise<unknown> }[] = []
    if (photo) jobs.push({ label: 'Profile photo', run: (p) => uploadDocument('drivers', id, { type: 'PROFILE_PHOTO' }, photo, p) })
    if (licence.file) jobs.push({ label: 'Driving licence', run: (p) => uploadDocument('drivers', id, { type: 'DRIVING_LICENCE', number: licence.number.trim(), expiryDate: licence.expiry }, licence.file!, p) })
    if (identity.file) jobs.push({ label: 'Identity document', run: (p) => uploadDocument('drivers', id, { type: 'IDENTITY', number: identity.number.trim() }, identity.file!, p) })
    setSteps(jobs.map((j) => ({ label: j.label, state: 'wait' as const })))
    let failed = 0
    for (let i = 0; i < jobs.length; i++) {
      setSteps((s) => s.map((x, j) => (j === i ? { ...x, state: 'run', progress: 0 } : x)))
      try {
        await jobs[i].run((n) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, progress: n } : x))))
        setSteps((s) => s.map((x, j) => (j === i ? { ...x, state: 'done' } : x)))
      } catch (err) {
        failed++
        setSteps((s) => s.map((x, j) => (j === i ? { ...x, state: 'fail', note: err instanceof Error ? err.message : 'Upload failed' } : x)))
      }
    }
    await qc.invalidateQueries({ queryKey: ['biz', tenantId] })
    if (failed === 0) { toast.success('Driver added'); navigate(`/drivers/${id}`) }
    else { toast.error(`The driver was added, but ${failed} upload${failed === 1 ? '' : 's'} failed. Retry from the Documents tab.`); setBusy(false); navigate(`/drivers/${id}?tab=documents`) }
  }

  if (overview.isLoading || regions.isLoading || categories.isLoading || geoQuery.isLoading) return <Spinner />
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
  if (!market || activeRegions.length === 0 || (categories.data ?? []).filter((c) => c.active).length === 0) {
    return (
      <>
        <PageHeader title="Add driver" />
        <Card><EmptyState title="Finish the business setup first" text="A driver needs an operating region and a vehicle category. Set up your regions and categories, then come back." action={<Link to="/"><Button>Go to the dashboard</Button></Link>} /></Card>
      </>
    )
  }
  const geo = geoQuery.data!

  const docFields = (title: string, hint: string, d: DocDraft, set_: (v: DocDraft) => void, key: 'licence' | 'identity', withExpiry: boolean) => (
    <Card className="p-4">
      <h3 className="font-medium">{title}</h3>
      <p className="mb-3 text-xs text-muted">{hint}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label="Number" value={d.number} maxLength={60} onChange={(e) => set_({ ...d, number: e.target.value })} error={fe[`${key}.number`]} />
        {withExpiry && <TextField label="Expiry date" type="date" min={todayIso()} value={d.expiry} onChange={(e) => set_({ ...d, expiry: e.target.value })} error={fe[`${key}.expiry`]} />}
        <Field label="File" error={fe[`${key}.file`]}>
          {(p) => <input {...p} type="file" accept={ACCEPT.join(',')} onChange={(e) => set_({ ...d, file: e.target.files?.[0] ?? null })} className={`${p.className} file:mr-2 file:rounded file:border-0 file:bg-brand file:px-2 file:py-1 file:text-xs file:font-medium file:text-brand-fg`} />}
        </Field>
      </div>
    </Card>
  )

  return (
    <>
      <PageHeader title="Add driver" subtitle="Create the driver's record. Adding a driver does not make them eligible for rides: their documents still have to be approved and a vehicle assigned." />
      <form onSubmit={submit} noValidate className="space-y-6">
        <Section title="Personal information">
          <TextField label="Full name" required value={f.fullName} onChange={set('fullName')} maxLength={80} error={fe.fullName} className="sm:col-span-2" />
          <div>
            <span className="mb-1 block text-xs font-medium text-muted">Phone number</span>
            <div className="flex gap-2">
              <select aria-label="Country code" value={f.dial} onChange={set('dial')} className="w-28 rounded-lg border border-line bg-bg px-2 py-2 text-sm">
                <option value="">Code</option>
                {geo.countries.filter((c) => c.dialCode).map((c) => <option key={c.code} value={c.dialCode}>{c.code} +{c.dialCode}</option>)}
              </select>
              <input aria-label="Phone number" inputMode="tel" value={f.national} onChange={set('national')} placeholder="98765 43210"
                aria-invalid={!!fe.phone} className={`min-w-0 flex-1 rounded-lg border bg-bg px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 ${fe.phone ? 'border-danger' : 'border-line'}`} />
            </div>
            {fe.phone && <p role="alert" className="mt-1 text-xs text-danger">{fe.phone}</p>}
          </div>
          <TextField label="Email (optional)" type="email" value={f.email} onChange={set('email')} error={fe.email} />
          <TextField label="Date of birth (optional)" type="date" max={todayIso()} value={f.dob} onChange={set('dob')} error={fe.dateOfBirth ?? fe.dob} hint="Must be 18 or older" />
          <Field label="Profile photo (optional)" error={fe.photo}>
            {(p) => <input {...p} type="file" accept={PHOTO_ACCEPT.join(',')} onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className={`${p.className} file:mr-2 file:rounded file:border-0 file:bg-brand file:px-2 file:py-1 file:text-xs file:font-medium file:text-brand-fg`} />}
          </Field>
        </Section>

        <Section title="Address" hint="Optional. Collect only what you need.">
          <SelectField label="Country" value={f.country} onChange={set('country')}>
            <option value="">Select…</option>{geo.countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </SelectField>
          <TextField label="State or province" value={f.state} onChange={set('state')} maxLength={80} />
          <TextField label="City" value={f.city} onChange={set('city')} maxLength={80} />
          <TextField label="Address" value={f.line} onChange={set('line')} maxLength={200} />
        </Section>

        <Section title="Operating information">
          <SelectField label="Operating region" required value={f.regionId} onChange={set('regionId')} error={fe.regionId ?? fe.operatingRegionId}>
            <option value="">Select a region…</option>{activeRegions.map((r) => <option key={r.id} value={r.id}>{regionLabel(r)}</option>)}
          </SelectField>
          <SelectField label="Eligible vehicle category" required value={f.categoryId} onChange={set('categoryId')} error={fe.categoryId ?? fe.eligibleCategoryId}
            hint={f.regionId && offered.length === 0 ? 'No category is offered in this region yet' : 'Only categories offered in the chosen region'}>
            <option value="">Select a category…</option>{offered.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <p className="text-xs text-muted sm:col-span-2">A vehicle is assigned after the driver is created, from the driver's page or the Vehicles screen.</p>
        </Section>

        <Section title="Documents" hint="Optional now; you can add them later. Both are needed before the driver can be approved. Files stay private and are opened only through short-lived links.">
          <div className="space-y-4 sm:col-span-2">
            {docFields('Driving licence', 'JPEG, PNG, WebP or PDF, up to 5 MB.', licence, setLicence, 'licence', true)}
            {docFields('Identity document', 'The identity document your market requires.', identity, setIdentity, 'identity', false)}
          </div>
        </Section>

        {steps.length > 0 && (
          <Card className="p-4" aria-live="polite">
            <h3 className="mb-2 font-medium">Uploading documents</h3>
            <ul className="space-y-2 text-sm">
              {steps.map((s) => (
                <li key={s.label}>
                  <div className="flex justify-between"><span>{s.label}</span><span className={s.state === 'fail' ? 'text-danger' : 'text-muted'}>{s.state === 'wait' ? 'Waiting' : s.state === 'run' ? `${Math.round((s.progress ?? 0) * 100)}%` : s.state === 'done' ? 'Done' : 'Failed'}</span></div>
                  {s.state === 'run' && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full bg-brand" style={{ width: `${Math.round((s.progress ?? 0) * 100)}%` }} /></div>}
                  {s.note && <p className="text-xs text-danger">{s.note}</p>}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {touched && Object.keys(all).length > 0 && <Alert kind="error">Please fix the highlighted fields.</Alert>}
        <div className="flex gap-2">
          <Button type="submit" loading={busy}>{busy ? 'Saving…' : 'Add driver'}</Button>
          <Link to="/drivers"><Button variant="ghost" disabled={busy}>Cancel</Button></Link>
        </div>
      </form>
    </>
  )
}
