import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { can, type Permission } from '@/lib/permissions'
import { Card } from './ui'

export function RequireAuth() {
  const session = useAuth((s) => s.session)
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (session.user.mustChangePassword && location.pathname !== '/account') return <Navigate to="/account" replace />
  return <Outlet />
}

export function RequirePermission({ permission }: { permission: Permission }) {
  const user = useAuth((s) => s.session?.user)
  if (!can(user, permission)) {
    return (
      <Card className="mx-auto mt-16 max-w-md p-8 text-center">
        <h2 className="text-lg font-semibold">No access</h2>
        <p className="mt-2 text-sm text-muted">Your role does not include this section.</p>
      </Card>
    )
  }
  return <Outlet />
}
