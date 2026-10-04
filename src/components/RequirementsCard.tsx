import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, fleet } from '@/api'
import { useRequirements } from '@/api/hooks'
import { useScope } from '@/lib/useScope'
import type { RequirementDef } from '@/lib/types'
import { useToast } from './feedback'
import { Alert, Badge, Button, Card, ErrorState, Spinner, Toggle } from './ui'

type Draft = Record<string, boolean>

function Group({ title, items, draft, setDraft, canEdit }: { title: string; items: RequirementDef[]; draft: Draft; setDraft: (d: Draft) => void; canEdit: boolean }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {items.map((r) => (
          <li key={r.type} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
            <span>{r.label}{r.locked && <Badge kind="neutral"> always required</Badge>}{r.photo && <Badge kind="neutral"> not part of verification</Badge>}</span>
            {r.photo ? null : (
              <Toggle label="Required" checked={r.locked ? true : draft[r.type] ?? r.mandatory} disabled={!canEdit || !!r.locked}
                onChange={(v) => setDraft({ ...draft, [r.type]: v })} />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Which documents a driver and a vehicle must have approved. The licence and the registration certificate cannot be turned off. */
export default function RequirementsCard({ canEdit }: { canEdit: boolean }) {
  const { tenantId } = useScope()
  const qc = useQueryClient()
  const toast = useToast()
  const query = useRequirements()
  const [driver, setDriver] = useState<Draft>({})
  const [vehicle, setVehicle] = useState<Draft>({})
  const [busy, setBusy] = useState(false)

  // the drafts start from what the server has, and again whenever it sends something new
  const [seededFrom, setSeededFrom] = useState<unknown>(null)
  if (query.data && seededFrom !== query.data) {
    setSeededFrom(query.data)
    setDriver(Object.fromEntries(query.data.driver.map((r) => [r.type, r.mandatory])))
    setVehicle(Object.fromEntries(query.data.vehicle.map((r) => [r.type, r.mandatory])))
  }

  async function save() {
    if (busy || !query.data) return
    setBusy(true)
    try {
      const only = (list: RequirementDef[], draft: Draft) => Object.fromEntries(list.filter((r) => !r.locked && !r.photo && draft[r.type] !== r.mandatory).map((r) => [r.type, draft[r.type]]))
      await fleet.requirements.update({ driver: only(query.data.driver, driver), vehicle: only(query.data.vehicle, vehicle) })
      await qc.invalidateQueries({ queryKey: ['biz', tenantId] })
      toast.success('Document requirements saved')
    } catch (err) {
      toast.error(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save')
    } finally { setBusy(false) }
  }

  if (query.isLoading) return <Card><Spinner /></Card>
  if (query.isError) return <Card><ErrorState error={query.error} onRetry={() => query.refetch()} /></Card>
  const data = query.data!
  const dirty = [...data.driver, ...data.vehicle].some((r) => !r.locked && !r.photo && (data.driver.includes(r) ? driver : vehicle)[r.type] !== r.mandatory)

  return (
    <Card className="mt-6 p-5">
      <h2 className="font-semibold">Verification requirements</h2>
      <p className="mb-4 text-sm text-muted">The documents that must be approved before a driver or vehicle counts as verified. Choose what your market requires.</p>
      <div className="space-y-5">
        <Group title="Driver documents" items={data.driver} draft={driver} setDraft={setDriver} canEdit={canEdit} />
        <Group title="Vehicle documents" items={data.vehicle} draft={vehicle} setDraft={setVehicle} canEdit={canEdit} />
      </div>
      <div className="mt-4"><Alert kind="info">A change applies to a driver or vehicle the next time its documents change, and is always used when you open its page. The lists refresh as records are updated.</Alert></div>
      {canEdit && <div className="mt-4"><Button onClick={save} loading={busy} disabled={!dirty}>Save requirements</Button></div>}
    </Card>
  )
}
