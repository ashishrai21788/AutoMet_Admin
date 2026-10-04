import { Outlet, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { useAuth } from '@/store/auth'
import { useScope } from '@/lib/useScope'
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Spinner } from './ui'

/** Business pages need a business. The super admin picks one here; a business user always has theirs. */
export default function BusinessGate() {
  const { tenantId } = useScope()
  const setActive = useAuth((s) => s.setActiveTenant)
  const list = useQuery({ queryKey: ['businesses'], queryFn: api.businesses.list, enabled: !tenantId })

  if (tenantId) return <Outlet />

  return (
    <>
      <PageHeader title="Choose a business" subtitle="These pages show one business at a time. Pick the business you want to manage." />
      <Card>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> :
          list.data && list.data.length > 0 ? (
            <ul className="divide-y divide-line">
              {list.data.map((b) => (
                <li key={b.appId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-medium">{b.name}</div>
                    <div className="font-mono text-xs text-muted">{b.appId}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge kind={b.status === 'suspended' ? 'bad' : b.status === 'trial' ? 'warn' : 'ok'}>{b.status}</Badge>
                    <Button onClick={() => setActive(b.appId)}>Open</Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No businesses yet" text="Create the first business, then open its dashboard here." action={<Link to="/businesses"><Button>Go to Businesses</Button></Link>} />
          )}
      </Card>
    </>
  )
}
