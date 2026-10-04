import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FeedbackProvider } from '@/components/feedback'
import { RequireAuth, RequirePermission } from '@/components/guards'
import BusinessGate from '@/components/BusinessGate'
import AppLayout from '@/layouts/AppLayout'
import Login from '@/pages/Login'
import Businesses from '@/pages/Businesses'
import Dashboard from '@/pages/Dashboard'
import Regions from '@/pages/Regions'
import Categories from '@/pages/Categories'
import Pricing from '@/pages/Pricing'
import RideSettings from '@/pages/RideSettings'
import BusinessSettings from '@/pages/BusinessSettings'
import Team from '@/pages/Team'
import Account from '@/pages/Account'

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
                <Route element={<RequirePermission permission="clients.manage" />}>
                  <Route path="businesses" element={<Businesses />} />
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
