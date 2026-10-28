import { Link } from 'react-router-dom'
import { ops } from '@/api'
import { useBusinessMutation, useCommission, useDrivers } from '@/api/hooks'
import { fmtMinor } from '@/lib/payments'
import { useConfirm } from '@/components/feedback'
import DataTable, { type Column } from '@/components/DataTable'
import { Alert, Button, Card, ErrorState, Spinner } from '@/components/ui'
import type { CommissionRow } from '@/lib/payments'

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return <Card className="p-4"><div className="text-xs text-muted">{label}</div><div className="text-lg font-semibold">{value}</div><div className="text-xs text-muted">{note}</div></Card>
}

/**
 * What drivers owe the business from cash fares, and what the business owes drivers. Four amounts that mean different things:
 * earned (commission on cash fares drivers collected), collected (actually received: recovered from online earnings or paid online),
 * outstanding (still owed by the driver, a receivable, not revenue in hand), and owed to drivers (online earnings not yet paid out).
 */
export default function CommissionTab({ canManage }: { canManage: boolean }) {
  const q = useCommission()
  const drivers = useDrivers({ pageSize: 100 })
  const confirm = useConfirm()
  const recover = useBusinessMutation((driverId: string) => ops.payments.recover(driverId), {
    success: (r) => (r.recovered_minor > 0 ? 'Recovered from the driver\'s online earnings' : 'Nothing could be recovered: the driver is owed nothing right now'),
  })

  if (q.isLoading) return <Spinner />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const d = q.data!
  const names = new Map((drivers.data?.items ?? []).map((x) => [x.id, x.name]))

  async function ask(row: CommissionRow) {
    const at = Math.min(row.outstanding_minor, row.payable_minor)
    const ok = await confirm({
      title: 'Recover commission now?',
      message: `Take up to ${fmtMinor(at, d.currency)} of the commission this driver owes from cash fares out of the online earnings you owe them. The cash fares' own entries are not changed; the recovery is booked separately.`,
      confirmLabel: 'Recover',
    })
    if (ok) recover.mutate(row.driver_id)
  }

  const columns: Column<CommissionRow>[] = [
    { header: 'Driver', cell: (r) => <Link className="underline" to={`/drivers/${r.driver_id}`}>{names.get(r.driver_id) ?? r.driver_id}</Link> },
    { header: 'Earned on cash fares', cell: (r) => fmtMinor(r.accrued_minor, d.currency) },
    { header: 'Collected', cell: (r) => fmtMinor(r.collected_minor, d.currency) },
    { header: 'Still owed by the driver', cell: (r) => <span className={r.outstanding_minor > 0 ? 'font-medium' : 'text-muted'}>{fmtMinor(Math.max(0, r.outstanding_minor), d.currency)}</span> },
    { header: 'Owed to the driver', cell: (r) => fmtMinor(Math.max(0, r.payable_minor), d.currency) },
    { header: '', hideLabel: true, className: 'text-right', cell: (r) => (canManage && r.outstanding_minor > 0 && r.payable_minor > 0
      ? <Button variant="ghost" loading={recover.isPending && recover.variables === r.driver_id} onClick={() => ask(r)}>Recover</Button> : null) },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Earned" value={fmtMinor(d.totals.accrued_minor, d.currency)} note="commission on cash fares drivers collected" />
        <Figure label="Collected" value={fmtMinor(d.totals.collected_minor, d.currency)} note="recovered from online earnings or paid by drivers" />
        <Figure label="Still owed by drivers" value={fmtMinor(Math.max(0, d.totals.outstanding_minor), d.currency)} note="a receivable: not money in hand" />
        <Figure label="Owed to drivers" value={fmtMinor(Math.max(0, d.totals.payable_minor), d.currency)} note="online earnings not yet paid out" />
      </div>
      <Alert kind="info">Cash a driver collects is theirs, not the business's. The business is only owed its commission on it. Commission is recovered from the driver's later online earnings when the business's payment settings allow it, or the driver can pay it online.</Alert>
      <Card className="p-0">
        <DataTable rows={d.drivers} columns={columns} rowKey={(r) => r.driver_id} pageSize={12} empty={{ title: 'No driver has owed commission yet', text: 'Drivers appear here once they confirm cash fares or earn from online payments.' }} />
      </Card>
    </div>
  )
}
