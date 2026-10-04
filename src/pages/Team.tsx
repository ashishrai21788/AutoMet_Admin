import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/api'
import { useScope } from '@/lib/useScope'
import { ROLE_LABEL } from '@/lib/permissions'
import type { AdminUser, CreatedUser, NewUserInput } from '@/lib/types'
import DataTable, { type Column } from '@/components/DataTable'
import Modal from '@/components/Modal'
import SecretNotice from '@/components/SecretNotice'
import { useConfirm, useToast } from '@/components/feedback'
import { Alert, Badge, Button, Card, ErrorState, PageHeader, SelectField, Spinner, TextField } from '@/components/ui'

const ASSIGNABLE: NewUserInput['role'][] = ['client_admin', 'operations', 'support', 'finance']
const blank: NewUserInput = { name: '', email: '', role: 'operations' }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Team() {
  const { user, tenantId, isSuper } = useScope()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewUserInput>(blank)
  const [touched, setTouched] = useState(false)
  const [created, setCreated] = useState<CreatedUser | null>(null)

  const businesses = useQuery({ queryKey: ['businesses'], queryFn: api.businesses.list })
  const users = useQuery({ queryKey: ['users', tenantId], queryFn: () => api.users.list(tenantId) })
  const businessName = (id: string | null) => (id ? businesses.data?.find((b) => b.appId === id)?.name ?? id : 'Platform')

  const create = useMutation({
    mutationFn: (input: NewUserInput) => api.users.create(input),
    onSuccess: (result) => { qc.invalidateQueries({ queryKey: ['users'] }); setCreated(result); setForm(blank); setTouched(false); setShowForm(false); toast.success(`${result.name} was added`) },
    onError: (e) => { if (!(e instanceof ApiError) || Object.keys(e.fieldErrors).length === 0) toast.error(e.message) },
  })
  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.users.setActive(id, active),
    onSuccess: (u) => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(`${u.name} is now ${u.active === false ? 'inactive' : 'active'}`) },
    onError: (e) => toast.error(e.message),
  })

  const local: Record<string, string> = {}
  if (form.name.trim().length < 2) local.name = 'Name is required'
  if (!EMAIL_RE.test(form.email.trim())) local.email = 'Enter a valid email address'
  const fe = { ...(touched ? local : {}), ...(create.error instanceof ApiError ? create.error.fieldErrors : {}) }
  const needsBusiness = isSuper && !tenantId

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    // the super admin adds people to the business selected in the top bar
    if (Object.keys(local).length === 0) create.mutate({ ...form, name: form.name.trim(), email: form.email.trim(), tenantId: isSuper ? tenantId ?? undefined : undefined })
  }

  async function toggle(u: AdminUser) {
    const deactivate = u.active !== false
    if (deactivate && !(await confirm({ title: `Deactivate ${u.name}?`, message: 'They are signed out immediately and cannot sign in until you activate them again.', confirmLabel: 'Deactivate', danger: true }))) return
    setActive.mutate({ id: u.id, active: !deactivate })
  }

  const columns: Column<AdminUser>[] = [
    { header: 'Name', cell: (u) => <span className="font-medium">{u.name}</span> },
    { header: 'Email', cell: (u) => u.email },
    { header: 'Role', cell: (u) => <Badge kind={u.role === 'super_admin' ? 'warn' : 'neutral'}>{ROLE_LABEL[u.role]}</Badge> },
    ...(isSuper ? [{ header: 'Business', cell: (u: AdminUser) => businessName(u.tenantId) } satisfies Column<AdminUser>] : []),
    { header: 'Status', cell: (u) => <Badge kind={u.active === false ? 'bad' : 'ok'}>{u.active === false ? 'Inactive' : 'Active'}</Badge> },
    { header: 'Actions', hideLabel: true, className: 'text-right', cell: (u) => u.id !== user.id ? (
      <Button variant={u.active === false ? 'ghost' : 'danger'} loading={setActive.isPending && setActive.variables?.id === u.id} onClick={() => toggle(u)}>{u.active === false ? 'Activate' : 'Deactivate'}</Button>
    ) : null },
  ]

  return (
    <>
      <PageHeader title="Team" subtitle="Admin accounts and their roles." action={<Button onClick={() => setShowForm(true)}>Add team member</Button>} />
      {created && <SecretNotice title={`${created.name} was added`} email={created.email} password={created.temporaryPassword} onClose={() => setCreated(null)} />}

      <Card>
        {users.isLoading || businesses.isLoading ? <Spinner /> : users.isError ? <ErrorState error={users.error} onRetry={() => users.refetch()} /> : (
          <DataTable rows={users.data ?? []} columns={columns} rowKey={(u) => u.id} empty={{ title: 'No team members yet' }} />
        )}
      </Card>

      {showForm && (
        <Modal title="Add team member" onClose={() => { setShowForm(false); create.reset() }}
          footer={needsBusiness ? <Button variant="ghost" onClick={() => setShowForm(false)}>Close</Button> : <><Button variant="ghost" onClick={() => { setShowForm(false); create.reset() }}>Cancel</Button><Button type="submit" form="add-member" loading={create.isPending}>Add member</Button></>}>
          {needsBusiness ? <Alert kind="warn">Pick a business in the top bar first; team members always belong to one business.</Alert> : (
            <form id="add-member" onSubmit={submit} noValidate className="space-y-4">
              <TextField label="Name" required value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); create.reset() }} error={fe.name} />
              <TextField label="Email" type="email" required value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); create.reset() }} error={fe.email} />
              <SelectField label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as NewUserInput['role'] })}>
                {ASSIGNABLE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </SelectField>
              {create.isError && !(create.error instanceof ApiError && Object.keys(create.error.fieldErrors).length) && <p role="alert" className="text-sm text-danger">{create.error.message}</p>}
            </form>
          )}
        </Modal>
      )}
    </>
  )
}
