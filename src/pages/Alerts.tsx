import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { useAlerts } from '@/api/hooks'
import { fmtDateTime } from '@/lib/labels'
import type { AlertItem, OpsAlert } from '@/lib/types'
import { SEVERITY } from '@/lib/severity'
import { Badge, Button, Card, ErrorState, PageHeader, Spinner } from '@/components/ui'


/** Where an item of an alert opens. */
const itemLink = (i: AlertItem, fallback: string) =>
  i.kind === 'driver' ? `/drivers/${i.id}` : i.kind === 'vehicle' ? `/vehicles/${i.id}` : fallback

function AlertCard({ alert }: { alert: OpsAlert }) {
  const s = SEVERITY[alert.severity]
  const Icon = s.icon
  return (
    <Card className={`p-5 ${s.ring}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Icon size={20} className={alert.severity === 'critical' ? 'text-danger' : alert.severity === 'warning' ? 'text-amber-600' : 'text-muted'} aria-hidden />
          <div className="min-w-0">
            <h2 className="font-semibold">{alert.title}</h2>
            <p className="text-sm text-muted">{alert.detail}</p>
          </div>
        </div>
        <div className="flex items-center gap-2"><Badge kind={s.badge}>{s.label}</Badge><Link to={alert.link}><Button variant="ghost">Open</Button></Link></div>
      </div>
      {alert.items.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line text-sm">
          {alert.items.map((i) => (
            <li key={`${i.kind}-${i.id}-${i.label}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <Link to={itemLink(i, alert.link)} className="underline">{i.label}</Link>
              {i.detail && <span className="text-xs text-muted">{i.detail}</span>}
            </li>
          ))}
          {alert.more > 0 && <li className="px-3 py-2 text-xs text-muted">and {alert.more} more. <Link to={alert.link} className="underline">See all</Link></li>}
        </ul>
      )}
    </Card>
  )
}

export default function Alerts() {
  const alerts = useAlerts()
  if (alerts.isLoading) return <Spinner />
  if (alerts.isError) return <ErrorState error={alerts.error} onRetry={() => alerts.refetch()} />
  const { alerts: list, counts, generatedAt } = alerts.data!

  return (
    <>
      <PageHeader title="Alerts" subtitle={`Things that need attention, worked out from this business's live records. Checked ${fmtDateTime(generatedAt)}.`} action={<Button variant="ghost" loading={alerts.isFetching} onClick={() => alerts.refetch()}>Refresh</Button>} />
      {list.length === 0 ? (
        <Card className="p-10 text-center">
          <CheckCircle2 className="mx-auto mb-2 text-ok" size={28} aria-hidden />
          <h2 className="font-semibold">Nothing needs attention</h2>
          <p className="mt-1 text-sm text-muted">Setup, pricing, documents and drivers look fine.</p>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            <Badge kind="bad">{counts.critical} critical</Badge><Badge kind="warn">{counts.warning} warnings</Badge><Badge>{counts.info} for your information</Badge>
          </div>
          <div className="space-y-4">{list.map((a) => <AlertCard key={a.id} alert={a} />)}</div>
        </>
      )}
      <p className="mt-6 text-xs text-muted">Dispatch failures and payment failures are not reported yet because the platform does not record them.</p>
    </>
  )
}
