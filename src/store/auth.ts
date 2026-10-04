import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Session } from '@/lib/types'

interface AuthState {
  session: Session | null
  /** Super admin only: which client they are looking at (null = all clients). */
  activeTenantId: string | null
  setSession: (session: Session) => void
  setActiveTenant: (id: string | null) => void
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      activeTenantId: null,
      setSession: (session) => set({ session, activeTenantId: session.user.tenantId }),
      setActiveTenant: (activeTenantId) => set({ activeTenantId }),
      logout: () => set({ session: null, activeTenantId: null }),
    }),
    {
      name: 'automet-admin-session',
      storage: createJSONStorage(() => sessionStorage), // cleared when the tab closes
    },
  ),
)
