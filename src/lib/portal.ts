import type { Role } from './types'

/**
 * Two sign-in addresses on the one dashboard: /login for businesses and /platform/login for the platform owner. Each accepts
 * only its own kind of account, so the two can never be mixed up. The menus, route guards and the API's permissions do the
 * real separation; this keeps the entry points apart.
 */
export const BUSINESS_LOGIN = '/login'
export const PLATFORM_LOGIN = '/platform/login'

export const loginPathFor = (role: Role | undefined) => (role === 'super_admin' ? PLATFORM_LOGIN : BUSINESS_LOGIN)

/** Pages that belong to the platform owner. Someone sent to sign in from one of these gets the platform sign-in. */
const PLATFORM_PREFIXES = ['/platform', '/businesses', '/plans', '/revenue']
export const isPlatformPath = (path: string) => PLATFORM_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}-`))
