import { Link } from 'react-router-dom'
import { Button, Card } from '@/components/ui'

/** A signed-in person followed a link or typed an address that does not exist (instead of silently landing on the dashboard). */
export default function NotFound() {
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">There is no page at this address. Use the menu, or go back to the dashboard.</p>
      <Link to="/" className="mt-5 inline-block"><Button>Go to the dashboard</Button></Link>
    </Card>
  )
}
