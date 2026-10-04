import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LiveDriver, LiveMapData, LiveTrip } from '@/lib/types'

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

interface Props {
  data: LiveMapData
  drivers: LiveDriver[]
  trips: LiveTrip[]
  selected: { kind: 'driver' | 'trip'; id: string } | null
  onSelect: (s: { kind: 'driver' | 'trip'; id: string }) => void
  /** bump to refit the view to everything shown */
  fitSignal: number
}

/**
 * The map itself. Leaflet owns the DOM inside the container, so the map is created once and its markers are updated in
 * place when new data arrives (nothing flickers or loses the zoom the person chose). Everything here is also reachable
 * from the list next to it, which is what keyboard and screen reader users use.
 */
export default function LiveMapView({ data, drivers, trips, selected, onSelect, fitSignal }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layers = useRef<{ regions: L.LayerGroup; trips: L.LayerGroup; drivers: L.LayerGroup } | null>(null)
  const driverMarkers = useRef(new Map<string, L.CircleMarker>())
  const fitted = useRef(false)
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  // create the map once
  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([20.5937, 78.9629], 4)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(m)
    layers.current = { regions: L.layerGroup().addTo(m), trips: L.layerGroup().addTo(m), drivers: L.layerGroup().addTo(m) }
    map.current = m
    const driverMap = driverMarkers.current
    return () => { m.remove(); map.current = null; layers.current = null; driverMap.clear(); fitted.current = false }
  }, [])

  // service areas
  useEffect(() => {
    const l = layers.current
    if (!l) return
    l.regions.clearLayers()
    for (const r of data.regions) {
      L.circle([r.center.lat, r.center.lng], { radius: r.radiusKm * 1000, color: MAP_COLOURS.region, weight: 1.5, fillOpacity: 0.05, interactive: false })
        .bindTooltip(r.name, { sticky: true }).addTo(l.regions)
    }
  }, [data.regions])

  // active trips: pickup point, destination, and a dashed line between them
  useEffect(() => {
    const l = layers.current
    if (!l) return
    l.trips.clearLayers()
    for (const t of trips) {
      if (!t.pickup) continue
      const isSel = selected?.kind === 'trip' && selected.id === t.id
      if (t.drop) L.polyline([[t.pickup.lat, t.pickup.lng], [t.drop.lat, t.drop.lng]], { color: MAP_COLOURS.searching, weight: isSel ? 3 : 1.5, dashArray: '5 6', opacity: 0.7, interactive: false }).addTo(l.trips)
      L.circleMarker([t.pickup.lat, t.pickup.lng], { radius: isSel ? 8 : 6, color: '#fff', weight: 2, fillColor: MAP_COLOURS.searching, fillOpacity: 1 })
        .bindTooltip(`Pickup · ${t.id}`).on('click', () => onSelectRef.current({ kind: 'trip', id: t.id })).addTo(l.trips)
      if (t.drop) L.circleMarker([t.drop.lat, t.drop.lng], { radius: 4, color: MAP_COLOURS.searching, weight: 2, fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(l.trips)
    }
  }, [trips, selected])

  // drivers: markers are kept by id and moved, so a heartbeat does not redraw the map
  useEffect(() => {
    const l = layers.current
    if (!l) return
    const seen = new Set<string>()
    for (const d of drivers) {
      seen.add(d.id)
      const isSel = selected?.kind === 'driver' && selected.id === d.id
      const style = { radius: isSel ? 12 : 9, color: isSel ? '#111827' : '#fff', weight: isSel ? 3 : 2, fillColor: driverColour(d), fillOpacity: d.presence === 'STALE' ? 0.65 : 0.95 }
      let marker = driverMarkers.current.get(d.id)
      if (!marker) {
        marker = L.circleMarker([d.lat, d.lng], style).on('click', () => onSelectRef.current({ kind: 'driver', id: d.id })).addTo(l.drivers)
        driverMarkers.current.set(d.id, marker)
      } else {
        marker.setLatLng([d.lat, d.lng]).setStyle(style)
      }
      marker.bindTooltip(`${d.name}${d.currentTripId ? ' · on a trip' : ''}${d.presence === 'STALE' ? ' · location out of date' : ''}`)
    }
    for (const [id, marker] of driverMarkers.current) {
      if (!seen.has(id)) { l.drivers.removeLayer(marker); driverMarkers.current.delete(id) }
    }
  }, [drivers, selected])

  // fit the view to what is shown: once when data first arrives, and whenever the person asks
  useEffect(() => {
    const m = map.current
    if (!m) return
    const points: L.LatLngExpression[] = [
      ...drivers.map((d) => [d.lat, d.lng] as L.LatLngExpression),
      ...trips.filter((t) => t.pickup).map((t) => [t.pickup!.lat, t.pickup!.lng] as L.LatLngExpression),
    ]
    if (points.length === 0 && data.regions.length > 0) data.regions.forEach((r) => points.push([r.center.lat, r.center.lng]))
    if (points.length === 0) return
    if (!fitted.current || fitSignal > 0) {
      m.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 })
      fitted.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal, drivers.length === 0, data.regions.length])

  // move to the selected driver or trip
  useEffect(() => {
    const m = map.current
    if (!m || !selected) return
    const d = selected.kind === 'driver' ? drivers.find((x) => x.id === selected.id) : null
    const t = selected.kind === 'trip' ? trips.find((x) => x.id === selected.id) : null
    const p = d ? [d.lat, d.lng] : t?.pickup ? [t.pickup.lat, t.pickup.lng] : null
    if (p) m.panTo(p as L.LatLngExpression, { animate: true })
    // only when the selection changes, not on every refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.kind, selected?.id])

  return <div ref={el} className="h-[28rem] w-full rounded-xl border border-line sm:h-[34rem]" role="application" aria-label="Map of online drivers and active trips. The same information is listed beside it." />
}
