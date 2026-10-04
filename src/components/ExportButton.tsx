import { useState } from 'react'
import { Download } from 'lucide-react'
import { downloadFile } from '@/api'
import { useToast } from '@/components/feedback'
import { Button } from '@/components/ui'

/** Downloads a CSV built by the server, with what is currently filtered on screen. Exports of personal data are recorded in the audit log. */
export default function ExportButton({ path, fileName, label = 'Export CSV' }: { path: string; fileName: string; label?: string }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    try {
      const r = await downloadFile(path, fileName)
      toast.success(r.truncated ? `Downloaded the first ${r.rows ?? ''} rows. Narrow the date range to get the rest.` : `Downloaded${r.rows !== null ? ` ${r.rows} row${r.rows === 1 ? '' : 's'}` : ''}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The download failed')
    } finally { setBusy(false) }
  }
  return <Button variant="ghost" loading={busy} onClick={run}><Download size={15} aria-hidden /> {label}</Button>
}
