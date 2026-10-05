import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FeedbackProvider } from '@/components/FeedbackProvider'
import { RequireAuth, RequirePermission } from '@/components/guards'
import BusinessGate from '@/components/BusinessGate'
import AppLayout from '@/layouts/AppLayout'
import Login from '@/pages/Login'
const Businesses = lazy(() => import('@/pages/Businesses'))
const Platform = lazy(() => import('@/pages/Platform'))
const PlatformAudit = lazy(() => import('@/pages/PlatformAudit'))
const BusinessDetail = lazy(() => import('@/pages/BusinessDetail'))
const Plans = lazy(() => import('@/pages/Plans'))
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/ResetPassword'))
const Revenue = lazy(() => import('@/pages/Revenue'))
const PlatformTeam = lazy(() => import('@/pages/PlatformTeam'))
const PlatformSettings = lazy(() => import('@/pages/PlatformSettings'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Regions = lazy(() => import('@/pages/Regions'))
const Categories = lazy(() => import('@/pages/Categories'))
const Pricing = lazy(() => import('@/pages/Pricing'))
const RideSettings = lazy(() => import('@/pages/RideSettings'))
const BusinessSettings = lazy(() => import('@/pages/BusinessSettings'))
const Team = lazy(() => import('@/pages/Team'))
const Account = lazy(() => import('@/pages/Account'))
const Drivers = lazy(() => import('@/pages/Drivers'))
const DriverNew = lazy(() => import('@/pages/DriverNew'))
const DriverDetail = lazy(() => import('@/pages/DriverDetail'))
const Vehicles = lazy(() => import('@/pages/Vehicles'))
const VehicleDetail = lazy(() => import('@/pages/VehicleDetail'))
const Verification = lazy(() => import('@/pages/Verification'))
const Alerts = lazy(() => import('@/pages/Alerts'))
import { Spinner } from '@/components/ui'

// the map library is large, so the page loads only when it is opened
const AuditLog = lazy(() => import('@/pages/AuditLog'))
const Trips = lazy(() => import('@/pages/Trips'))
const Reports = lazy(() => import('@/pages/Reports'))
const Support = lazy(() => import('@/pages/Support'))
const LiveMap = lazy(() => import('@/pages/LiveMap'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const TripDetail = lazy(() => import('@/pages/TripDetail'))
const Riders = lazy(() => import('@/pages/Riders'))
const RiderDetail = lazy(() => import('@/pages/RiderDetail'))

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FeedbackProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="p-6"><Spinner /></div>}>
          <Routes>
            <Route path="/login" element={<Login kind="business" />} />
            <Route path="/platform/login" element={<Login kind="platform" />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/platform/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="account" element={<Account />} />
                <Route path="*" element={<NotFound />} />
                <Route element={<RequirePermission permission="clients.manage" />}>
                  <Route path="businesses" element={<Businesses />} />
                  <Route path="businesses/:id" element={<BusinessDetail />} />
                  <Route path="platform" element={<Platform />} />
                </Route>
                <Route element={<RequirePermission permission="platform.billing" />}>
                  <Route path="plans" element={<Plans />} />
                  <Route path="revenue" element={<Revenue />} />
                </Route>
                <Route element={<RequirePermission permission="platform.team" />}><Route path="platform-team" element={<PlatformTeam />} /></Route>
                <Route element={<RequirePermission permission="platform.audit" />}><Route path="platform-audit" element={<PlatformAudit />} /></Route>
                <Route element={<RequirePermission permission="platform.settings" />}><Route path="platform-settings" element={<PlatformSettings />} /></Route>
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
                    <Route path="live-map" element={<LiveMap />} />
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
          </Suspense>
        </BrowserRouter>
      </FeedbackProvider>
    </QueryClientProvider>
  )
}
