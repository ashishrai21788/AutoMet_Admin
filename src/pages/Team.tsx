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

/** The team of one business: its admins and staff. `embedded` drops the page title, for use inside another page. */
export function TeamManager({ tenantId, embedded = false }: { tenantId: string | null; embedded?: boolean }) {
  const { user, isSuper } = useScope()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewUserInput>(blank)
  const [touched, setTouched] = useState(false)
  const [created, setCreated] = useState<CreatedUser | null>(null)
  const [resetNotice, setResetNotice] = useState<{ title: string; email: string; password: string } | null>(null)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; role: NewUserInput['role'] }>({ name: '', role: 'operations' })

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

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name?: string; role?: NewUserInput['role'] } }) => api.users.update(id, input),
    onSuccess: (u) => { qc.invalidateQueries({ queryKey: ['users'] }); setEditing(null); toast.success(`${u.name} was updated`) },
    onError: (e) => { if (!(e instanceof ApiError) || Object.keys(e.fieldErrors).length === 0) toast.error(e.message) },
  })
  const resetTwoFactor = useMutation({
    mutationFn: (id: string) => api.users.resetTwoFactor(id),
    onSuccess: (u) => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(`Two-step verification was reset for ${u.name}`) },
    onError: (e) => toast.error(e.message),
  })
  async function doResetTwoFactor(u: AdminUser) {
    if (!(await confirm({ title: `Reset ${u.name}'s two-step verification?`, message: 'Use this when they have lost their phone and recovery codes. They are signed out everywhere, and sign in with their password only until they set it up again.', confirmLabel: 'Reset', danger: true }))) return
    resetTwoFactor.mutate(u.id)
  }
  const reset = useMutation({
    mutationFn: (id: string) => api.users.resetPassword(id),
    onSuccess: (r) => { setCreated(null); setResetNotice({ title: `New one-time password for ${r.name}`, email: r.email, password: r.temporaryPassword }); toast.success('Password reset') },
    onError: (e) => toast.error(e.message),
  })

  const local: Record<string, string> = {}
  if (form.name.trim().length < 2) local.name = 'Name is required'
  if (!EMAIL_RE.test(form.email.trim())) local.email = 'Enter a valid email address'
  const fe = { ...(touched ? local : {}), ...(create.error instanceof ApiError ? create.error.fieldErrors : {}) }
  const needsBusiness = isSuper && !tenantId
  // the platform owner manages a business's admin accounts only; the business's own admin manages everyone else
  const roles: NewUserInput['role'][] = isSuper ? ['client_admin'] : ASSIGNABLE

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    // the super admin adds people to the business selected in the top bar
    if (Object.keys(local).length === 0) create.mutate({ ...form, role: isSuper ? 'client_admin' : form.role, name: form.name.trim(), email: form.email.trim(), tenantId: isSuper ? tenantId ?? undefined : undefined })
  }

  async function toggle(u: AdminUser) {
    const deactivate = u.active !== false
    if (deactivate && !(await confirm({ title: `Deactivate ${u.name}?`, message: 'They are signed out immediately and cannot sign in until you activate them again.', confirmLabel: 'Deactivate', danger: true }))) return
    setActive.mutate({ id: u.id, active: !deactivate })
  }

  function openEdit(u: AdminUser) { setEditForm({ name: u.name, role: (u.role === 'super_admin' ? 'operations' : u.role) as NewUserInput['role'] }); update.reset(); setEditing(u) }

  async function doReset(u: AdminUser) {
    if (!(await confirm({ title: `Reset ${u.name}'s password?`, message: 'A new one-time password is created and shown to you once. They are signed out everywhere and must choose their own password at the next sign-in.', confirmLabel: 'Reset password', danger: true }))) return
    reset.mutate(u.id)
  }

  const columns: Column<AdminUser>[] = [
    { header: 'Name', cell: (u) => <span className="font-medium">{u.name}</span> },
    { header: 'Email', cell: (u) => u.email },
    { header: 'Role', cell: (u) => <Badge kind={u.role === 'super_admin' ? 'warn' : 'neutral'}>{ROLE_LABEL[u.role]}</Badge> },
    ...(isSuper ? [{ header: 'Business', cell: (u: AdminUser) => businessName(u.tenantId) } satisfies Column<AdminUser>] : []),
    { header: 'Status', cell: (u) => <Badge kind={u.active === false ? 'bad' : 'ok'}>{u.active === false ? 'Inactive' : 'Active'}</Badge> },
    { header: 'Actions', hideLabel: true, className: 'text-right', cell: (u) => u.role === 'super_admin' || (isSuper && u.role !== 'client_admin') ? null : (
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => openEdit(u)}>Edit</Button>
        {u.id !== user.id && <Button variant="ghost" loading={reset.isPending && reset.variables === u.id} onClick={() => doReset(u)}>Reset password</Button>}
        {u.id !== user.id && u.twoFactorEnabled && <Button variant="ghost" loading={resetTwoFactor.isPending && resetTwoFactor.variables === u.id} onClick={() => doResetTwoFactor(u)}>Reset 2-step</Button>}
        {u.id !== user.id && <Button variant={u.active === false ? 'ghost' : 'danger'} loading={setActive.isPending && setActive.variables?.id === u.id} onClick={() => toggle(u)}>{u.active === false ? 'Activate' : 'Deactivate'}</Button>}
      </div>
    ) },
  ]

  return (
    <>
      {embedded
        ? <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Admins and team</h2><Button onClick={() => setShowForm(true)}>Add team member</Button></div>
        : <PageHeader title="Team" subtitle="Admin accounts and their roles." action={<Button onClick={() => setShowForm(true)}>Add team member</Button>} />}
      {resetNotice && <SecretNotice title={resetNotice.title} email={resetNotice.email} password={resetNotice.password} onClose={() => setResetNotice(null)} />}
      {created && <SecretNotice title={`${created.name} was added`} email={created.email} password={created.temporaryPassword} onClose={() => setCreated(null)} />}

      <Card>
        {users.isLoading || businesses.isLoading ? <Spinner /> : users.isError ? <ErrorState error={users.error} onRetry={() => users.refetch()} /> : (
          <DataTable rows={users.data ?? []} columns={columns} rowKey={(u) => u.id} empty={{ title: 'No team members yet' }} />
        )}
      </Card>

      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}
          footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form="edit-member" loading={update.isPending}>Save</Button></>}>
          <form id="edit-member" noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); update.mutate({ id: editing.id, input: { ...(editForm.name.trim() !== editing.name ? { name: editForm.name.trim() } : {}), ...(!isSuper && editForm.role !== editing.role && editing.id !== user.id ? { role: editForm.role } : {}) } }) }}>
            <TextField label="Name" value={editForm.name} onChange={(e) => { setEditForm({ ...editForm, name: e.target.value }); update.reset() }} error={update.error instanceof ApiError ? update.error.fieldErrors.name : undefined} />
            {!isSuper && <SelectField label="Role" value={editForm.role} disabled={editing.id === user.id} onChange={(e) => { setEditForm({ ...editForm, role: e.target.value as NewUserInput['role'] }); update.reset() }} error={update.error instanceof ApiError ? update.error.fieldErrors.role : undefined}>
              {ASSIGNABLE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </SelectField>}
            {editing.id === user.id ? <p className="text-xs text-muted">You cannot change your own role.</p> : <p className="text-xs text-muted">Changing the role signs this person out; they sign in again with the new access.</p>}
            {update.isError && !(update.error instanceof ApiError && Object.keys(update.error.fieldErrors).length) && <p role="alert" className="text-sm text-danger">{update.error.message}</p>}
          </form>
        </Modal>
      )}

      {showForm && (
        <Modal title="Add team member" onClose={() => { setShowForm(false); create.reset() }}
          footer={needsBusiness ? <Button variant="ghost" onClick={() => setShowForm(false)}>Close</Button> : <><Button variant="ghost" onClick={() => { setShowForm(false); create.reset() }}>Cancel</Button><Button type="submit" form="add-member" loading={create.isPending}>Add member</Button></>}>
          {needsBusiness ? <Alert kind="warn">Pick a business in the top bar first; team members always belong to one business.</Alert> : (
            <form id="add-member" onSubmit={submit} noValidate className="space-y-4">
              <TextField label="Name" required value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); create.reset() }} error={fe.name} />
              <TextField label="Email" type="email" required value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); create.reset() }} error={fe.email} />
              <SelectField label="Role" value={isSuper ? 'client_admin' : form.role} disabled={isSuper} hint={isSuper ? 'You add the business’s admin. They add their own staff.' : undefined} onChange={(e) => setForm({ ...form, role: e.target.value as NewUserInput['role'] })}>
                {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </SelectField>
              {create.isError && !(create.error instanceof ApiError && Object.keys(create.error.fieldErrors).length) && <p role="alert" className="text-sm text-danger">{create.error.message}</p>}
            </form>
          )}
        </Modal>
      )}
    </>
  )
}

export default function Team() {
  const { tenantId } = useScope()
  return <TeamManager tenantId={tenantId} />
}
