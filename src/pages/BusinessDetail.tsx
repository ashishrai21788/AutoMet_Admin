import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Copy } from 'lucide-react'
import { api, platform } from '@/api'
import { fmtDate, fmtMoney } from '@/lib/labels'
import EditBusinessModal from '@/components/EditBusinessModal'
import { TeamManager } from '@/pages/Team'
import { CYCLE_LABEL, refreshPlatform } from '@/lib/billing'
import { AssignPlanModal, InvoiceTable, IssueInvoiceModal, SubscriptionBadge } from '@/components/billing'
import ReasonModal from '@/components/ReasonModal'
import { useConfirm, useToast } from '@/components/feedback'
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui'

const statusKind = { active: 'ok', trial: 'warn', suspended: 'bad' } as const

/** This business's subscription to the platform and what it has been billed. Never the business's own ride money. */
function BillingPanel({ appId, name }: { appId: string; name: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [modal, setModal] = useState<'assign' | 'invoice' | 'cancel' | null>(null)
  const billing = useQuery({ queryKey: ['platform-billing', appId], queryFn: () => platform.billing(appId) })
  const plans = useQuery({ queryKey: ['platform-plans'], queryFn: platform.plans })
  const renew = useMutation({
    mutationFn: (invoice: boolean) => platform.renewSubscription(appId, invoice),
    onSuccess: async (r) => { await refreshPlatform(qc); toast.success(r.invoice ? `Renewed and invoiced (${r.invoice.number})` : 'Subscription renewed') },
    onError: (e) => toast.error(e.message),
  })

  if (billing.isLoading) return <Card className="mt-5 p-5"><Spinner /></Card>
  if (billing.isError) return <Card className="mt-5 p-5"><ErrorState error={billing.error} onRetry={() => billing.refetch()} /></Card>
  const b = billing.data!
  const sub = b.subscription
  const cur = sub?.currency ?? b.invoices[0]?.currency ?? 'INR'
  const live = sub && sub.status !== 'cancelled'

  return (
    <Card className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <h2 className="font-semibold">Subscription and billing</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModal('assign')}>{sub ? 'Change plan' : 'Assign a plan'}</Button>
          {sub && <Button variant="ghost" onClick={() => setModal('invoice')}>Issue invoice</Button>}
          {!sub && <Button variant="ghost" onClick={() => setModal('invoice')}>Issue one-off invoice</Button>}
        </div>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div>
          {!sub ? <p className="text-sm text-muted">{name} is not on a plan yet, so it adds nothing to recurring revenue. Assign a plan to start a trial or a paid subscription.</p> : (
            <dl className="divide-y divide-line">
              <Row label="Status"><SubscriptionBadge status={sub.status} /></Row>
              <Row label="Plan">{sub.planName ?? '—'}</Row>
              <Row label="Price">{fmtMoney(sub.price, cur)} / {CYCLE_LABEL[sub.cycle]}</Row>
              <Row label="Started">{fmtDate(sub.startDate)}</Row>
              {sub.status === 'trialing' && <Row label="Trial ends">{fmtDate(sub.trialEndsAt)}</Row>}
              {live && <Row label={sub.status === 'trialing' ? 'First payment due' : 'Next renewal'}>{fmtDate(sub.renewalDate)}</Row>}
              {sub.status === 'cancelled' && <Row label="Cancelled">{fmtDate(sub.cancelledAt)}{sub.cancelReason ? ` · ${sub.cancelReason}` : ''}</Row>}
              <Row label="Counts as recurring revenue">{sub.recurring ? 'Yes' : 'No'}</Row>
              {sub.notes && <Row label="Notes">{sub.notes}</Row>}
            </dl>
          )}
          {live && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="ghost" loading={renew.isPending} onClick={() => renew.mutate(false)}>{sub.status === 'trialing' ? 'Convert to paid' : 'Renew period'}</Button>
              <Button variant="ghost" loading={renew.isPending} onClick={() => renew.mutate(true)}>{sub.status === 'trialing' ? 'Convert and invoice' : 'Renew and invoice'}</Button>
              <Button variant="danger" onClick={() => setModal('cancel')}>Cancel subscription</Button>
            </div>
          )}
        </div>
        <dl className="divide-y divide-line self-start">
          <Row label="Billed">{fmtMoney(b.totals.billed, cur)}</Row>
          <Row label="Collected">{fmtMoney(b.totals.collected, cur)}</Row>
          <Row label="Refunded">{fmtMoney(b.totals.refunded, cur)}</Row>
          <Row label="Outstanding">{fmtMoney(b.totals.outstanding, cur)}</Row>
        </dl>
      </div>
      <div className="border-t border-line"><InvoiceTable rows={b.invoices} showBusiness={false} /></div>

      {modal === 'assign' && <AssignPlanModal appId={appId} businessName={name} plans={plans.data ?? []} current={sub} onClose={() => setModal(null)} />}
      {modal === 'invoice' && <IssueInvoiceModal appId={appId} subscription={sub} onClose={() => setModal(null)} />}
      {modal === 'cancel' && (
        <ReasonModal title={`Cancel ${name}'s subscription?`} intro={<>It stops counting as recurring revenue and no further renewals are expected. The business itself is not suspended; use Suspend for that. Invoices already issued stay.</>}
          confirmLabel="Cancel subscription" successText="Subscription cancelled"
          onSubmit={async (reason) => { await platform.cancelSubscription(appId, reason); await refreshPlatform(qc) }} onClose={() => setModal(null)} />
      )}
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-4 py-2 text-sm"><dt className="text-muted">{label}</dt><dd className="min-w-0 text-right">{children}</dd></div>
}

/**
 * One business, from the platform owner's side: its identity and plan, whether it is set up, how much it is used (counts
 * only), and who administers it. The business's own drivers, riders, trips and documents are not shown here; they belong to
 * the business and its admins.
 */
export default function BusinessDetail() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)

  const list = useQuery({ queryKey: ['businesses'], queryFn: api.businesses.list })
  const overview = useQuery({ queryKey: ['platform-overview'], queryFn: platform.overview })

  const changeStatus = useMutation({
    mutationFn: (next: 'active' | 'trial' | 'suspended') => api.businesses.setStatus(id, next),
    onSuccess: (b) => { refreshPlatform(qc); toast.success(`${b.name} is now ${b.status}`) },
    onError: (e) => toast.error(e.message),
  })

  if (list.isLoading) return <Spinner />
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />
  const b = list.data!.find((x) => x.appId === id)
  if (!b) return <EmptyState title="Business not found" text="It may have been removed." action={<Link to="/businesses"><Button>All businesses</Button></Link>} />
  const usage = overview.data?.businesses.find((x) => x.appId === id)

  async function toggle() {
    const suspending = b!.status !== 'suspended'
    const ok = await confirm({
      title: suspending ? `Suspend ${b!.name}?` : `Activate ${b!.name}?`,
      message: suspending ? 'Its admins are signed out immediately and cannot sign in until you activate it again. Its apps stop working. Other businesses are not affected.' : 'Its admins will be able to sign in again.',
      confirmLabel: suspending ? 'Suspend' : 'Activate', danger: suspending,
    })
    if (ok) changeStatus.mutate(suspending ? 'suspended' : b!.plan === 'trial' ? 'trial' : 'active')
  }

  return (
    <>
      <Link to="/businesses" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={15} aria-hidden /> All businesses</Link>
      <PageHeader
        title={b.name}
        subtitle={`${b.appName} · ${b.packageName}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge kind={statusKind[b.status]}>{b.status}</Badge>
            <Button variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
            <Button variant={b.status === 'suspended' ? 'ghost' : 'danger'} loading={changeStatus.isPending} onClick={toggle}>{b.status === 'suspended' ? 'Activate' : 'Suspend'}</Button>
          </div>
        }
      />
      {editing && <EditBusinessModal business={b} onClose={() => setEditing(false)} />}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-2 font-semibold">Details</h2>
          <dl className="divide-y divide-line">
            <Row label="App ID"><span className="inline-flex items-center gap-1 font-mono text-xs">{b.appId}<button type="button" aria-label="Copy App ID" className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10" onClick={async () => { try { await navigator.clipboard.writeText(b.appId); toast.success('App ID copied') } catch { toast.error('Could not copy') } }}><Copy size={13} /></button></span></Row>
            <Row label="City">{b.city || '—'}</Row>
            <Row label="Operating market">{b.market ? `${b.market.country} · ${b.market.currency}` : 'Not set yet'}</Row>
            <Row label="Created">{fmtDate(b.createdAt)}</Row>
            <Row label="Setup">{b.setup ? (b.setup.complete ? <Badge kind="ok">Complete</Badge> : <span>{b.setup.percent}%{b.setup.nextStep ? ` · next: ${b.setup.nextStep}` : ''}</span>) : '—'}</Row>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="mb-2 font-semibold">Usage</h2>
          {overview.isLoading ? <Spinner /> : !usage ? <p className="text-sm text-muted">No usage figures yet.</p> : (
            <dl className="divide-y divide-line">
              <Row label="Drivers">{usage.drivers.total} <span className="text-muted">({usage.drivers.online} online)</span></Row>
              <Row label="Riders">{usage.riders.total} <span className="text-muted">(+{usage.riders.newThisWeek} this week)</span></Row>
              <Row label="Trips today">{usage.trips.requestedToday} <span className="text-muted">({usage.trips.active} in progress)</span></Row>
              <Row label="Trips in 7 days">{usage.trips.last7Days}</Row>
              <Row label="Admin accounts">{usage.admins}</Row>
            </dl>
          )}
          <p className="mt-3 text-xs text-muted">Counts only. The business's own drivers, riders, trips and documents are managed by its own admins.</p>
        </Card>
      </div>

      <BillingPanel appId={b.appId} name={b.name} />

      <Card className="mt-5 p-5"><TeamManager tenantId={b.appId} embedded /></Card>
    </>
  )
}
