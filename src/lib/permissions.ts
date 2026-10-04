import type { AdminUser, Role } from './types'

export type Permission =
  | 'dashboard.view'
  | 'clients.manage'
  | 'drivers.view'
  | 'drivers.manage'
  | 'riders.view'
  | 'trips.view'
  | 'pricing.manage'
  | 'payments.view'
  | 'settings.manage'
  | 'team.manage'
  | 'audit.view'

const ALL: Permission[] = [
  'dashboard.view', 'clients.manage', 'drivers.view', 'drivers.manage', 'riders.view',
  'trips.view', 'pricing.manage', 'payments.view', 'settings.manage', 'team.manage', 'audit.view',
]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: ALL,
  client_admin: ALL.filter((p) => p !== 'clients.manage'),
  operations: ['dashboard.view', 'drivers.view', 'drivers.manage', 'riders.view', 'trips.view'],
  support: ['dashboard.view', 'drivers.view', 'riders.view', 'trips.view'],
  finance: ['dashboard.view', 'trips.view', 'payments.view'],
}

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super admin',
  client_admin: 'Client admin',
  operations: 'Operations',
  support: 'Support',
  finance: 'Finance',
}

export function can(user: AdminUser | null | undefined, permission: Permission): boolean {
  return !!user && ROLE_PERMISSIONS[user.role].includes(permission)
}

export const isSuperAdmin = (user: AdminUser | null | undefined) => user?.role === 'super_admin'
