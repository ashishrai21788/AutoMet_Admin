import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  BadgeCheck, Bell, Building2, Calculator, Car, CarFront, CircleUserRound, Gauge, History, LayoutDashboard, LogOut, MapPin, Menu, PanelLeftClose, PanelLeftOpen,
  Map as MapIcon, Route, ShieldCheck, Settings, SlidersHorizontal, UserRound, Users, X,
} from 'lucide-react'
import { api } from '@/api'
import { useAlerts } from '@/api/hooks'
import { useAuth } from '@/store/auth'
import { useUi } from '@/store/ui'
import { can, isSuperAdmin, ROLE_LABEL, type Permission } from '@/lib/permissions'
import { Badge } from '@/components/ui'

type Icon = typeof MapPin
interface NavItem { to: string; label: string; icon: Icon; permission: Permission; end?: boolean }

const BUSINESS_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view', end: true },
  { to: '/regions', label: 'Regions', icon: MapPin, permission: 'dashboard.view' },
  { to: '/categories', label: 'Vehicle Categories', icon: Car, permission: 'dashboard.view' },
  { to: '/pricing', label: 'Pricing & Fare Rules', icon: Calculator, permission: 'dashboard.view' },
  { to: '/live-map', label: 'Live Map', icon: MapIcon, permission: 'dashboard.view' },
  { to: '/trips', label: 'Trips', icon: Route, permission: 'trips.view' },
  { to: '/drivers', label: 'Drivers', icon: Users, permission: 'drivers.view' },
  { to: '/riders', label: 'Riders', icon: UserRound, permission: 'riders.view' },
  { to: '/vehicles', label: 'Vehicles', icon: CarFront, permission: 'vehicles.view' },
  { to: '/verification', label: 'Driver Verification', icon: BadgeCheck, permission: 'documents.view' },
  { to: '/alerts', label: 'Alerts', icon: Bell, permission: 'dashboard.view' },
  { to: '/ride-settings', label: 'Ride Settings', icon: SlidersHorizontal, permission: 'dashboard.view' },
  { to: '/audit', label: 'Audit Log', icon: History, permission: 'audit.view' },
  { to: '/settings', label: 'Business Settings', icon: Settings, permission: 'settings.manage' },
  { to: '/account', label: 'Admin Profile', icon: CircleUserRound, permission: 'dashboard.view' },
]

/** Open critical and warning alerts, next to the Alerts menu item. Quiet when there are none or the list cannot be read. */
function AlertCount({ mini }: { mini: boolean }) {
  const alerts = useAlerts()
  const counts = alerts.data?.counts
  const n = counts ? counts.critical + counts.warning : 0
  if (!n) return null
  return (
    <span
      className={clsx('ml-auto rounded-full px-1.5 text-[11px] font-semibold tabular-nums', counts!.critical ? 'bg-danger text-white' : 'bg-brand text-black', mini && 'sr-only')}
      aria-label={`${n} open alert${n === 1 ? '' : 's'}`}
    >{n}</span>
  )
}

export default function AppLayout() {
  const { session, activeTenantId, setActiveTenant, logout } = useAuth()
  const { collapsed, toggleCollapsed } = useUi()
  const user = session!.user
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const superAdmin = isSuperAdmin(user)

  const businesses = useQuery({ queryKey: ['businesses'], queryFn: api.businesses.list })
  const currentId = superAdmin ? activeTenantId : user.tenantId
  const current = businesses.data?.find((b) => b.appId === currentId)

  useEffect(() => setOpen(false), [location.pathname])

  const items = BUSINESS_NAV.filter((n) => can(user, n.permission))
  const link = (n: NavItem, mini: boolean) => (
    <NavLink
      key={n.to} to={n.to} end={n.end} title={mini ? n.label : undefined}
      className={({ isActive }) => clsx(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-brand',
        isActive ? 'bg-brand/15 font-medium' : 'text-muted hover:bg-black/5 dark:hover:bg-white/5',
        mini && 'justify-center px-2',
      )}
    >
      <n.icon size={18} aria-hidden className="shrink-0" />
      <span className={clsx(mini && 'sr-only')}>{n.label}</span>
      {n.to === '/alerts' && <AlertCount mini={mini} />}
    </NavLink>
  )

  function signOut() { logout(); navigate('/login') }

  const sidebar = (mini: boolean) => (
    <>
      <div className={clsx('flex items-center gap-2 px-4 py-4', mini && 'justify-center px-2')}>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-brand-fg"><ShieldCheck size={18} aria-hidden /></div>
        {!mini && <div className="text-sm font-semibold leading-tight">AutoMet<br /><span className="font-normal text-muted">Admin</span></div>}
      </div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {superAdmin && (
          <>
            {!mini && <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted">Platform</p>}
            {link({ to: '/platform', label: 'Platform Overview', icon: Gauge, permission: 'clients.manage' }, mini)}
            {link({ to: '/businesses', label: 'Businesses', icon: Building2, permission: 'clients.manage' }, mini)}
            {!mini && <p className="px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-muted">{current ? current.name : 'Business'}</p>}
            {mini && <hr className="my-2 border-line" />}
          </>
        )}
        {items.map((n) => link(n, mini))}
      </nav>
      <div className="border-t border-line p-3">
        <button
          type="button" onClick={signOut} title={mini ? 'Logout' : undefined}
          className={clsx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-brand dark:hover:bg-white/5', mini && 'justify-center px-2')}
        >
          <LogOut size={18} aria-hidden className="shrink-0" />
          <span className={clsx(mini && 'sr-only')}>Logout</span>
        </button>
        {!mini && (
          <div className="mt-2 px-3 text-xs text-muted">
            <div className="truncate font-medium text-ink">{user.name}</div>
            <div>{ROLE_LABEL[user.role]}</div>
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="flex h-full">
      {/* desktop sidebar */}
      <aside className={clsx('hidden shrink-0 flex-col border-r border-line bg-surface transition-[width] lg:flex', collapsed ? 'w-16' : 'w-64')}>
        {sidebar(collapsed)}
      </aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl" role="dialog" aria-modal="true" aria-label="Navigation">
            <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"><X size={18} /></button>
            {sidebar(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
          <button type="button" className="rounded-lg p-1.5 hover:bg-black/5 lg:hidden dark:hover:bg-white/10" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <button
            type="button" className="hidden rounded-lg p-1.5 hover:bg-black/5 lg:block dark:hover:bg-white/10"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggleCollapsed}
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <div className="flex-1" />
          {superAdmin ? (
            <div className="flex items-center gap-2">
              <label htmlFor="business-select" className="sr-only">Business</label>
              <select
                id="business-select" value={activeTenantId ?? ''} onChange={(e) => { setActiveTenant(e.target.value || null); navigate('/') }}
                className="max-w-[14rem] rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-brand"
              >
                <option value="">Select a business…</option>
                {businesses.data?.map((b) => <option key={b.appId} value={b.appId}>{b.name}</option>)}
              </select>
            </div>
          ) : current ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{current.name}</span>
              <span className="hidden font-mono text-xs text-muted sm:inline">{current.appId}</span>
            </div>
          ) : null}
        </header>

        {superAdmin && current && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-brand/10 px-4 py-1.5 text-xs">
            <span>Managing <strong>{current.name}</strong> <Badge kind={current.status === 'suspended' ? 'bad' : current.status === 'trial' ? 'warn' : 'ok'}>{current.status}</Badge></span>
            <Link to="/businesses" className="underline">Back to all businesses</Link>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-6xl"><Outlet /></div>
        </main>
      </div>
    </div>
  )
}
