import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import Modal from './Modal'
import { Button } from './ui'
import { ConfirmContext, ToastContext, type ConfirmOptions } from './feedback'

interface Toast { id: number; kind: 'success' | 'error'; text: string }

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, kind, text }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000)
  }, [])
  const toast = useMemo(() => ({ success: (t: string) => push('success', t), error: (t: string) => push('error', t) }), [push])

  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...o, resolve })), [])
  const close = (answer: boolean) => { pending?.resolve(answer); setPending(null) }

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={confirm}>
        {children}
        <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
          {toasts.map((t) => (
            <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex items-start gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm shadow-lg">
              {t.kind === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok" /> : <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" />}
              <span>{t.text}</span>
            </div>
          ))}
        </div>
        {pending && (
          <Modal
            title={pending.title}
            onClose={() => close(false)}
            footer={<>
              <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
              <Button variant={pending.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{pending.confirmLabel ?? 'Confirm'}</Button>
            </>}
          >
            <p className="text-sm">{pending.message}</p>
          </Modal>
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}
