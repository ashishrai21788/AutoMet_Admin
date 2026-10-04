import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { api, ApiError } from '@/api'
import { useAuth } from '@/store/auth'
import type { Business, CreatedBusiness, NewBusinessInput } from '@/lib/types'
import SecretNotice from '@/components/SecretNotice'
import Modal from '@/components/Modal'
import DataTable, { SearchInput, type Column } from '@/components/DataTable'
import { useConfirm, useToast } from '@/components/feedback'
import { Badge, Button, Card, ErrorState, PageHeader, SelectField, Spinner, TextField } from '@/components/ui'

const statusKind = { active: 'ok', trial: 'warn', suspended: 'bad' } as const
const empty: NewBusinessInput = { name: '', appName: '', packageName: '', city: '', plan: 'trial', brandColor: '#f5a300', adminName: '', adminEmail: '' }
const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function localErrors(f: NewBusinessInput): Record<string, string> {
  const e: Record<string, string> = {}
  if (f.name.trim().length < 2) e.name = 'Business name is required'
  if (f.appName.trim().length < 2) e.appName = 'App name is required'
  if (!PACKAGE_RE.test(f.packageName.trim().toLowerCase())) e.packageName = 'Use a package name like com.company.rider'
  if (f.adminName.trim().length < 2) e.adminName = 'Admin name is required'
  if (!EMAIL_RE.test(f.adminEmail.trim())) e.adminEmail = 'Enter a valid email address'
  return e
}

export default function Businesses() {
  const setActiveTenant = useAuth((s) => s.setActiveTenant)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(empty)
  const [touched, setTouched] = useState(false)
  const [created, setCreated] = useState<CreatedBusiness | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const list = useQuery({ queryKey: ['businesses'], queryFn: api.businesses.list })

  const create = useMutation({
    mutationFn: (input: NewBusinessInput) => api.businesses.create({ ...input, name: input.name.trim(), appName: input.appName.trim(), packageName: input.packageName.trim().toLowerCase(), adminName: input.adminName.trim(), adminEmail: input.adminEmail.trim() }),
    onSuccess: (result) => { qc.invalidateQueries({ queryKey: ['businesses'] }); setCreated(result); setForm(empty); setTouched(false); setShowForm(false); toast.success(`${result.name} was created`) },
    onError: (e) => { if (!(e instanceof ApiError) || Object.keys(e.fieldErrors).length === 0) toast.error(e.message) },
  })
  const changeStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: Business['status'] }) => api.businesses.setStatus(id, next),
    onSuccess: (b) => { qc.invalidateQueries({ queryKey: ['businesses'] }); toast.success(`${b.name} is now ${b.status}`) },
    onError: (e) => toast.error(e.message),
  })

  const errors = { ...localErrors(form), ...(create.error instanceof ApiError ? create.error.fieldErrors : {}) }
  const set = (k: keyof NewBusinessInput) => (e: { target: { value: string } }) => { setForm({ ...form, [k]: e.target.value }); create.reset() }
  const shown = (k: string) => (touched ? errors[k] : create.error instanceof ApiError ? create.error.fieldErrors[k] : undefined)

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(localErrors(form)).length === 0) create.mutate(form)
  }

  async function toggle(b: Business) {
    const suspending = b.status !== 'suspended'
    const ok = await confirm({
      title: suspending ? `Suspend ${b.name}?` : `Activate ${b.name}?`,
      message: suspending ? 'Its admins are signed out immediately and cannot sign in until you activate it again. Other businesses are not affected.' : 'Its admins will be able to sign in again.',
      confirmLabel: suspending ? 'Suspend' : 'Activate', danger: suspending,
    })
    if (ok) changeStatus.mutate({ id: b.appId, next: suspending ? 'suspended' : b.plan === 'trial' ? 'trial' : 'active' })
  }

  function open(b: Business) { setActiveTenant(b.appId); navigate('/') }

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (list.data ?? []).filter((b) =>
      (status === 'all' || b.status === status) &&
      (!term || [b.name, b.appName, b.appId, b.packageName].some((v) => v.toLowerCase().includes(term))))
  }, [list.data, search, status])

  const copy = async (id: string) => { try { await navigator.clipboard.writeText(id); toast.success('App ID copied') } catch { toast.error('Could not copy; select the App ID and copy it manually') } }

  const columns: Column<Business>[] = [
    { header: 'Business', cell: (b) => <div><div className="font-medium"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: b.brandColor }} aria-hidden />{b.name}</div><div className="text-xs text-muted">{b.appName} · {b.packageName}</div></div> },
    { header: 'App ID', cell: (b) => <span className="inline-flex items-center gap-1 font-mono text-xs">{b.appId}<button type="button" aria-label={`Copy App ID of ${b.name}`} onClick={() => copy(b.appId)} className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"><Copy size={13} /></button></span> },
    { header: 'Status', cell: (b) => <Badge kind={statusKind[b.status]}>{b.status}</Badge> },
    { header: 'Setup', cell: (b) => b.setup ? (b.setup.complete ? <Badge kind="ok">Complete</Badge> : <span className="text-xs"><strong>{b.setup.percent}%</strong> · next: {b.setup.nextStep}</span>) : '—' },
    { header: 'Actions', hideLabel: true, className: 'text-right', cell: (b) => (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => open(b)}>Open dashboard</Button>
        <Button variant={b.status === 'suspended' ? 'ghost' : 'danger'} loading={changeStatus.isPending && changeStatus.variables?.id === b.appId} onClick={() => toggle(b)}>{b.status === 'suspended' ? 'Activate' : 'Suspend'}</Button>
      </div>
    ) },
  ]

  return (
    <>
      <PageHeader
        title="Businesses"
        subtitle="Each business is an independent app with its own App ID, data, admins and settings."
        action={<Button onClick={() => setShowForm(true)}>Create business</Button>}
      />

      {created && (
        <SecretNotice
          title={`${created.name} was created (App ID ${created.appId})`}
          email={created.initialAdmin.email}
          password={created.initialAdmin.temporaryPassword}
          onClose={() => setCreated(null)}
        />
      )}

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <div className="min-w-[12rem] flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search by name, App ID or package" /></div>
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm">
            <option value="all">All statuses</option><option value="active">Active</option><option value="trial">Trial</option><option value="suspended">Suspended</option>
          </select>
        </div>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
          <DataTable
            rows={rows} columns={columns} rowKey={(b) => b.appId}
            empty={list.data?.length ? { title: 'No business matches your search' } : { title: 'No businesses yet', text: 'Create the first business to give a client its own dashboard.', action: <Button onClick={() => setShowForm(true)}>Create business</Button> }}
          />
        )}
      </Card>

      {showForm && (
        <Modal title="Create business" wide onClose={() => { setShowForm(false); create.reset() }}
          footer={<><Button variant="ghost" onClick={() => { setShowForm(false); create.reset() }}>Cancel</Button><Button type="submit" form="create-business" loading={create.isPending}>Create business</Button></>}>
          <form id="create-business" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
            <p className="text-sm text-muted sm:col-span-2">A unique App ID is generated automatically when you save. It cannot be changed later.</p>
            <TextField label="Business name" required value={form.name} onChange={set('name')} error={shown('name')} />
            <TextField label="App name (shown to riders)" required value={form.appName} onChange={set('appName')} error={shown('appName')} />
            <TextField label="Android package name" required placeholder="com.company.rider" value={form.packageName} onChange={set('packageName')} error={shown('packageName')} />
            <TextField label="Head-office city (optional)" value={form.city} onChange={set('city')} />
            <SelectField label="Plan" value={form.plan} onChange={set('plan')}>
              <option value="trial">Trial</option><option value="standard">Standard</option><option value="enterprise">Enterprise</option>
            </SelectField>
            <TextField label="Brand colour" type="color" value={form.brandColor} onChange={set('brandColor')} error={shown('brandColor')} className="[&_input]:h-10 [&_input]:p-1" />
            <TextField label="Business admin name" required value={form.adminName} onChange={set('adminName')} error={shown('adminName')} />
            <TextField label="Business admin email" required type="email" value={form.adminEmail} onChange={set('adminEmail')} error={shown('adminEmail')} />
            {create.isError && !(create.error instanceof ApiError && Object.keys(create.error.fieldErrors).length) && <p role="alert" className="text-sm text-danger sm:col-span-2">{create.error.message}</p>}
          </form>
        </Modal>
      )}
    </>
  )
}
