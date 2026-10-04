import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FeedbackProvider } from '@/components/FeedbackProvider'
import { RequireAuth, RequirePermission } from '@/components/guards'
import BusinessGate from '@/components/BusinessGate'
import AppLayout from '@/layouts/AppLayout'
import Login from '@/pages/Login'
import Businesses from '@/pages/Businesses'
import Platform from '@/pages/Platform'
import PlatformAudit from '@/pages/PlatformAudit'
import Dashboard from '@/pages/Dashboard'
import Regions from '@/pages/Regions'
import Categories from '@/pages/Categories'
import Pricing from '@/pages/Pricing'
import RideSettings from '@/pages/RideSettings'
import BusinessSettings from '@/pages/BusinessSettings'
import Team from '@/pages/Team'
import Account from '@/pages/Account'
import Drivers from '@/pages/Drivers'
import DriverNew from '@/pages/DriverNew'
import DriverDetail from '@/pages/DriverDetail'
import Vehicles from '@/pages/Vehicles'
import VehicleDetail from '@/pages/VehicleDetail'
import Verification from '@/pages/Verification'
import Alerts from '@/pages/Alerts'
import { Spinner } from '@/components/ui'

// the map library is large, so the page loads only when it is opened
const LiveMap = lazy(() => import('@/pages/LiveMap'))
import AuditLog from '@/pages/AuditLog'
import Trips from '@/pages/Trips'
import Reports from '@/pages/Reports'
import Support from '@/pages/Support'
import NotFound from '@/pages/NotFound'
import TripDetail from '@/pages/TripDetail'
import Riders from '@/pages/Riders'
import RiderDetail from '@/pages/RiderDetail'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FeedbackProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="account" element={<Account />} />
                <Route path="*" element={<NotFound />} />
                <Route element={<RequirePermission permission="clients.manage" />}>
                  <Route path="businesses" element={<Businesses />} />
                  <Route path="platform" element={<Platform />} />
                  <Route path="platform-audit" element={<PlatformAudit />} />
                </Route>
                {/* every page below works on one business; the super admin picks it first */}
                <Route element={<BusinessGate />}>
                  <Route element={<RequirePermission permission="dashboard.view" />}>
                    <Route index element={<Dashboard />} />
                    <Route path="regions" element={<Regions />} />
                    <Route path="categories" element={<Categories />} />
                    <Route path="pricing" element={<Pricing />} />
                    <Route path="ride-settings" element={<RideSettings />} />
                  </Route>
                  <Route element={<RequirePermission permission="dashboard.view" />}>
                    <Route path="alerts" element={<Alerts />} />
                    <Route path="live-map" element={<Suspense fallback={<Spinner />}><LiveMap /></Suspense>} />
                  </Route>
                  <Route element={<RequirePermission permission="trips.view" />}>
                    <Route path="trips" element={<Trips />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="trips/:id" element={<TripDetail />} />
                  </Route>
                  <Route element={<RequirePermission permission="riders.view" />}>
                    <Route path="riders" element={<Riders />} />
                    <Route path="riders/:id" element={<RiderDetail />} />
                  </Route>
                  <Route element={<RequirePermission permission="support.manage" />}>
                    <Route path="support" element={<Support />} />
                  </Route>
                  <Route element={<RequirePermission permission="audit.view" />}>
                    <Route path="audit" element={<AuditLog />} />
                  </Route>
                  <Route element={<RequirePermission permission="drivers.view" />}>
                    <Route path="drivers" element={<Drivers />} />
                    <Route path="drivers/:id" element={<DriverDetail />} />
                  </Route>
                  <Route element={<RequirePermission permission="drivers.manage" />}>
                    <Route path="drivers/new" element={<DriverNew />} />
                  </Route>
                  <Route element={<RequirePermission permission="vehicles.view" />}>
                    <Route path="vehicles" element={<Vehicles />} />
                    <Route path="vehicles/:id" element={<VehicleDetail />} />
                  </Route>
                  <Route element={<RequirePermission permission="documents.view" />}>
                    <Route path="verification" element={<Verification />} />
                  </Route>
                  <Route element={<RequirePermission permission="settings.manage" />}>
                    <Route path="settings" element={<BusinessSettings />} />
                  </Route>
                  <Route element={<RequirePermission permission="team.manage" />}>
                    <Route path="team" element={<Team />} />
                  </Route>
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </FeedbackProvider>
    </QueryClientProvider>
  )
}
