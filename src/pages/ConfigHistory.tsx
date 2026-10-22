import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, ops } from '@/api'
import { useConfigHistory, useConfigVersion } from '@/api/hooks'
import { useAuth } from '@/store/auth'
import { can } from '@/lib/permissions'
import { fmtDateTime } from '@/lib/labels'
import type { ConfigChange } from '@/lib/types'
import { useConfirm, useToast } from '@/components/feedback'
import Modal from '@/components/Modal'
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Spinner } from '@/components/ui'

const FIELD_LABEL: Record<string, string> = {
  name: 'Business name', appName: 'App name', brandColor: 'Brand colour', logoUrl: 'Logo', supportEmail: 'Support email', supportPhone: 'Support phone',
  payoutSettings: 'Driver payout settings', tollSettings: 'Toll settings', appVersions: 'Minimum app versions', rideSettings: 'Ride settings',
}

const yesNo = (b: unknown) => (b ? 'on' : 'off')
const num = (n: unknown) => (Number.isFinite(Number(n)) ? String(Number(n)) : '0')
/** Money is stored in the smallest unit (paise, cents); shown here in the currency's main unit with the usual two decimals trimmed. */
const major = (minor: unknown) => { const v = Number(minor) / 100; return Number.isFinite(v) ? String(v % 1 === 0 ? v : v.toFixed(2)) : '0' }

/** One setting group written for a person, in the words of its own page. */
function show(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return 'not set'
  const o = (typeof v === 'object' ? v : {}) as Record<string, Record<string, unknown> & unknown>
  const x = o as Record<string, unknown>
  if (field === 'tollSettings') return `${x.enabled ? 'Drivers can enter a toll' : 'Tolls off'}\nMost per trip: ${major(x.maxTollMinor)}`
  if (field === 'payoutSettings') return `Commission: ${num(x.commissionPercent)}%\nSmallest withdrawal: ${major(x.minWithdrawalMinor)}\nCash earnings withdrawable: ${yesNo(x.cashWithdrawable)}${x.processingNote ? `\nNote: ${String(x.processingNote)}` : ''}`
  if (field === 'rideSettings') return `Only eligible drivers can go online: ${yesNo(x.requireEligibleDrivers)}`
  if (field === 'appVersions') {
    const part = (k: string) => { const p = (o[k] ?? {}) as Record<string, unknown>; const m = Number(p.minVersionCode) || 0; return `${k === 'rider' ? 'Rider' : 'Driver'} app: ${m > 0 ? `build ${m} or newer` : 'no minimum'}` }
    return `${part('rider')}\n${part('driver')}`
  }
  if (typeof v === 'object') return Object.entries(x).map(([k, y]) => `${k}: ${String(y)}`).join('\n')
  return String(v)
}

function Changes({ rows, empty }: { rows: ConfigChange[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted">{empty}</p>
  return (
    <ul className="divide-y divide-line rounded-lg border border-line text-sm">
      {rows.map((r) => (
        <li key={r.field} className="grid gap-2 px-3 py-2 sm:grid-cols-[10rem_1fr_1fr]">
          <div><div className="font-medium">{FIELD_LABEL[r.field] ?? r.field}</div><div className="text-xs text-muted">{r.label}</div></div>
          <div><div className="text-xs text-muted">Before</div><pre className="whitespace-pre-wrap break-words font-sans">{show(r.field, r.from)}</pre></div>
          <div><div className="text-xs text-muted">After</div><pre className="whitespace-pre-wrap break-words font-sans">{show(r.field, r.to)}</pre></div>
        </li>
      ))}
    </ul>
  )
}

function Detail({ version, current, canRollback, onClose }: { version: number; current: number | null; canRollback: boolean; onClose: () => void }) {
  const q = useConfigVersion(version)
  const confirm = useConfirm()
  const toast = useToast()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)

  async function rollback() {
    if (busy) return
    const ok = await confirm({
      title: `Go back to version ${version}?`,
      message: 'The settings below are put back right away, in the rider and driver apps too. This is recorded as a new version, so you can go back again.',
      confirmLabel: 'Go back to this version', danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      const r = await ops.configHistory.rollback(version)
      await qc.invalidateQueries({ queryKey: ['biz'] })
      toast.success(`Settings restored from version ${version} (now version ${r.version})`)
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError || err instanceof Error ? err.message : 'Could not go back')
    } finally { setBusy(false) }
  }

  return (
    <Modal title={`Version ${version}`} onClose={onClose}>
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-sm font-semibold">What this version changed</h3>
            <Changes rows={q.data!.changes} empty={version === 1 ? 'This is the starting point: the settings as they were before changes were recorded.' : 'Nothing differs from the version before.'} />
          </section>
          {version !== current && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">If you go back to it, these change now</h3>
              <Changes rows={q.data!.comparedToNow} empty="The settings already match this version." />
            </section>
          )}
          {canRollback && version !== current && q.data!.comparedToNow.length > 0 && (
            <div className="flex justify-end"><Button variant="danger" loading={busy} onClick={rollback}>Go back to this version</Button></div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function ConfigHistory() {
  const user = useAuth((s) => s.session?.user)
  const canRollback = can(user, 'settings.manage')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<number | null>(null)
  const q = useConfigHistory(page)

  return (
    <>
      <PageHeader title="Settings history" subtitle="Every change to your business details, payouts, tolls, app versions and ride settings, with who made it. Go back to an earlier version if a change was a mistake." />
      <Card className="overflow-hidden">
        {q.isLoading ? <div className="p-6"><Spinner /></div> : q.isError ? <div className="p-5"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div> : q.data!.items.length === 0 ? (
          <EmptyState title="No changes recorded yet" text="The first time you save one of these settings, it appears here together with how it was before." />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {q.data!.items.map((v) => (
                <li key={v.version}>
                  <button type="button" onClick={() => setOpen(v.version)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-brand dark:hover:bg-white/5">
                    <span className="w-16 shrink-0 font-semibold tabular-nums">v{v.version}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{v.source === 'baseline' ? 'Starting point (before changes were recorded)' : v.changed.join(', ') || 'Settings'}{v.rollbackOf ? ` · went back to version ${v.rollbackOf}` : ''}</span>
                      <span className="block text-xs text-muted">{fmtDateTime(v.at)}{v.by ? ` · ${v.by}` : ''}</span>
                    </span>
                    {v.version === q.data!.current && <Badge kind="ok">Current</Badge>}
                  </button>
                </li>
              ))}
            </ul>
            {q.data!.total > q.data!.pageSize && (
              <div className="flex items-center justify-between border-t border-line px-4 py-2 text-sm">
                <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</Button>
                <span className="text-muted">Page {page} of {Math.ceil(q.data!.total / q.data!.pageSize)}</span>
                <Button variant="ghost" disabled={page * q.data!.pageSize >= q.data!.total} onClick={() => setPage(page + 1)}>Older</Button>
              </div>
            )}
          </>
        )}
      </Card>
      {open !== null && <Detail version={open} current={q.data?.current ?? null} canRollback={canRollback} onClose={() => setOpen(null)} />}
    </>
  )
}
