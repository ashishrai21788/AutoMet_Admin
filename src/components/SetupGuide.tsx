import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react'
import { useOverview } from '@/api/hooks'
import { Card } from './ui'

/**
 * Onboarding banner for the setup pages. It reads the real status from the server, shows where the admin is in the
 * sequence, and links to the next incomplete step. It never blocks the page.
 */
export default function SetupGuide() {
  const { data } = useOverview()
  if (!data || data.setup.complete) return null
  const { steps, nextStep } = data.setup
  const index = nextStep ? steps.findIndex((s) => s.key === nextStep.key) + 1 : steps.length

  return (
    <Card className="mb-6 border-brand/60 bg-brand/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Setup · step {index} of {steps.length}</p>
          <p className="text-sm font-medium">{nextStep ? `Next: ${nextStep.title}` : 'All steps done'}</p>
        </div>
        {nextStep && (
          <Link to={nextStep.path} className="inline-flex items-center gap-1 text-sm font-medium underline">
            Go to this step <ArrowRight size={14} aria-hidden />
          </Link>
        )}
      </div>
      <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            {s.done ? <CheckCircle2 size={14} className="text-ok" aria-label="done" /> : <Circle size={14} className="text-muted" aria-label="not done" />}
            <Link to={s.path} className={s.done ? 'text-muted' : 'font-medium'}>{s.title}</Link>
          </li>
        ))}
      </ol>
    </Card>
  )
}
