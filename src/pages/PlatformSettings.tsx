import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, platform } from '@/api'
import type { PlatformSettings as Settings } from '@/lib/types'
import { refreshPlatform } from '@/lib/billing'
import IntegrationList from '@/components/IntegrationList'
import { useToast } from '@/components/feedback'
import { Button, Card, ErrorState, Field, PageHeader, Spinner, TextField, Textarea } from '@/components/ui'

function SettingsForm({ initial }: { initial: Settings }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState({ companyName: initial.companyName, billingEmail: initial.billingEmail, invoiceDueDays: String(initial.invoiceDueDays), defaultTrialDays: String(initial.defaultTrialDays), invoiceNotes: initial.invoiceNotes })
  const save = useMutation({
    mutationFn: () => platform.saveSettings({ companyName: form.companyName.trim(), billingEmail: form.billingEmail.trim(), invoiceDueDays: Number(form.invoiceDueDays), defaultTrialDays: Number(form.defaultTrialDays), invoiceNotes: form.invoiceNotes.trim() }),
    onSuccess: async () => { await refreshPlatform(qc); toast.success('Platform settings saved') },
    onError: (e) => { if (!(e instanceof ApiError) || !Object.keys(e.fieldErrors).length) toast.error(e.message) },
  })
  const fe = save.error instanceof ApiError ? save.error.fieldErrors : {}
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => { setForm({ ...form, [k]: e.target.value }); save.reset() }
  return (
    <Card className="p-5">
      <form noValidate className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate() }}>
        <TextField label="Company name" hint="Shown as the issuer on invoices." value={form.companyName} onChange={set('companyName')} maxLength={120} error={fe.companyName} />
        <TextField label="Billing email" type="email" value={form.billingEmail} onChange={set('billingEmail')} error={fe.billingEmail} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Payment term (days)" type="number" min="0" max="120" hint="Default days from issue to due date." value={form.invoiceDueDays} onChange={set('invoiceDueDays')} error={fe.invoiceDueDays} />
          <TextField label="Default trial (days)" type="number" min="0" max="365" value={form.defaultTrialDays} onChange={set('defaultTrialDays')} error={fe.defaultTrialDays} />
        </div>
        <Field label="Invoice notes (optional)" error={fe.invoiceNotes}>{(p) => <Textarea {...p} rows={3} maxLength={500} value={form.invoiceNotes} onChange={set('invoiceNotes')} />}</Field>
        <p className="text-xs text-muted">Currency is {initial.currency}, set on the server. Changing these defaults does not alter invoices already issued.</p>
        <div className="flex justify-end"><Button type="submit" loading={save.isPending}>Save settings</Button></div>
      </form>
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
      <PageHeader title="Platform settings" subtitle="Billing defaults, and the status of the services the platform depends on." />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,36rem)_minmax(0,1fr)]">
        <SettingsForm initial={settings.data!} />
        <Card className="p-5">
          <h2 className="mb-1 font-semibold">System status</h2>
          <p className="mb-2 text-xs text-muted">Whether each outside service is set up on the server this dashboard talks to. Keys and values are never shown. A local development server has none of them, so most show as missing there.</p>
          {overview.isLoading ? <Spinner /> : overview.isError ? <ErrorState error={overview.error} onRetry={() => overview.refetch()} /> : <IntegrationList i={overview.data!.integrations} />}
        </Card>
      </div>
    </>
  )
}
