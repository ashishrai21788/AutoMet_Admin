import { useState } from 'react'
import { Button, Card } from './ui'

/** One-time display of a temporary password. It is not stored anywhere and cannot be shown again. */
export default function SecretNotice({
  title, email, password, onClose,
}: { title: string; email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
    } catch {
      /* clipboard can be blocked; the password is selectable on screen */
    }
  }
  return (
    <Card className="mb-6 border-brand p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">
        Share these sign-in details securely. The password is shown only now and must be changed at first sign-in.
      </p>
      <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-[6rem_1fr]">
        <dt className="text-muted">Email</dt><dd className="font-medium">{email}</dd>
        <dt className="text-muted">Password</dt><dd className="select-all font-mono">{password}</dd>
      </dl>
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={copy}>{copied ? 'Copied' : 'Copy password'}</Button>
        <Button onClick={onClose}>I have saved it</Button>
      </div>
    </Card>
  )
}
