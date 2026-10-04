import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/api'
import type { Business } from '@/lib/types'
import Modal from '@/components/Modal'
import { useToast } from '@/components/feedback'
import { Button, TextField } from '@/components/ui'

/** The platform owner edits a business's details. The App ID and package name never change. */
export default function EditBusinessModal({ business, onClose }: { business: Business; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState({ name: business.name, appName: business.appName, city: business.city ?? '' })
  const edit = useMutation({
    mutationFn: () => api.businesses.update(business.appId, { name: form.name.trim(), appName: form.appName.trim(), city: form.city.trim() }),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ['businesses'] })
      qc.invalidateQueries({ queryKey: ['platform-overview'] })
      qc.invalidateQueries({ queryKey: ['platform-revenue'] })
      toast.success(`${b.name} was updated`)
      onClose()
    },
    onError: (e) => { if (!(e instanceof ApiError) || Object.keys(e.fieldErrors).length === 0) toast.error(e.message) },
  })
  const fe = edit.error instanceof ApiError ? edit.error.fieldErrors : {}
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => { setForm({ ...form, [k]: e.target.value }); edit.reset() }

  return (
    <Modal title={`Edit ${business.name}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="edit-business" loading={edit.isPending}>Save</Button></>}>
      <form id="edit-business" noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); edit.mutate() }}>
        <p className="text-xs text-muted">App ID <span className="font-mono">{business.appId}</span> and package name <span className="font-mono">{business.packageName}</span> are fixed once a business is created.</p>
        <TextField label="Business name" value={form.name} onChange={set('name')} error={fe.name} />
        <TextField label="App name" value={form.appName} onChange={set('appName')} error={fe.appName} />
        <TextField label="City" value={form.city} onChange={set('city')} error={fe.city} />
        {edit.isError && !Object.keys(fe).length && <p role="alert" className="text-sm text-danger">{edit.error.message}</p>}
      </form>
    </Modal>
  )
}
