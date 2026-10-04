import { useAuth } from '@/store/auth'
import { isSuperAdmin } from './permissions'
import { resolveTenantScope } from './scope'

/** The tenant every data hook should use: forced for client users, selectable for the super admin. */
export function useScope() {
  const user = useAuth((s) => s.session!.user)
  const activeTenantId = useAuth((s) => s.activeTenantId)
  const tenantId = resolveTenantScope(user, isSuperAdmin(user) ? activeTenantId : user.tenantId)
  return { user, tenantId, isSuper: isSuperAdmin(user) }
}
