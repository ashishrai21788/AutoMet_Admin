import { useState } from 'react'

/**
 * The current page of a filtered list. When any filter changes (`resetKey` changes) the list is back on page 1, worked out
 * while rendering instead of in an effect, so there is no extra render with the old page and a new filter.
 */
export function usePage(resetKey: string): readonly [number, (page: number) => void] {
  const [state, setState] = useState({ key: resetKey, page: 1 })
  const page = state.key === resetKey ? state.page : 1
  return [page, (next: number) => setState({ key: resetKey, page: next })] as const
}
