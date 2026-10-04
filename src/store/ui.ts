import { create } from 'zustand'

const KEY = 'automet-admin-sidebar-collapsed'

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false // storage can be blocked; the sidebar then simply starts expanded
  }
}

interface UiState {
  collapsed: boolean
  toggleCollapsed: () => void
}

/** Per-browser layout preference (not account data). */
export const useUi = create<UiState>((set, get) => ({
  collapsed: read(),
  toggleCollapsed: () => {
    const next = !get().collapsed
    try {
      localStorage.setItem(KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
    set({ collapsed: next })
  },
}))
