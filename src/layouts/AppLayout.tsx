import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  BadgeCheck, BarChart3, Bell, Building2, Calculator, Car, CarFront, CircleUserRound, Gauge, History, LayoutDashboard, LogOut, MapPin, Menu, PanelLeftClose, PanelLeftOpen,
  LifeBuoy, Layers, Map as MapIcon, Route, ShieldCheck, Settings, SlidersHorizontal, UserCog, UserRound, Users, Wallet, X,
} from 'lucide-react'
import { api } from '@/api'
import { useAlerts } from '@/api/hooks'
import { useAuth } from '@/store/auth'
import { useUi } from '@/store/ui'
import { can, isSuperAdmin, ROLE_LABEL, type Permission } from '@/lib/permissions'
import ErrorBoundary from '@/components/ErrorBoundary'
import { loginPathFor } from '@/lib/portal'

type Icon = typeof MapPin
interface NavItem { to: string; label: string; icon: Icon; permission?: Permission; end?: boolean }

const PLATFORM_NAV: NavItem[] = [
  { to: '/platform', label: 'Platform Overview', icon: Gauge, permission: 'clients.manage' },
  { to: '/businesses', label: 'Client Businesses', icon: Building2, permission: 'clients.manage' },
  { to: '/plans', label: 'Plans & Subscriptions', icon: Layers, permission: 'platform.billing' },
  { to: '/revenue', label: 'Revenue & Billing', icon: Wallet, permission: 'platform.billing' },
  { to: '/platform-team', label: 'Platform Team', icon: Users, permission: 'platform.team' },
  { to: '/platform-audit', label: 'Audit & Security', icon: History, permission: 'platform.audit' },
  { to: '/platform-settings', label: 'Platform Settings', icon: Settings, permission: 'platform.settings' },
  { to: '/account', label: 'My Profile', icon: CircleUserRound },
]

const BUSINESS_NAV: NavItem[] = [
  { to: '/', label: 'Business Dashboard', icon: LayoutDashboard, permission: 'dashboard.view', end: true },
  { to: '/regions', label: 'Service Regions', icon: MapPin, permission: 'dashboard.view' },
  { to: '/categories', label: 'Vehicle Categories', icon: Car, permission: 'dashboard.view' },
  { to: '/pricing', label: 'Pricing & Fare Rules', icon: Calculator, permission: 'dashboard.view' },
  { to: '/live-map', label: 'Live Map', icon: MapIcon, permission: 'dashboard.view' },
  { to: '/trips', label: 'Rides & Trips', icon: Route, permission: 'trips.view' },
  { to: '/reports', label: 'Reports & Analytics', icon: BarChart3, permission: 'trips.view' },
  { to: '/drivers', label: 'Drivers', icon: Users, permission: 'drivers.view' },
  { to: '/riders', label: 'Riders', icon: UserRound, permission: 'riders.view' },
  { to: '/vehicles', label: 'Vehicles', icon: CarFront, permission: 'vehicles.view' },
  { to: '/verification', label: 'Driver Verification', icon: BadgeCheck, permission: 'documents.view' },
  { to: '/support', label: 'Support', icon: LifeBuoy, permission: 'support.manage' },
  { to: '/alerts', label: 'Alerts', icon: Bell, permission: 'dashboard.view' },
  { to: '/ride-settings', label: 'Ride Settings', icon: SlidersHorizontal, permission: 'dashboard.view' },
  { to: '/audit', label: 'Audit Log', icon: History, permission: 'audit.view' },
  { to: '/team', label: 'Team Management', icon: UserCog, permission: 'team.manage' },
  { to: '/settings', label: 'Business Settings', icon: Settings, permission: 'settings.manage' },
  { to: '/account', label: 'My Profile', icon: CircleUserRound },
]

/** Open critical and warning alerts, next to the Alerts menu item. Quiet when there are none or the list cannot be read. */
/** Black or white text for a brand colour, whichever reads better on it. */
const readableOn = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#1a1200'
  const n = parseInt(m[1], 16)
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.6 ? '#1a1200' : '#ffffff'
}

/** A business's own logo, or its initial on its brand colour. Nothing of AutoMet shows to a business admin. */
function BusinessMark({ name, logoUrl, color }: { name: string; logoUrl: string; color: string }) {
  const [broken, setBroken] = useState(false)
  if (logoUrl && !broken) return <img src={logoUrl} alt="" onError={() => setBroken(true)} className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain" />
  return <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-sm font-semibold text-brand-fg" style={color ? { background: color, color: readableOn(color) } : undefined} aria-hidden>{(name.trim()[0] ?? '?').toUpperCase()}</div>
}

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
  const { session, logout } = useAuth()
  const { collapsed, toggleCollapsed } = useUi()
  const user = session!.user
  const navigate = useNavigate()
  const location = useLocation()
  // the phone menu is open for one page only: moving to another page closes it without an effect
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === location.pathname
  const setOpen = (v: boolean) => setOpenOn(v ? location.pathname : null)
  const superAdmin = isSuperAdmin(user)

  // a business user's own business, for the name shown in the top bar (the platform owner has none)
  const businesses = useQuery({ queryKey: ['businesses'], queryFn: api.businesses.list, enabled: !superAdmin })
  const current = businesses.data?.find((b) => b.appId === user.tenantId)

  // a business admin sees their own business: its name in the tab, and its brand colour as the accent
  const brandColor = !superAdmin && current ? current.brandColor : ''
  useEffect(() => { document.title = superAdmin ? 'AutoMet Platform' : current ? `${current.name} Admin` : 'Admin' }, [superAdmin, current])
  useEffect(() => {
    if (!brandColor) return
    const root = document.documentElement.style
    root.setProperty('--brand', brandColor)
    root.setProperty('--brand-fg', readableOn(brandColor))
    return () => { root.removeProperty('--brand'); root.removeProperty('--brand-fg') }
  }, [brandColor])


  const items = BUSINESS_NAV.filter((n) => !n.permission || can(user, n.permission))
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

  function signOut() { logout(); navigate(loginPathFor(user.role)) }

  const sidebar = (mini: boolean) => (
    <>
      <div className={clsx('flex items-center gap-2 px-4 py-4', mini && 'justify-center px-2')}>
        {superAdmin
          ? <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-brand-fg"><ShieldCheck size={18} aria-hidden /></div>
          : <BusinessMark name={current?.name ?? ''} logoUrl={current?.logoUrl ?? ''} color={current?.brandColor ?? ''} />}
        {!mini && (superAdmin
          ? <div className="text-sm font-semibold leading-tight">AutoMet<br /><span className="font-normal text-muted">Platform</span></div>
          : <div className="min-w-0 text-sm font-semibold leading-tight"><span className="block truncate">{current?.name ?? ' '}</span><span className="font-normal text-muted">Admin</span></div>)}
      </div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {/* the platform owner manages businesses; a business's own screens (drivers, trips, pricing...) belong to its admins */}
        {superAdmin
          ? PLATFORM_NAV.filter((n) => !n.permission || can(user, n.permission)).map((n) => link(n, mini))
          : items.map((n) => link(n, mini))}
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
            <span className="text-sm text-muted">Platform owner</span>
          ) : current ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{current.name}</span>
              <span className="hidden font-mono text-xs text-muted sm:inline">{current.appId}</span>
            </div>
          ) : null}
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-6xl"><ErrorBoundary resetKey={location.pathname}><Outlet /></ErrorBoundary></div>
        </main>
      </div>
    </div>
  )
}
