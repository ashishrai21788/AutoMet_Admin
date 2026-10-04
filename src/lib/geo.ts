/**
 * Country, currency, time zone, state and city options. Loaded on demand (the city list is large) from MIT-licensed
 * data: `countries-list` (countries and currencies) and `city-timezones` (cities, their province and time zone).
 * The city data covers larger cities only, so the screens also let the admin type a state or city that is not listed.
 */
export interface Country { code: string; name: string; currencies: string[] }

export interface GeoData {
  countries: Country[]
  cities: { city: string; province: string; iso2: string; timezone: string; lat: number; lng: number }[]
}

let loading: Promise<GeoData> | null = null

export function loadGeo(): Promise<GeoData> {
  loading ??= Promise.all([import('countries-list'), import('city-timezones/data/cityMap.json')]).then(([cl, ct]) => {
    const countries = Object.entries(cl.countries)
      .map(([code, c]) => ({ code, name: c.name, currencies: c.currency as string[] }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { countries, cities: ct.default as unknown as GeoData['cities'] }
  })
  return loading
}

export function currenciesFor(geo: GeoData, country: string): string[] {
  const list = geo.countries.find((c) => c.code === country)?.currencies ?? []
  // a few countries list historic or fund codes first; keep real, supported ones
  const supported = typeof Intl.supportedValuesOf === 'function' ? new Set(Intl.supportedValuesOf('currency')) : null
  const usable = supported ? list.filter((c) => supported.has(c)) : list
  return usable.length ? usable : list
}

export function timezonesFor(geo: GeoData, country: string): string[] {
  const own = [...new Set(geo.cities.filter((c) => c.iso2 === country).map((c) => c.timezone))].sort()
  if (own.length) return own
  return typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
}

export function statesFor(geo: GeoData, country: string): string[] {
  return [...new Set(geo.cities.filter((c) => c.iso2 === country && c.province).map((c) => c.province))].sort((a, b) => a.localeCompare(b))
}

export function citiesFor(geo: GeoData, country: string, state: string): string[] {
  return [...new Set(geo.cities.filter((c) => c.iso2 === country && c.province === state).map((c) => c.city))].sort((a, b) => a.localeCompare(b))
}

/** The centre point of a listed city, used as the default centre of a new region. */
export function cityCenter(geo: GeoData, country: string, state: string, city: string): { lat: number; lng: number } | null {
  const hit = geo.cities.find((c) => c.iso2 === country && c.province === state && c.city === city)
  return hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng) ? { lat: hit.lat, lng: hit.lng } : null
}

export function countryName(geo: GeoData | undefined, code: string): string {
  return geo?.countries.find((c) => c.code === code)?.name ?? code
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}
