import { Card, EmptyState, PageHeader } from '@/components/ui'

export default function RideSettings() {
  return (
    <>
      <PageHeader title="Ride Settings" subtitle="Operational rules for how rides are requested and matched." />
      <Card>
        <EmptyState
          title="Not available yet"
          text="Ride matching rules, such as how far to search for a driver and how long a driver has to accept, will be configured here once automatic dispatch is built. Nothing on this page is saved today. Cancellation fees are already configured under Pricing & Fare Rules."
        />
      </Card>
    </>
  )
}
