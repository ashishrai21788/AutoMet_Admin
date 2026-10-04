import type { LiveDriver } from '@/lib/types'

/** Colours are the same as the legend on the page. Leaflet draws on a canvas-like SVG, so theme tokens cannot be used here. */
export const MAP_COLOURS = {
  liveEligible: '#16a34a',
  liveNotEligible: '#d97706',
  onTrip: '#2563eb',
  stale: '#9ca3af',
  searching: '#9333ea',
  region: '#f5a300',
} as const

export function driverColour(d: LiveDriver): string {
  if (d.presence === 'STALE') return MAP_COLOURS.stale
  if (d.currentTripId) return MAP_COLOURS.onTrip
  return d.eligible ? MAP_COLOURS.liveEligible : MAP_COLOURS.liveNotEligible
}

