import { createContext, useContext } from 'react'

export interface ToastApi { success: (t: string) => void; error: (t: string) => void }
export const ToastContext = createContext<ToastApi | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast needs <FeedbackProvider>')
  return ctx
}

export interface ConfirmOptions { title: string; message: string; confirmLabel?: string; danger?: boolean }
export const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm needs <FeedbackProvider>')
  return ctx
}
