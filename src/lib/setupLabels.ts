import type { SetupDraftSaved } from '@/lib/types'

/** Plain names for the fields a region or category draft can change. */
export const SETUP_FIELD_LABEL: Record<string, string> = {
  zoneName: 'Zone', state: 'State', city: 'City', active: 'Active', center: 'Centre point', radiusKm: 'Radius (km)',
  name: 'Name', description: 'Description', icon: 'Icon', imageUrl: 'Image link', mapIconUrl: 'Map icon link',
  passengerCapacity: 'Passengers', luggageCapacity: 'Luggage', rideType: 'Ride type', regionIds: 'Regions',
}

/** A field's value as a person reads it. `regionName` turns a region id into its name. */
export function showSetupValue(field: string, value: unknown, regionName: (id: string) => string = (id) => id): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (field === 'center' && typeof value === 'object') {
    const c = value as { lat?: number; lng?: number }
    return Number.isFinite(c.lat) && Number.isFinite(c.lng) ? `${c.lat}, ${c.lng}` : '—'
  }
  if (field === 'regionIds' && Array.isArray(value)) return value.length ? value.map((id) => regionName(String(id))).join(', ') : 'None'
  return String(value)
}

/** True when a save answered "saved as a draft" instead of returning the live record. */
export const isDraftSaved = (r: unknown): r is SetupDraftSaved => typeof r === 'object' && r !== null && (r as { draft?: unknown }).draft === true

export const DRAFT_SAVED_TEXT = 'Saved as a draft. It goes live when you publish the pending changes.'

/** The toast for a save: the draft wording when it waits as a draft, otherwise the wording for a live save. */
export const savedText = <T,>(result: T | SetupDraftSaved, live: (r: T) => string): string => (isDraftSaved(result) ? DRAFT_SAVED_TEXT : live(result as T))
