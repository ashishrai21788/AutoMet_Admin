import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError, fleet } from '@/api'
import { useScope } from '@/lib/useScope'
import { can } from '@/lib/permissions'
import { useConfirm, useToast } from '@/components/feedback'
import { Alert, Card, ErrorState, PageHeader, Spinner, Toggle } from '@/components/ui'

const REASON_TEXT: Record<string, string> = {
  DRIVER_NOT_VERIFIED: 'Not verified (documents missing, pending, rejected or expired)',
  NO_VEHICLE: 'No vehicle assigned',
  NO_REGION: 'No operating region',
  REGION_INACTIVE: 'Operating region is not active',
  VEHICLE_NOT_ACTIVE: 'Assigned vehicle is not active',
  VEHICLE_NOT_VERIFIED: 'Assigned vehicle is not verified',
  CATEGORY_MISMATCH: 'Vehicle is not of the driver\'s eligible category',
  REGION_MISMATCH: 'Vehicle operates in a different region',
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  )
}

export default function RideSettings() {
  const { user, tenantId } = useScope()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const canEdit = can(user, 'settings.manage')
  const [busy, setBusy] = useState(false)
  const stats = useQuery({ queryKey: ['biz', tenantId, 'availability'], queryFn: fleet.availability, enabled: !!tenantId, refetchInterval: 30000 })
  const settings = useQuery({ queryKey: ['biz', tenantId, 'ride-settings'], queryFn: fleet.rideSettings.get, enabled: !!tenantId })

  if (settings.isLoading) return <Spinner />
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
  const enforced = settings.data!.requireEligibleDrivers
  const a = stats.data
  const forbidden = stats.error instanceof ApiError && stats.error.status === 403
  const blockedList = a ? Object.entries(a.blockedBy).sort((x, y) => y[1] - x[1]) : []

  async function change(next: boolean) {
    if (busy) return
    if (next && a && a.notEligible > 0) {
      const ok = await confirm({
        title: 'Require eligible drivers?',
        message: `${a.notEligible} of ${a.totalDrivers} drivers are not eligible yet and will not be able to go online or receive rides until they are verified and have an approved vehicle.${a.onlineNotEligible > 0 ? ` ${a.onlineNotEligible} of them are online now; they stay online until they go offline, but ride requests to them will be refused.` : ''}`,
        confirmLabel: 'Turn on', danger: true,
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      await fleet.rideSettings.update({ requireEligibleDrivers: next })
      await qc.invalidateQueries({ queryKey: ['biz', tenantId] })
      toast.success(next ? 'Only eligible drivers can now receive rides' : 'Eligibility is no longer required')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader title="Ride Settings" subtitle="Rules for which drivers can go online and receive ride requests." />

      <Card className="mb-6 p-5">
        <h2 className="font-semibold">Driver eligibility</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          A driver is eligible when their account is active, their documents are verified and unexpired, they have an operating region, and an approved, active vehicle of the right category is assigned.
        </p>
        <Toggle label="Only eligible drivers can go online and receive rides" checked={enforced} disabled={!canEdit || busy} onChange={change} />
        {!canEdit && <p className="mt-2 text-xs text-muted">Your role can view this setting but not change it.</p>}
        <div className="mt-4 space-y-2 text-sm">
          <p><strong>{enforced ? 'On:' : 'Off:'}</strong> {enforced
            ? 'a driver who is not eligible is refused when going online and when a rider requests them.'
            : 'drivers who are not verified can still go online. Turn this on once your drivers and vehicles are set up.'}</p>
          <p className="text-muted"><strong className="text-ink">Always on:</strong> a suspended or inactive driver can never go online or receive rides, whatever this setting says, and is taken offline the moment they are suspended.</p>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Drivers right now</h2>
        {stats.isLoading ? <Spinner /> : forbidden ? <p className="mt-2 text-sm text-muted">Your role cannot see driver numbers.</p> : stats.isError ? <ErrorState error={stats.error} onRetry={() => stats.refetch()} /> : (
          <>
            <p className="mb-4 mt-1 text-sm text-muted">"Online" is what each driver's app reports. Live locations and a map are not available here yet.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Drivers" value={a!.totalDrivers} hint={`${a!.activeAccounts} with an active account`} />
              <Stat label="Eligible" value={a!.eligible} hint={`${a!.notEligible} not eligible`} />
              <Stat label="Online now" value={a!.online} />
              <Stat label="Online and eligible" value={a!.onlineEligible} hint={a!.onlineNotEligible ? `${a!.onlineNotEligible} online but not eligible` : undefined} />
            </div>
            {blockedList.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-sm font-medium">{enforced ? 'Why active drivers are blocked' : 'Active drivers who would be blocked if this were on'}</h3>
                <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                  {blockedList.map(([code, n]) => <li key={code} className="flex justify-between gap-3 px-4 py-2"><span>{REASON_TEXT[code] ?? code}</span><span className="tabular-nums text-muted">{n} driver{n === 1 ? '' : 's'}</span></li>)}
                </ul>
                <p className="mt-2 text-xs text-muted">A driver can have more than one reason, so these counts can add up to more than the number of drivers.</p>
              </div>
            )}
            {a!.truncated && <div className="mt-4"><Alert kind="warn">This business has more drivers than the summary reads at once, so the numbers are partial.</Alert></div>}
          </>
        )}
      </Card>
    </>
  )
}
