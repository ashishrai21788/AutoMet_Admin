import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, platform } from '@/api'
import { fmtDateTime } from '@/lib/labels'
import { GST_STATES, isGstin, stateOfGstin } from '@/lib/gstStates'
import type { LapseAction, PlatformSettings as Settings } from '@/lib/types'
import { refreshPlatform } from '@/lib/billing'
import IntegrationList from '@/components/IntegrationList'
import { useConfirm, useToast } from '@/components/feedback'
import { Alert, Button, Card, ErrorState, Field, PageHeader, SelectField, Spinner, TextField, Textarea } from '@/components/ui'

const LAPSE_HELP: Record<LapseAction, string> = {
  none: 'Only flag the invoice as lapsed and record it in the audit log. Nothing happens to the business.',
  cancel: 'Cancel the business\'s subscription (it stops counting as recurring revenue). The business keeps working.',
  suspend: 'Suspend the business: its admins are signed out and its apps stop until you activate it again. The default business is never suspended.',
}

function SettingsForm({ initial }: { initial: Settings }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState({
    legalName: initial.legalName, companyName: initial.companyName, billingEmail: initial.billingEmail, gstin: initial.gstin, address: initial.address,
    sac: initial.sac, gstRate: String(initial.gstRate), invoiceDueDays: String(initial.invoiceDueDays), defaultTrialDays: String(initial.defaultTrialDays), invoiceNotes: initial.invoiceNotes,
    reminderOffsets: initial.reminderOffsets.join(', '), graceDays: String(initial.graceDays), lapseAction: initial.lapseAction as LapseAction,
  })
  const save = useMutation({
    mutationFn: () => platform.saveSettings({
      legalName: form.legalName.trim(), companyName: form.companyName.trim(), billingEmail: form.billingEmail.trim(), gstin: form.gstin.trim().toUpperCase(), address: form.address.trim(),
      sac: form.sac.trim(), gstRate: Number(form.gstRate), invoiceDueDays: Number(form.invoiceDueDays), defaultTrialDays: Number(form.defaultTrialDays), invoiceNotes: form.invoiceNotes.trim(),
      reminderOffsets: form.reminderOffsets, graceDays: Number(form.graceDays), lapseAction: form.lapseAction,
    }),
    onSuccess: async () => { await refreshPlatform(qc); toast.success('Platform settings saved') },
    onError: (e) => { if (!(e instanceof ApiError) || !Object.keys(e.fieldErrors).length) toast.error(e.message) },
  })
  const fe = save.error instanceof ApiError ? save.error.fieldErrors : {}
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => { setForm({ ...form, [k]: e.target.value }); save.reset() }
  const gstinOk = isGstin(form.gstin)
  const state = gstinOk ? GST_STATES[stateOfGstin(form.gstin)] : ''

  return (
    <Card className="p-5">
      <form noValidate className="space-y-6" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate() }}>
        <section className="space-y-4">
          <h2 className="font-semibold">Company and GST</h2>
          <p className="text-xs text-muted">Printed as the seller on every invoice. With no GSTIN, no tax is charged and invoices say "Invoice". With one, GST is added and they say "Tax Invoice". Check the rate and SAC code with your accountant.</p>
          <TextField label="Legal company name" value={form.legalName} onChange={set('legalName')} maxLength={120} error={fe.legalName} />
          <TextField label="GSTIN (if registered)" value={form.gstin} maxLength={15} autoCapitalize="characters" onChange={(e) => { setForm({ ...form, gstin: e.target.value.toUpperCase() }); save.reset() }} error={fe.gstin ?? (form.gstin && !gstinOk ? 'A GSTIN has 15 characters, for example 27AAPFU0939F1ZV' : undefined)} hint={state ? `Registered in ${state}. Customers in this state pay CGST + SGST; others pay IGST.` : undefined} />
          <Field label="Address" error={fe.address}>{(p) => <Textarea {...p} rows={3} maxLength={300} value={form.address} onChange={set('address')} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="GST rate (%)" type="number" min="0" max="40" step="0.01" value={form.gstRate} onChange={set('gstRate')} error={fe.gstRate} />
            <TextField label="SAC code" value={form.sac} onChange={set('sac')} maxLength={10} error={fe.sac} hint="998314 is common for software services." />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-semibold">Invoices</h2>
          <TextField label="Display name (optional)" hint="Used in email subjects." value={form.companyName} onChange={set('companyName')} maxLength={100} error={fe.companyName} />
          <TextField label="Your billing email" type="email" value={form.billingEmail} onChange={set('billingEmail')} error={fe.billingEmail} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Payment term (days)" type="number" min="0" max="90" hint="Default days from issue to due date." value={form.invoiceDueDays} onChange={set('invoiceDueDays')} error={fe.invoiceDueDays} />
            <TextField label="Default trial (days)" type="number" min="0" max="365" value={form.defaultTrialDays} onChange={set('defaultTrialDays')} error={fe.defaultTrialDays} />
          </div>
          <Field label="Payment details and notes (printed on every invoice)" error={fe.invoiceNotes} hint="For example your bank account, IFSC and UPI ID.">{(p) => <Textarea {...p} rows={3} maxLength={500} value={form.invoiceNotes} onChange={set('invoiceNotes')} />}</Field>
        </section>

        <section className="space-y-4">
          <h2 className="font-semibold">Overdue invoices</h2>
          {!initial.emailConfigured && <Alert kind="warn">Email isn't set up on the server yet, so reminders can't be sent. They start automatically once it is.</Alert>}
          <TextField label="Reminder days" value={form.reminderOffsets} onChange={set('reminderOffsets')} error={fe.reminderOffsets} hint="Days relative to the due date, separated by commas: -3 is three days before, 7 is a week after. Each is sent once per invoice." />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Grace period (days)" type="number" min="0" max="120" value={form.graceDays} onChange={set('graceDays')} error={fe.graceDays} hint="An invoice this long past due lapses." />
            <SelectField label="When an invoice lapses" value={form.lapseAction} onChange={(e) => { setForm({ ...form, lapseAction: e.target.value as LapseAction }); save.reset() }} error={fe.lapseAction}>
              <option value="none">Only flag it</option><option value="cancel">Cancel the subscription</option><option value="suspend">Suspend the business</option>
            </SelectField>
          </div>
          <p className="text-xs text-muted">{LAPSE_HELP[form.lapseAction]}</p>
        </section>

        <div className="flex justify-end"><Button type="submit" loading={save.isPending}>Save settings</Button></div>
      </form>
    </Card>
  )
}

/** Runs the reminders and the lapse rule now, instead of waiting for the next automatic run (every few hours). */
function RunNow({ settings }: { settings: Settings }) {
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const run = useMutation({
    mutationFn: () => platform.runBilling(),
    onSuccess: async (r) => {
      await refreshPlatform(qc)
      const parts = [`${r.reminded} reminder${r.reminded === 1 ? '' : 's'} sent`, `${r.lapsed} lapsed`]
      if (r.skipped) parts.push(`${r.skipped} not sent (${r.emailConfigured ? 'no email address' : 'email not set up'})`)
      toast.success(parts.join(', '))
    },
    onError: (e) => toast.error(e.message),
  })
  async function go() {
    const lapse = settings.lapseAction
    const ok = lapse === 'none' || await confirm({ title: 'Run the overdue check now?', message: lapse === 'suspend' ? 'Any business with an invoice past its grace period will be suspended right away.' : 'Any business with an invoice past its grace period will have its subscription cancelled.', confirmLabel: 'Run now', danger: lapse === 'suspend' })
    if (ok) run.mutate()
  }
  return (
    <Card className="p-5">
      <h2 className="mb-1 font-semibold">Overdue check</h2>
      <p className="text-xs text-muted">It runs by itself every few hours. Last run: {settings.lastRunAt ? fmtDateTime(settings.lastRunAt) : 'not yet'}. It uses the saved settings, so save changes first.</p>
      {run.data && run.data.actions.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs">{run.data.actions.map((a) => <li key={a.invoice}>{a.invoice}: {a.result.replace(/-/g, ' ')}</li>)}</ul>}
      <div className="mt-3"><Button variant="ghost" loading={run.isPending} onClick={go}>Run now</Button></div>
    </Card>
  )
}

export default function PlatformSettings() {
  const settings = useQuery({ queryKey: ['platform-settings'], queryFn: platform.settings })
  const overview = useQuery({ queryKey: ['platform-overview'], queryFn: platform.overview })
  if (settings.isLoading) return <Spinner />
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
  return (
    <>
      <PageHeader title="Platform settings" subtitle="Your company and GST details, how invoices are chased, and the status of the services the platform depends on." />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,36rem)_minmax(0,1fr)]">
        <SettingsForm key={settings.dataUpdatedAt} initial={settings.data!} />
        <div className="space-y-5">
          <RunNow settings={settings.data!} />
          <Card className="p-5">
            <h2 className="mb-1 font-semibold">System status</h2>
            <p className="mb-2 text-xs text-muted">Whether each outside service is set up on the server this dashboard talks to. Keys and values are never shown. A local development server has none of them, so most show as missing there.</p>
            {overview.isLoading ? <Spinner /> : overview.isError ? <ErrorState error={overview.error} onRetry={() => overview.refetch()} /> : <IntegrationList i={overview.data!.integrations} />}
          </Card>
        </div>
      </div>
    </>
  )
}
