import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { useBusinessMutation, useSurge } from '@/api/hooks'
import { Alert, Badge, Card, ErrorState, Spinner, Toggle } from '@/components/ui'

/**
 * Surge pricing: which areas are surging right now, and a switch that stops all surge at once. Which fare rules may surge, and by
 * how much at most, is set on each fare rule; the multiplier itself follows the demand and the drivers around a pickup.
 */
export default function SurgePanel({ canEdit }: { canEdit: boolean }) {
  const q = useSurge()
  const qc = useQueryClient()
  const pause = useBusinessMutation((paused: boolean) => api.business.setSurgePaused(paused), { success: 'Surge settings saved', onSuccess: () => { void qc.invalidateQueries({ queryKey: ['biz'] }) } })

  if (q.isLoading) return <Card className="mb-6 p-5"><Spinner /></Card>
  if (q.isError) return <Card className="mb-6 p-5"><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>
  const d = q.data!
  if (d.rules.length === 0 && !d.paused) {
    return <Card className="mb-6 p-5"><h2 className="font-semibold">Surge pricing</h2><p className="mt-1 text-sm text-muted">Off for every fare rule. Switch on "Allow surge pricing" in a fare rule below, with the most it may multiply the ride charge, to let fares rise when many riders wait for few drivers.</p></Card>
  }
  return (
    <Card className="mb-6 p-5">
      <h2 className="font-semibold">Surge pricing</h2>
      <p className="mb-3 mt-1 text-sm text-muted">When many riders are near a pickup and few drivers are free, the ride charge is multiplied, never above the maximum on the fare rule. Riders see the surge line before they book and are never charged more than they were shown.</p>
      <Toggle label="Pause all surge pricing" checked={d.paused} disabled={!canEdit || pause.isPending} onChange={(v) => pause.mutate(v)} />
      {d.paused && <div className="mt-3"><Alert kind="warn">Surge is paused: every fare uses the normal rule until you resume.</Alert></div>}
      {!d.paused && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium">Right now</h3>
          {d.areas.length === 0 ? <p className="text-sm text-muted">No service area with a map position and a surge-enabled rule to measure.</p> : (
            <ul className="divide-y divide-line rounded-lg border border-line text-sm">
              {d.areas.map((a) => (
                <li key={`${a.regionId}|${a.categoryId}`} className="flex flex-wrap items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1"><span className="font-medium">{a.category}</span> <span className="text-muted">· {a.area}</span></span>
                  <span className="text-xs text-muted">{a.demand} waiting · {a.supply} drivers free</span>
                  {a.multiplier > 1 ? <Badge kind="warn">×{a.multiplier}</Badge> : <Badge kind="ok">Normal</Badge>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            Demand counts riders with the app open and requests in the last 10 minutes within {d.nearKm} km of the pickup; at least {d.minDemand} are needed. Waiting riders per free driver: {d.ladder.map((l) => `${l.ratio}+ → ×${l.multiplier}`).join(', ')}. Held for a minute so fares do not flicker.
          </p>
        </div>
      )}
    </Card>
  )
}
