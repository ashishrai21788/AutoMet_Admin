import type { AdminUser } from './types'
import { isSuperAdmin } from './permissions'

export class ForbiddenError extends Error {
  constructor(message = 'You do not have access to this client') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

/**
 * The one place that decides which client's data a request may touch.
 * - Super admin: any client, or `null` for all clients.
 * - Everyone else: only their own client; asking for another one is an error.
 * The backend must enforce the same rule on every request; this is the UI's copy of it.
 */
export function resolveTenantScope(user: AdminUser, requested: string | null): string | null {
  if (isSuperAdmin(user)) return requested
  if (!user.tenantId) throw new ForbiddenError('Account is not linked to a client')
  if (requested && requested !== user.tenantId) throw new ForbiddenError()
  return user.tenantId
}
