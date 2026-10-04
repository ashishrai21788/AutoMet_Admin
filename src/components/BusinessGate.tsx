import { Navigate, Outlet } from 'react-router-dom'
import { useScope } from '@/lib/useScope'

/**
 * Business pages (drivers, trips, pricing...) belong to a business and its admins. The platform owner manages businesses
 * from Platform, Businesses and Revenue instead, so any business page address sends them to the platform overview.
 */
export default function BusinessGate() {
  const { isSuper } = useScope()
  if (isSuper) return <Navigate to="/platform" replace />
  return <Outlet />
}
