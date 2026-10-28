import { useState, type FormEvent } from 'react'
import { ops } from '@/api'
import { useBusinessMutation, usePaymentSettings, useWeatherPricing } from '@/api/hooks'
import { validatePaymentSettings, validateWeather, type PaymentSettings, type WeatherPricing } from '@/lib/payments'
import { Alert, Button, Card, ErrorState, SelectField, Spinner, TextField, Toggle } from '@/components/ui'

/**
 * How this business takes payment. Cash is always on. UPI can be switched on only when a provider that can really be used is listed
 * by the server (the real providers are not built yet), and only with a provider chosen. Commission recovery decides whether commission
 * owed from cash fares is taken from a driver's later online earnings automatically.
 */
export function PaymentSettingsCard({ canEdit }: { canEdit: boolean }) {
  const q = usePaymentSettings()
  if (q.isLoading) return <Card className="mt-6 p-5"><Spinner /></Card>
  if (q.isError) return <Card className="mt-6 p-5"><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>
  return <PaymentSettingsForm saved={q.data!} canEdit={canEdit} />
}

export function PaymentSettingsForm({ saved, canEdit }: { saved: PaymentSettings; canEdit: boolean }) {
  const [form, setForm] = useState({ upi: saved.enabledMethods.includes('UPI'), provider: saved.provider ?? '', commissionRecovery: saved.commissionRecovery, window: String(saved.paymentWindowMinutes) })
  const [touched, setTouched] = useState(false)
  const save = useBusinessMutation((v: NonNullable<ReturnType<typeof validatePaymentSettings>['value']>) => ops.payments.updateSettings(v), { success: 'Payment settings saved' })
  const noProvider = saved.availableProviders.length === 0
  const check = validatePaymentSettings(form, saved.availableProviders)
  const errors = { ...(touched ? check.errors : {}), ...save.fieldErrors }
  const change = (next: Partial<typeof form>) => { setForm({ ...form, ...next }); save.reset() }

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (check.value) save.mutate(check.value)
  }

  return (
    <Card className="mt-6 p-5">
      <h2 className="font-semibold">Payment methods</h2>
      <p className="mb-4 mt-1 text-sm text-muted">Cash is always available: the driver collects it and confirms the amount in the app, and the business is owed its commission. Online (UPI) payments are verified by the payment provider, never by a phone.</p>
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <fieldset disabled={!canEdit || save.isPending} className="contents">
          <div className="sm:col-span-2 space-y-2">
            <Toggle label="Cash" checked disabled onChange={() => {}} />
            <div>
              <Toggle label="Online payment (UPI)" checked={form.upi} disabled={noProvider && !form.upi} onChange={(on) => change({ upi: on })} />
              {noProvider && <p className="mt-1 text-xs text-muted">Not available yet: online payment needs a payment provider account and an integration tested with it. Until then every ride is paid in cash.</p>}
            </div>
          </div>
          {form.upi && (
            <SelectField label="Payment provider" value={form.provider} error={errors.provider ?? errors.enabledMethods} onChange={(e) => change({ provider: e.target.value })}>
              <option value="">Choose a provider</option>
              {saved.availableProviders.map((p) => <option key={p} value={p}>{p === 'MOCK' ? 'Mock (testing only)' : p}</option>)}
            </SelectField>
          )}
          <SelectField label="Commission from cash fares" value={form.commissionRecovery} error={errors.commissionRecovery} onChange={(e) => change({ commissionRecovery: e.target.value as PaymentSettings['commissionRecovery'] })}
            hint="Take it from the driver's later online earnings automatically, or only when you choose to. Check your driver agreement allows automatic recovery.">
            <option value="DEDUCT_FROM_PAYABLE">Recover automatically from online earnings</option>
            <option value="MANUAL_ONLY">Only when I recover it</option>
          </SelectField>
          <TextField label="Minutes a rider has to pay online" inputMode="numeric" value={form.window} error={errors.paymentWindowMinutes} onChange={(e) => change({ window: e.target.value })} hint="5 to 60." />
        </fieldset>
        <div className="sm:col-span-2">
          {canEdit ? <Button type="submit" loading={save.isPending}>Save payment settings</Button> : <p className="text-sm text-muted">Your role can view these settings but not change them.</p>}
        </div>
      </form>
    </Card>
  )
}

/**
 * Weather-based pricing. Off until switched on. It only has effect on fare rules that have surge switched on, shares the rule's maximum
 * with demand surge, shows as its own line in the estimate, and if the weather cannot be read the fare is simply not changed.
 */
export function WeatherPricingCard({ canEdit }: { canEdit: boolean }) {
  const q = useWeatherPricing()
  if (q.isLoading) return <Card className="mb-6 p-5"><Spinner /></Card>
  if (q.isError) return <Card className="mb-6 p-5"><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>
  return <WeatherPricingForm saved={q.data!} canEdit={canEdit} />
}

const asText = (n: number | undefined) => (n && n > 1 ? String(n) : '')

export function WeatherPricingForm({ saved, canEdit }: { saved: WeatherPricing; canEdit: boolean }) {
  const [form, setForm] = useState({ enabled: saved.enabled, multipliers: Object.fromEntries(saved.conditions.map((c) => [c.key, asText(saved.multipliers[c.key])])), maxMultiplier: String(saved.maxMultiplier) })
  const [touched, setTouched] = useState(false)
  const save = useBusinessMutation((v: NonNullable<ReturnType<typeof validateWeather>['value']>) => ops.payments.updateWeather(v), { success: 'Weather pricing saved' })
  const check = validateWeather(form)
  const errors = { ...(touched ? check.errors : {}), ...save.fieldErrors }
  const set = (patch: Partial<typeof form>) => { setForm({ ...form, ...patch }); save.reset() }

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (check.value) save.mutate(check.value)
  }

  return (
    <Card className="mb-6 p-5">
      <h2 className="font-semibold">Weather pricing</h2>
      <p className="mb-3 mt-1 text-sm text-muted">Raise the fare a little while the weather at the pickup is bad. Leave a condition blank (or 1) to charge nothing extra for it.</p>
      <form onSubmit={submit} noValidate className="space-y-4">
        <fieldset disabled={!canEdit || save.isPending} className="space-y-4">
          <Toggle label="Charge for bad weather" checked={form.enabled} onChange={(enabled) => set({ enabled })} />
          <div className="grid gap-3 sm:grid-cols-3">
            {saved.conditions.map((c) => (
              <TextField key={c.key} label={`${c.label} (×)`} inputMode="decimal" placeholder="1" value={form.multipliers[c.key] ?? ''} hint={c.hint} error={errors[`multipliers.${c.key}`]} onChange={(e) => set({ multipliers: { ...form.multipliers, [c.key]: e.target.value } })} />
            ))}
            <TextField label="Most weather can add (×)" inputMode="decimal" value={form.maxMultiplier} error={errors.maxMultiplier} hint="No condition is ever charged above this." onChange={(e) => set({ maxMultiplier: e.target.value })} />
          </div>
        </fieldset>
        <Alert kind="info"><ul className="list-disc space-y-1 pl-5">{saved.notes.map((n) => <li key={n}>{n}</li>)}</ul></Alert>
        {canEdit ? <Button type="submit" loading={save.isPending}>Save weather pricing</Button> : <p className="text-sm text-muted">Your role can view this setting but not change it.</p>}
      </form>
    </Card>
  )
}
