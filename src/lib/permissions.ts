import type { AdminUser, Role } from './types'

/** Mirrors AutoMet_Webend_Apis/lib/adminPermissions.js. The server enforces these; the screens only hide what a role cannot do. */
export type Permission =
  | 'dashboard.view'
  | 'clients.manage'
  | 'drivers.view'
  | 'drivers.manage'
  | 'vehicles.view'
  | 'vehicles.manage'
  | 'documents.view'
  | 'verification.review'
  | 'riders.view'
  | 'trips.view'
  | 'pricing.manage'
  | 'payments.view'
  | 'settings.manage'
  | 'team.manage'
  | 'audit.view'
  | 'riders.manage'
  | 'trips.manage'
  | 'support.manage'

const ALL: Permission[] = [
  'dashboard.view', 'clients.manage', 'drivers.view', 'drivers.manage', 'vehicles.view', 'vehicles.manage',
  'documents.view', 'verification.review', 'riders.view', 'trips.view', 'pricing.manage', 'payments.view',
  'settings.manage', 'team.manage', 'audit.view', 'riders.manage', 'trips.manage', 'support.manage',
]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: ALL,
  client_admin: ALL.filter((p) => p !== 'clients.manage'),
  operations: [
    'dashboard.view', 'drivers.view', 'drivers.manage', 'vehicles.view', 'vehicles.manage', 'documents.view',
    'verification.review', 'riders.view', 'trips.view', 'riders.manage', 'trips.manage', 'support.manage',
  ],
  support: ['dashboard.view', 'drivers.view', 'vehicles.view', 'riders.view', 'trips.view', 'support.manage'],
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
