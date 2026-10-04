import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, platform } from '@/api'
import { useAuth } from '@/store/auth'
import type { AdminUser, CreatedUser } from '@/lib/types'
import DataTable, { type Column } from '@/components/DataTable'
import Modal from '@/components/Modal'
import SecretNotice from '@/components/SecretNotice'
import { useConfirm, useToast } from '@/components/feedback'
import { Badge, Button, Card, ErrorState, PageHeader, Spinner, TextField } from '@/components/ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The platform owner's own accounts (AutoMet staff). Business staff are managed from each business's page. */
export default function PlatformTeam() {
  const me = useAuth((s) => s.session!.user)
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '' })
  const [touched, setTouched] = useState(false)
  const [secret, setSecret] = useState<{ title: string; email: string; password: string } | null>(null)
  const [renaming, setRenaming] = useState<AdminUser | null>(null)
  const [newName, setNewName] = useState('')

  const team = useQuery({ queryKey: ['platform-team'], queryFn: platform.team.list })
  const refresh = () => qc.invalidateQueries({ queryKey: ['platform-team'] })
  const fail = (e: Error) => { if (!(e instanceof ApiError) || !Object.keys(e.fieldErrors).length) toast.error(e.message) }

  const create = useMutation({
    mutationFn: () => platform.team.create({ name: form.name.trim(), email: form.email.trim() }),
    onSuccess: (r: CreatedUser) => { refresh(); setSecret({ title: `${r.name} was added to the platform team`, email: r.email, password: r.temporaryPassword }); setAdding(false); setForm({ name: '', email: '' }); setTouched(false); toast.success(`${r.name} was added`) },
    onError: fail,
  })
  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => platform.team.setActive(id, active),
    onSuccess: (u) => { refresh(); toast.success(`${u.name} is now ${u.active === false ? 'inactive' : 'active'}`) },
    onError: (e) => toast.error(e.message),
  })
  const reset = useMutation({
    mutationFn: (id: string) => platform.team.resetPassword(id),
    onSuccess: (r) => { setSecret({ title: `New one-time password for ${r.name}`, email: r.email, password: r.temporaryPassword }); toast.success('Password reset') },
    onError: (e) => toast.error(e.message),
  })
  const rename = useMutation({
    mutationFn: () => platform.team.rename(renaming!.id, newName.trim()),
    onSuccess: (u) => { refresh(); setRenaming(null); toast.success(`${u.name} was updated`) },
    onError: fail,
  })

  const local: Record<string, string> = {}
  if (form.name.trim().length < 2) local.name = 'Name is required'
  if (!EMAIL_RE.test(form.email.trim())) local.email = 'Enter a valid email address'
  const fe = { ...(touched ? local : {}), ...(create.error instanceof ApiError ? create.error.fieldErrors : {}) }

  async function toggle(u: AdminUser) {
    const off = u.active !== false
    if (off && !(await confirm({ title: `Deactivate ${u.name}?`, message: 'They are signed out immediately and cannot sign in until you activate them again.', confirmLabel: 'Deactivate', danger: true }))) return
    setActive.mutate({ id: u.id, active: !off })
  }
  async function doReset(u: AdminUser) {
    if (!(await confirm({ title: `Reset ${u.name}'s password?`, message: 'A new one-time password is shown to you once. They are signed out everywhere and must choose their own at the next sign-in.', confirmLabel: 'Reset password', danger: true }))) return
    reset.mutate(u.id)
  }

  const columns: Column<AdminUser>[] = [
    { header: 'Name', cell: (u) => <span className="font-medium">{u.name}{u.id === me.id && <span className="ml-1 text-xs text-muted">(you)</span>}</span> },
    { header: 'Email', cell: (u) => u.email },
    { header: 'Status', cell: (u) => <Badge kind={u.active === false ? 'bad' : 'ok'}>{u.active === false ? 'Inactive' : 'Active'}</Badge> },
    { header: 'Actions', hideLabel: true, className: 'text-right', cell: (u) => (
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => { setNewName(u.name); rename.reset(); setRenaming(u) }}>Rename</Button>
        {u.id !== me.id && <Button variant="ghost" loading={reset.isPending && reset.variables === u.id} onClick={() => doReset(u)}>Reset password</Button>}
        {u.id !== me.id && <Button variant={u.active === false ? 'ghost' : 'danger'} loading={setActive.isPending && setActive.variables?.id === u.id} onClick={() => toggle(u)}>{u.active === false ? 'Activate' : 'Deactivate'}</Button>}
      </div>
    ) },
  ]

  return (
    <>
      <PageHeader title="Platform team" subtitle="AutoMet staff who can manage businesses, plans and billing. They have no access to any business's operations." action={<Button onClick={() => setAdding(true)}>Add platform user</Button>} />
      {secret && <SecretNotice title={secret.title} email={secret.email} password={secret.password} onClose={() => setSecret(null)} />}
      <Card>
        {team.isLoading ? <Spinner /> : team.isError ? <ErrorState error={team.error} onRetry={() => team.refetch()} /> : <DataTable rows={team.data!} columns={columns} rowKey={(u) => u.id} empty={{ title: 'No platform users' }} />}
      </Card>

      {adding && (
        <Modal title="Add platform user" onClose={() => { setAdding(false); create.reset() }}
          footer={<><Button variant="ghost" onClick={() => { setAdding(false); create.reset() }}>Cancel</Button><Button type="submit" form="add-platform-user" loading={create.isPending}>Add user</Button></>}>
          <form id="add-platform-user" noValidate className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); setTouched(true); if (!Object.keys(local).length) create.mutate() }}>
            <p className="text-sm text-muted">The new person gets full platform-owner access: every business, plan, invoice and setting. Add only people you trust with that.</p>
            <TextField label="Name" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); create.reset() }} error={fe.name} />
            <TextField label="Email" type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); create.reset() }} error={fe.email} />
          </form>
        </Modal>
      )}

      {renaming && (
        <Modal title={`Rename ${renaming.name}`} onClose={() => setRenaming(null)}
          footer={<><Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button><Button type="submit" form="rename-platform-user" loading={rename.isPending}>Save</Button></>}>
          <form id="rename-platform-user" noValidate onSubmit={(e: FormEvent) => { e.preventDefault(); rename.mutate() }}>
            <TextField label="Name" value={newName} onChange={(e) => { setNewName(e.target.value); rename.reset() }} error={rename.error instanceof ApiError ? rename.error.fieldErrors.name : undefined} />
          </form>
        </Modal>
      )}
    </>
  )
}
