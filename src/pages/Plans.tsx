import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, platform } from '@/api'
import { fmtMoney } from '@/lib/labels'
import type { Cycle, Plan } from '@/lib/types'
import DataTable, { type Column } from '@/components/DataTable'
import Modal from '@/components/Modal'
import { CYCLE_LABEL, refreshPlatform } from '@/lib/billing'
import { useConfirm, useToast } from '@/components/feedback'
import { Badge, Button, Card, ErrorState, Field, PageHeader, SelectField, Spinner, TextField, Textarea } from '@/components/ui'

interface Form { name: string; description: string; price: string; cycle: Cycle; setupFee: string; trialDays: string }
const blank: Form = { name: '', description: '', price: '', cycle: 'monthly', setupFee: '', trialDays: '' }

function PlanModal({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState<Form>(plan ? { name: plan.name, description: plan.description, price: String(plan.price), cycle: plan.cycle, setupFee: String(plan.setupFee), trialDays: plan.trialDays === null ? '' : String(plan.trialDays) } : blank)
  const save = useMutation({
    mutationFn: () => {
      const input = { name: form.name.trim(), description: form.description.trim(), price: form.price, cycle: form.cycle, setupFee: form.setupFee || 0, trialDays: form.trialDays === '' ? null : form.trialDays }
      return plan ? platform.updatePlan(plan.id, input) : platform.createPlan(input)
    },
    onSuccess: async (p) => { await refreshPlatform(qc); toast.success(plan ? `${p.name} was updated` : `${p.name} was created`); onClose() },
    onError: (e) => { if (!(e instanceof ApiError) || !Object.keys(e.fieldErrors).length) toast.error(e.message) },
  })
  const fe = save.error instanceof ApiError ? save.error.fieldErrors : {}
  const set = (k: keyof Form) => (e: { target: { value: string } }) => { setForm({ ...form, [k]: e.target.value }); save.reset() }
  return (
    <Modal title={plan ? `Edit ${plan.name}` : 'New plan'} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="plan-form" loading={save.isPending}>{plan ? 'Save' : 'Create plan'}</Button></>}>
      <form id="plan-form" noValidate className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate() }}>
        {plan && <p className="text-xs text-muted">A new price applies to new subscriptions only. Businesses already on this plan keep the price they agreed.</p>}
        <TextField label="Plan name" value={form.name} onChange={set('name')} maxLength={60} error={fe.name} />
        <Field label="Description (optional)" error={fe.description}>{(p) => <Textarea {...p} rows={2} maxLength={300} value={form.description} onChange={set('description')} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Price" type="number" min="0" step="0.01" value={form.price} onChange={set('price')} error={fe.price} />
          <SelectField label="Billed" value={form.cycle} onChange={set('cycle')} error={fe.cycle}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></SelectField>
          <TextField label="Setup fee (optional)" type="number" min="0" step="0.01" hint="One-time, invoiced when a business starts." value={form.setupFee} onChange={set('setupFee')} error={fe.setupFee} />
          <TextField label="Trial days (optional)" type="number" min="0" max="365" hint="Empty uses the platform default." value={form.trialDays} onChange={set('trialDays')} error={fe.trialDays} />
        </div>
      </form>
    </Modal>
  )
}

export default function Plans() {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Plan | 'new' | null>(null)
  const plans = useQuery({ queryKey: ['platform-plans'], queryFn: platform.plans })
  const toggle = useMutation({
    mutationFn: (p: Plan) => platform.updatePlan(p.id, { active: !p.active }),
    onSuccess: async (p) => { await refreshPlatform(qc); toast.success(`${p.name} is now ${p.active ? 'available' : 'retired'}`) },
    onError: (e) => toast.error(e.message),
  })

  if (plans.isLoading) return <Spinner />
  if (plans.isError) return <ErrorState error={plans.error} onRetry={() => plans.refetch()} />

  async function retire(p: Plan) {
    if (p.active && p.subscribers > 0 && !(await confirm({ title: `Retire ${p.name}?`, message: `${p.subscribers} business${p.subscribers === 1 ? ' is' : 'es are'} on it and keep it. It just can no longer be given to anyone new.`, confirmLabel: 'Retire' }))) return
    toggle.mutate(p)
  }

  const columns: Column<Plan>[] = [
    { header: 'Plan', cell: (p) => <div><div className="font-medium">{p.name}</div>{p.description && <div className="text-xs text-muted">{p.description}</div>}</div> },
    { header: 'Price', cell: (p) => <span className="text-sm tabular-nums">{fmtMoney(p.price, p.currency)} / {CYCLE_LABEL[p.cycle]}</span> },
    { header: 'Setup fee', cell: (p) => <span className="text-sm tabular-nums">{p.setupFee ? fmtMoney(p.setupFee, p.currency) : '—'}</span> },
    { header: 'Trial', cell: (p) => <span className="text-sm">{p.trialDays === null ? 'Default' : `${p.trialDays} days`}</span> },
    { header: 'Subscribers', cell: (p) => <span className="text-sm tabular-nums">{p.subscribers}</span> },
    { header: 'Status', cell: (p) => <Badge kind={p.active ? 'ok' : 'neutral'}>{p.active ? 'Available' : 'Retired'}</Badge> },
    { header: 'Actions', hideLabel: true, className: 'text-right', cell: (p) => <div className="flex justify-end gap-1"><Button variant="ghost" onClick={() => setEditing(p)}>Edit</Button><Button variant="ghost" loading={toggle.isPending && toggle.variables?.id === p.id} onClick={() => retire(p)}>{p.active ? 'Retire' : 'Make available'}</Button></div> },
  ]

  return (
    <>
      <PageHeader title="Plans" subtitle="What you sell to businesses. Assign a plan from a business's page to start its subscription." action={<Button onClick={() => setEditing('new')}>New plan</Button>} />
      <Card><DataTable rows={plans.data!} columns={columns} rowKey={(p) => p.id} empty={{ title: 'No plans yet', text: 'Create a plan, then put a business on it.', action: <Button onClick={() => setEditing('new')}>New plan</Button> }} /></Card>
      {editing && <PlanModal plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
