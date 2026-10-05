import { describe, expect, it } from 'vitest'
import { can, ROLE_PERMISSIONS, type Permission } from './permissions'
import type { AdminUser, Role } from './types'

const as = (role: Role): AdminUser => ({ id: 'x', name: 'X', email: 'x@x.test', role, tenantId: role === 'super_admin' ? null : 'app_a' })

const PLATFORM: Permission[] = ['clients.manage', 'platform.billing', 'platform.team', 'platform.audit', 'platform.settings']

describe('permissions', () => {
  it('the platform owner holds only platform permissions', () => {
    expect(ROLE_PERMISSIONS.super_admin.sort()).toEqual([...PLATFORM].sort())
    for (const p of ROLE_PERMISSIONS.client_admin) expect(can(as('super_admin'), p)).toBe(false)
  })

  it('no business role holds any platform permission', () => {
    for (const role of ['client_admin', 'operations', 'support', 'finance'] as Role[]) {
      for (const p of PLATFORM) expect(can(as(role), p), `${role} must not have ${p}`).toBe(false)
    }
  })

  it('business roles keep their own limits', () => {
    expect(can(as('client_admin'), 'team.manage')).toBe(true)
    expect(can(as('operations'), 'team.manage')).toBe(false)
    expect(can(as('support'), 'drivers.manage')).toBe(false)
    expect(can(as('finance'), 'drivers.view')).toBe(false)
    expect(can(as('finance'), 'payments.view')).toBe(true)
  })

  it('nobody signed in can do nothing', () => {
    expect(can(null, 'dashboard.view')).toBe(false)
    expect(can(undefined, 'clients.manage')).toBe(false)
  })
})
