import { AlertOctagon, AlertTriangle, Info } from 'lucide-react'
import type { AlertSeverity } from '@/lib/types'

export const SEVERITY: Record<AlertSeverity, { label: string; icon: typeof Info; badge: 'bad' | 'warn' | 'neutral'; ring: string }> = {
  critical: { label: 'Critical', icon: AlertOctagon, badge: 'bad', ring: 'border-danger/50' },
  warning: { label: 'Warning', icon: AlertTriangle, badge: 'warn', ring: 'border-brand/60' },
  info: { label: 'For your information', icon: Info, badge: 'neutral', ring: 'border-line' },
}
