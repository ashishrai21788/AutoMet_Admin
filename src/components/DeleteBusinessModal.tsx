import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/api'
import type { Business } from '@/lib/types'
import Modal from '@/components/Modal'
import { refreshPlatform } from '@/lib/billing'
import { useToast } from '@/components/feedback'
import { Alert, Button, TextField } from '@/components/ui'

/** Permanent removal of an unused, suspended business. The server refuses one that holds drivers, riders, trips, vehicles or invoices. */
export default function DeleteBusinessModal({ business, onClose }: { business: Business; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  const remove = useMutation({
    mutationFn: () => api.businesses.remove(business.appId),
    onSuccess: async () => { await refreshPlatform(qc); toast.success(`${business.name} was deleted`); navigate('/businesses', { replace: true }) },
    // already gone (for example a second request after the first succeeded): nothing left to delete, so leave the page
    onError: async (e) => { if (e instanceof ApiError && e.status === 404) { await refreshPlatform(qc); navigate('/businesses', { replace: true }) } },
  })
  const suspended = business.status === 'suspended'
  const match = suspended && typed.trim() === business.appId

  return (
    <Modal title={`Delete ${business.name}?`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose} disabled={remove.isPending}>Cancel</Button><Button type="submit" form="delete-business" variant="danger" disabled={!match} loading={remove.isPending}>Delete permanently</Button></>}>
      <form id="delete-business" noValidate className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); if (match && !remove.isPending) remove.mutate() }}>
        {!suspended && <Alert kind="warn">{business.name} is {business.status}. Suspend it first (its admins are signed out and its apps stop), then delete it.</Alert>}
        <Alert kind="error">This permanently deletes {business.name} and everything it owns: its drivers, riders, trips, vehicles, documents, support reports, invoices, regions, fare rules and admin accounts. It cannot be undone, and the business's riders and drivers will no longer be able to use its apps.</Alert>
        <TextField label={`Type ${business.appId} to confirm`} value={typed} disabled={!suspended} onChange={(e) => { setTyped(e.target.value); remove.reset() }} autoComplete="off" />
        {remove.isError && <Alert kind="error">{remove.error.message}</Alert>}
      </form>
    </Modal>
  )
}
