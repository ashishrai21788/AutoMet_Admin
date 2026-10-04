import { useMemo, useState } from 'react'
import { useCategories, useOverview, useReport, useRegions } from '@/api/hooks'
import { fmtMoney, regionLabel } from '@/lib/labels'
import type { ReportData, ReportGroupRow } from '@/lib/types'
import DataTable, { type Column } from '@/components/DataTable'
import ExportButton from '@/components/ExportButton'
import { Alert, Card, ErrorState, PageHeader, Spinner } from '@/components/ui'

const select = 'rounded-lg border border-line bg-bg px-3 py-2 text-sm'
const PRESETS = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['month', 'This month'], ['custom', 'Custom']] as const
type Preset = (typeof PRESETS)[number][0]

/** Today's date (YYYY-MM-DD) in the business's own time zone, and day arithmetic on such strings. */
const todayIn = (tz: string) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()) } catch { return new Date().toISOString().slice(0, 10) } }
const shift = (day: string, days: number) => new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + days)).toISOString().slice(0, 10)
const minutes = (m: number | null) => (m === null ? '—' : m < 1 ? '< 1 min' : `${Math.round(m * 10) / 10} min`)

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <Card className="p-4"><div className="text-xs text-muted">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>{hint && <div className="mt-1 text-xs text-muted">{hint}</div>}</Card>
}

function DayChart({ days }: { days: ReportData['byDay'] }) {
  const max = Math.max(1, ...days.map((d) => d.requested))
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-semibold">Rides per day</h2>
      <ul className="flex h-40 items-end gap-px sm:gap-1" aria-label="Ride requests per day">
        {days.map((d) => (
          <li key={d.date} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.date}: ${d.requested} requested, ${d.completed} completed, ${d.cancelled} cancelled, ${d.unanswered} no driver`}>
            <div className="w-full rounded-t bg-brand/70" style={{ height: `${(d.requested / max) * 100}%`, minHeight: d.requested ? 2 : 0 }}>
              <div className="w-full rounded-t bg-ok" style={{ height: d.requested ? `${(d.completed / d.requested) * 100}%` : 0 }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex justify-between text-[11px] text-muted"><span>{days[0]?.date}</span><span>{days[days.length - 1]?.date}</span></div>
      <p className="mt-2 flex gap-3 text-[11px] text-muted"><span><span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-sm bg-brand/70" />requested</span><span><span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-sm bg-ok" />completed</span></p>
    </Card>
  )
}

export default function Reports() {
  const overview = useOverview()
  const regions = useRegions()
  const categories = useCategories()
  const tz = overview.data?.business.market?.timezone ?? 'UTC'
  const today = useMemo(() => todayIn(tz), [tz])

  const [preset, setPreset] = useState<Preset>('30')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [regionId, setRegionId] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const range = useMemo(() => {
    if (preset === '7') return { from: shift(today, -6), to: today }
    if (preset === '30') return { from: shift(today, -29), to: today }
    if (preset === 'month') return { from: `${today.slice(0, 8)}01`, to: today }
    return { from: customFrom, to: customTo }
  }, [preset, today, customFrom, customTo])
  const ready = !!range.from && !!range.to && range.from <= range.to
  const params = { from: range.from, to: range.to, regionId, categoryId }
  const report = useReport(params, ready)
  const csvQuery = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()

  const group = (title: string, rows: ReportGroupRow[], money: string | null): { title: string; rows: ReportGroupRow[]; columns: Column<ReportGroupRow>[] } => ({
    title, rows,
    columns: [
      { header: title, cell: (r) => <span className="text-sm font-medium">{r.name}</span> },
      { header: 'Requested', cell: (r) => <span className="tabular-nums">{r.requested}</span> },
      { header: 'Completed', cell: (r) => <span className="tabular-nums">{r.completed}</span> },
      { header: 'Cancelled', cell: (r) => <span className="tabular-nums">{r.cancelled}</span> },
      { header: 'No driver', cell: (r) => <span className="tabular-nums">{r.unanswered}</span> },
      { header: 'Fares', cell: (r) => <span className="whitespace-nowrap tabular-nums">{fmtMoney(r.fares, money)}</span> },
    ],
  })

  const d = report.data
  return (
    <>
      <PageHeader title="Reports" subtitle={`Rides and fares of this business, worked out on the server from its trip records. Days are in the business time zone (${tz}).`}
        action={ready ? <ExportButton path={`/api/admin/business/export/trips.csv?${csvQuery}`} fileName="trips.csv" label="Export trips CSV" /> : undefined} />

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div role="tablist" aria-label="Date range" className="flex flex-wrap gap-1">
            {PRESETS.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={preset === k} onClick={() => setPreset(k)}
                className={`rounded-full border px-3 py-1 text-sm ${preset === k ? 'border-brand bg-brand/15 font-medium' : 'border-line text-muted hover:text-ink'}`}>{label}</button>
            ))}
          </div>
          {preset === 'custom' && (
            <>
              <label className="text-xs text-muted">From<input type="date" className={`${select} mt-1 block`} value={customFrom} max={customTo || today} onChange={(e) => setCustomFrom(e.target.value)} /></label>
              <label className="text-xs text-muted">To<input type="date" className={`${select} mt-1 block`} value={customTo} min={customFrom || undefined} max={today} onChange={(e) => setCustomTo(e.target.value)} /></label>
            </>
          )}
          <select aria-label="Region" className={select} value={regionId} onChange={(e) => setRegionId(e.target.value)}><option value="">All regions</option>{regions.data?.map((r) => <option key={r.id} value={r.id}>{regionLabel(r)}</option>)}</select>
          <select aria-label="Vehicle category" className={select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">All categories</option>{categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
        {preset === 'custom' && !ready && <p className="border-t border-line px-4 py-2 text-sm text-muted">Choose a start and an end date (up to 92 days).</p>}
      </Card>

      {!ready ? null : report.isLoading ? <Spinner /> : report.isError ? <ErrorState error={report.error} onRetry={() => report.refetch()} /> : d && (
        <div className={report.isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={report.isFetching}>
          <p className="mb-3 text-sm text-muted">{d.fromDay} to {d.toDay}</p>
          {d.partial && <div className="mb-4"><Alert kind="warn">This range has more than {d.rowLimit.toLocaleString()} trips, so the numbers cover only the most recent ones. Choose a shorter range.</Alert></div>}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Ride requests" value={d.rides.requested} hint={d.rides.stillOpen ? `${d.rides.stillOpen} still open` : undefined} />
            <Kpi label="Completed" value={d.rides.completed} hint={`${d.rides.completionRate}% of finished requests`} />
            <Kpi label="Cancelled" value={d.rides.cancelled} hint={`${d.rides.cancellationRate}% · ${d.rides.cancelledByRiders} by riders, ${d.rides.cancelledByDrivers} by drivers`} />
            <Kpi label="No driver found" value={d.rides.noDriver} hint={`${d.rides.noDriverRate}% (declined or no response)`} />
            <Kpi label="Fares completed" value={fmtMoney(d.finance.grossFares, d.currency)} hint={`${d.finance.completedTrips} trip${d.finance.completedTrips === 1 ? '' : 's'} · ${d.finance.basis}`} />
            <Kpi label="Average fare" value={fmtMoney(d.rides.avgFare, d.currency)} hint={d.rides.avgDistanceKm !== null ? `${d.rides.avgDistanceKm} km on average` : undefined} />
            <Kpi label="Average driver response" value={minutes(d.rides.avgResponseMinutes)} hint="request to acceptance" />
            <Kpi label="Average trip time" value={minutes(d.rides.avgTripMinutes)} hint="start to finish" />
          </div>

          <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
            <DayChart days={d.byDay} />
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Money</h2>
              <dl className="divide-y divide-line text-sm">
                <div className="flex justify-between py-2"><dt className="text-muted">Fares of completed trips</dt><dd className="tabular-nums">{fmtMoney(d.finance.grossFares, d.currency)}</dd></div>
                <div className="flex justify-between py-2"><dt className="text-muted">of which booking fees</dt><dd className="tabular-nums">{fmtMoney(d.finance.bookingFees, d.currency)}</dd></div>
                <div className="flex justify-between py-2"><dt className="text-muted">of which taxes</dt><dd className="tabular-nums">{fmtMoney(d.finance.taxes, d.currency)}</dd></div>
                {d.finance.byPaymentMode.map((p) => <div key={p.mode} className="flex justify-between py-2"><dt className="text-muted">{p.mode === 'UNKNOWN' ? 'Payment method not recorded' : `Paid by ${p.mode.toLowerCase()}`} ({p.trips} trip{p.trips === 1 ? '' : 's'})</dt><dd className="tabular-nums">{fmtMoney(p.fares, d.currency)}</dd></div>)}
              </dl>
              {d.finance.estimatedFares > 0 && <p className="mt-2 text-xs text-muted">{d.finance.estimatedFares} of {d.finance.completedTrips} fares are the estimate shown when the ride was requested; final fares are not recorded yet.</p>}
              <p className="mt-2 text-xs text-muted">Not recorded by the platform yet, so not shown: {d.finance.unavailable.join(', ')}.</p>
            </Card>
          </div>

          {[group('Vehicle category', d.byCategory, d.currency), group('Region', d.byRegion, d.currency)].map((g) => (
            <Card key={g.title} className="mt-5">
              <div className="border-b border-line px-5 py-3"><h2 className="font-semibold">By {g.title.toLowerCase()}</h2></div>
              <DataTable rows={g.rows} columns={g.columns} rowKey={(r) => r.id} pageSize={10} empty={{ title: 'No rides in this range' }} />
            </Card>
          ))}

          <Card className="mt-5">
            <div className="border-b border-line px-5 py-3"><h2 className="font-semibold">Drivers</h2><p className="text-xs text-muted">Acceptance counts only requests a driver could answer: not ones still waiting or cancelled by the rider first.</p></div>
            <DataTable
              rows={d.drivers} rowKey={(r) => r.id} pageSize={10} empty={{ title: 'No driver activity in this range' }}
              columns={[
                { header: 'Driver', cell: (r) => <span className="text-sm font-medium">{r.name}</span> },
                { header: 'Requests', cell: (r) => <span className="tabular-nums">{r.offered}</span> },
                { header: 'Accepted', cell: (r) => <span className="tabular-nums">{r.accepted} <span className="text-xs text-muted">({r.acceptanceRate}%)</span></span> },
                { header: 'Declined', cell: (r) => <span className="tabular-nums">{r.declined}</span> },
                { header: 'No response', cell: (r) => <span className="tabular-nums">{r.noResponse}</span> },
                { header: 'Completed', cell: (r) => <span className="tabular-nums">{r.completed}</span> },
                { header: 'Cancelled after accepting', cell: (r) => <span className="tabular-nums">{r.cancelled}</span> },
                { header: 'Fares', cell: (r) => <span className="whitespace-nowrap tabular-nums">{fmtMoney(r.fares, d.currency)}</span> },
              ]}
            />
          </Card>
        </div>
      )}
    </>
  )
}
