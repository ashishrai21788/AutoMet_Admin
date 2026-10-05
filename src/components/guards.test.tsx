import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RequireAuth, RequirePermission } from './guards'
import BusinessGate from './BusinessGate'
import { useAuth } from '@/store/auth'
import type { AdminUser, Role } from '@/lib/types'

const user = (role: Role, extra: Partial<AdminUser> = {}): AdminUser => ({ id: 'u1', name: 'U', email: 'u@x.test', role, tenantId: role === 'super_admin' ? null : 'app_a', ...extra })
const signIn = (u: AdminUser) => useAuth.getState().setSession({ token: 't', user: u })

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>BUSINESS LOGIN</div>} />
        <Route path="/platform/login" element={<div>PLATFORM LOGIN</div>} />
        <Route element={<RequireAuth />}>
          <Route path="/account" element={<div>ACCOUNT</div>} />
          <Route path="/platform" element={<div>PLATFORM HOME</div>} />
          <Route path="/revenue" element={<RequirePermission permission="platform.billing" />}>
            <Route index element={<div>REVENUE</div>} />
          </Route>
          <Route element={<BusinessGate />}>
            <Route path="/" element={<div>BUSINESS HOME</div>} />
            <Route path="/drivers" element={<RequirePermission permission="drivers.view" />}>
              <Route index element={<div>DRIVERS</div>} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => { cleanup(); useAuth.getState().logout(); sessionStorage.clear() })

describe('sign-in redirects', () => {
  it('a signed-out visitor to a business page goes to the business sign-in', () => {
    renderAt('/drivers')
    expect(screen.getByText('BUSINESS LOGIN')).toBeTruthy()
  })

  it('a signed-out visitor to a platform page goes to the platform sign-in', () => {
    renderAt('/revenue')
    expect(screen.getByText('PLATFORM LOGIN')).toBeTruthy()
  })

  it('someone who last signed in as the platform owner returns to the platform sign-in, even from a shared page', () => {
    signIn(user('super_admin'))
    useAuth.getState().logout()
    renderAt('/account')
    expect(screen.getByText('PLATFORM LOGIN')).toBeTruthy()
  })
})

describe('the platform owner is kept out of business pages', () => {
  it('is sent from a business page to the platform overview', () => {
    signIn(user('super_admin'))
    renderAt('/drivers')
    expect(screen.queryByText('DRIVERS')).toBeNull()
    expect(screen.getByText('PLATFORM HOME')).toBeTruthy()
  })

  it('is held on My Profile until two-step verification is on', () => {
    signIn(user('super_admin', { twoFactorSetupRequired: true }))
    renderAt('/platform')
    expect(screen.getByText('ACCOUNT')).toBeTruthy()
  })
})

describe('business staff are kept out of platform pages and their own limits', () => {
  it('a business admin opening a platform page is told they have no access', () => {
    signIn(user('client_admin'))
    renderAt('/revenue')
    expect(screen.getByText('No access')).toBeTruthy()
    expect(screen.queryByText('REVENUE')).toBeNull()
  })

  it('a role without the permission is refused, one with it is let in', () => {
    signIn(user('finance'))
    renderAt('/drivers')
    expect(screen.getByText('No access')).toBeTruthy()
    cleanup()
    signIn(user('operations'))
    renderAt('/drivers')
    expect(screen.getByText('DRIVERS')).toBeTruthy()
  })

  it('a temporary password sends the person to change it first', () => {
    signIn(user('client_admin', { mustChangePassword: true }))
    renderAt('/')
    expect(screen.getByText('ACCOUNT')).toBeTruthy()
  })
})
