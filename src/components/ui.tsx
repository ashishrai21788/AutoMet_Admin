import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('rounded-xl border border-line bg-surface', className)}>{children}</div>
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Button({
  variant = 'primary', loading, className, children, disabled, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger'; loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-brand text-brand-fg hover:brightness-95',
        variant === 'ghost' && 'border border-line hover:bg-black/5 dark:hover:bg-white/5',
        variant === 'danger' && 'border border-danger/40 text-danger hover:bg-danger/10',
        className,
      )}
    >
      {loading && <Loader2 size={15} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

const fieldClass =
  'w-full rounded-lg border bg-bg px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-60'

/** A labelled control with an optional hint and an error message that is announced to screen readers. */
export function Field({
  label, error, hint, children, className,
}: { label: string; error?: string; hint?: string; children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; className: string }) => ReactNode; className?: string }) {
  const id = useId()
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">{label}</label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy, className: clsx(fieldClass, error ? 'border-danger' : 'border-line') })}
      {error ? <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-danger">{error}</p>
        : hint ? <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={className} />
export const Select = ({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} className={className} />
export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} className={className} />

/** Convenience for the common text/number input case. */
export function TextField({
  label, error, hint, className, ...input
}: { label: string; error?: string; hint?: string; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <Field label={label} error={error} hint={hint} className={className}>{(p) => <input {...input} {...p} />}</Field>
}

export function SelectField({
  label, error, hint, className, children, ...select
}: { label: string; error?: string; hint?: string; className?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return <Field label={label} error={error} hint={hint} className={className}>{(p) => <select {...select} {...p}>{children}</select>}</Field>
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={clsx('inline-flex items-center gap-2 text-sm', disabled && 'opacity-60')}>
      <input type="checkbox" role="switch" className="h-4 w-4 accent-[var(--brand)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

const tone = {
  ok: 'bg-ok/15 text-ok',
  warn: 'bg-brand/20 text-amber-700 dark:text-brand',
  bad: 'bg-danger/15 text-danger',
  neutral: 'bg-black/5 text-muted dark:bg-white/10',
}
export function Badge({ kind = 'neutral', children }: { kind?: keyof typeof tone; children: ReactNode }) {
  return <span className={clsx('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', tone[kind])}>{children}</span>
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 p-8 text-sm text-muted">
      <Loader2 size={18} className="animate-spin" aria-hidden /> {label}…
    </div>
  )
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-8 text-center">
      <p className="font-medium text-danger">Could not load this</p>
      <p className="text-sm text-muted">{error instanceof Error ? error.message : 'Something went wrong'}</p>
      {onRetry && <Button variant="ghost" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function Alert({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'error'; children: ReactNode }) {
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={clsx('rounded-lg border px-4 py-3 text-sm',
      kind === 'info' && 'border-line bg-black/[.03] dark:bg-white/5',
      kind === 'warn' && 'border-brand/50 bg-brand/10',
      kind === 'error' && 'border-danger/40 bg-danger/10 text-danger')}>
      {children}
    </div>
  )
}
