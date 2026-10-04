import type { VerificationStatus } from '@/lib/types'

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  INCOMPLETE: 'Incomplete',
  PENDING_REVIEW: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
}

const TRIP_LABEL: Record<string, string> = {
  REQUESTED: 'Searching', ACCEPTED: 'Driver assigned', DRIVER_ON_THE_WAY: 'Driver on the way', ARRIVED: 'Driver arrived', ON_GOING: 'In progress',
  COMPLETED: 'Completed', REJECTED: 'Declined', REJECTED_WITH_REASON: 'Declined', NO_RESPONSE: 'No response',
  CANCELLED_BY_USER: 'Cancelled by rider', CANCELLED_BY_USER_AFTER_ACCEPTANCE: 'Cancelled by rider', CANCELLED_BY_DRIVER: 'Cancelled by driver',
}
export const tripStatusLabel = (s: string) => TRIP_LABEL[s] ?? s
