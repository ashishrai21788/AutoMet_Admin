import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Plus } from 'lucide-react'
import { api } from '@/api'
import { useBusinessMutation, useOverview } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { Alert, Badge, Button, Card, EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui'

const REDIRECT_KEY = 'automet-admin-setup-redirected'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  )
}

export default function Dashboard() {
  const { user, tenantId, isSuper } = useScope()
  const navigate = useNavigate()
  const overview = useOverview()
  const complete = useBusinessMutation(api.business.completeSetup, { success: 'Setup confirmed' })
  const canManage = can(user, 'settings.manage')

  // First visit of the session by a business admin with unfinished setup: go straight to the next step.
  const next = overview.data?.setup.nextStep
  const setupDone = overview.data?.setup.complete
  useEffect(() => {
    if (!overview.data || isSuper || !canManage || setupDone || !next || next.key === 'confirm') return
    try {
      if (sessionStorage.getItem(REDIRECT_KEY) === tenantId) return
      sessionStorage.setItem(REDIRECT_KEY, tenantId ?? '')
    } catch { /* storage blocked: stay on the dashboard, the checklist still shows the next step */ return }
    navigate(next.path, { replace: true })
  }, [overview.data, isSuper, canManage, setupDone, next, tenantId, navigate])

  if (overview.isLoading) return <Spinner />
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
  const { business, setup, counts } = overview.data!

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${business.name} · App ID ${business.appId}`}
        action={setup.complete ? <Badge kind="ok">Setup complete</Badge> : <Badge kind="warn">Setup {setup.percent}%</Badge>}
      />

      {!setup.complete && (
        <Card className="mb-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Finish setting up {business.name}</h2>
              <p className="text-sm text-muted">Complete these steps so riders can be quoted real prices.</p>
            </div>
            <div className="w-full sm:w-56" aria-label={`Setup ${setup.percent}% complete`}>
              <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full bg-brand transition-all" style={{ width: `${setup.percent}%` }} /></div>
              <div className="mt-1 text-right text-xs text-muted">{setup.percent}% complete</div>
            </div>
          </div>
          <ol className="mt-4 space-y-2">
            {setup.steps.map((s, i) => (
              <li key={s.key} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                <span className="flex items-center gap-2 text-sm">
                  {s.done ? <CheckCircle2 size={18} className="text-ok" aria-label="Done" /> : <Circle size={18} className="text-muted" aria-label="Not done" />}
                  <span className={s.done ? 'text-muted line-through' : 'font-medium'}>{i + 1}. {s.title}</span>
                </span>
                {s.key === 'confirm' ? (
                  canManage && !s.done && (
                    <Button disabled={!setup.ready} loading={complete.isPending} onClick={() => complete.mutate(undefined as never)}>
                      Confirm setup
                    </Button>
                  )
                ) : !s.done && (
                  <Link to={s.path} className="inline-flex items-center gap-1 text-sm font-medium underline">Open <ArrowRight size={14} aria-hidden /></Link>
                )}
              </li>
            ))}
          </ol>
          {!setup.ready && <p className="mt-3 text-xs text-muted">"Confirm setup" unlocks once steps 1 to 3 are done.</p>}
        </Card>
      )}

      {setup.warnings.length > 0 && (
        <Card className="mb-6 border-brand/60 p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={16} className="text-amber-600" aria-hidden /> Configuration warnings</h2>
          <ul className="space-y-1.5 text-sm">
            {setup.warnings.map((w) => (
              <li key={w.message} className="flex flex-wrap items-center justify-between gap-2">
                <span>{w.message}</span>
                <Link to={w.path} className="text-sm underline">Fix</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Service regions" value={String(counts.regions)} hint={`${counts.activeRegions} active`} />
        <Stat label="Active vehicle categories" value={String(counts.activeCategories)} hint={`${counts.categories} in total`} />
        <Stat label="Categories with pricing" value={`${counts.pricedCategories} of ${counts.activeCategories}`} hint={counts.activeCategories ? undefined : 'Add a category first'} />
        <Stat label="Setup progress" value={`${setup.percent}%`} hint={setup.complete ? 'Confirmed' : setup.nextStep ? `Next: ${setup.nextStep.title}` : undefined} />
      </div>

      {canManage && (
        <Card className="mt-6 p-5">
          <h2 className="mb-3 font-semibold">Quick actions</h2>
          <div className="flex flex-wrap gap-2">
            <Link to="/regions?new=1"><Button variant="ghost"><Plus size={15} aria-hidden /> Add region</Button></Link>
            <Link to="/categories?new=1"><Button variant="ghost"><Plus size={15} aria-hidden /> Add vehicle category</Button></Link>
            <Link to="/pricing"><Button variant="ghost"><Plus size={15} aria-hidden /> Add fare rule</Button></Link>
          </div>
        </Card>
      )}

      <Card className="mt-6">
        <EmptyState
          title="Rides, drivers and revenue"
          text="Operational statistics are not available yet. They will appear here once this business's rider and driver apps send data tied to its App ID."
        />
      </Card>

      {complete.isError && <div className="mt-4"><Alert kind="error">{complete.error.message}</Alert></div>}
    </>
  )
}
