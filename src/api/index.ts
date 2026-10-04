import type {
  AdminUser, Business, CancellationPolicy, Category, CategoryInput, CreatedBusiness, CreatedUser, FarePreview,
  FareRule, FareRuleFields, LocateResult, Market, NewBusinessInput, NewUserInput, Overview, PolicyFields, Region, Session, SetupStatus,
} from '@/lib/types'
import type {
  AlertsPayload, AuditPage, OpsStats, PlatformOverview, RiderDetail, RiderItem, TripDetail, TripItem, Availability, DocumentsPayload, DriverDetail, DriverInput, DriverListItem, HistoryEntry, Paged, RequirementDef, VehicleDetail, VehicleInput, RideSettings, VehicleListItem, VerificationStatus,
} from '@/lib/types'
import { useAuth } from '@/store/auth'

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '')

/** False when the build was made without VITE_API_BASE_URL; every request would then go to the wrong server. */
export const API_CONFIGURED = BASE !== ''
export const NOT_CONFIGURED_MESSAGE =
  'This dashboard is not connected to a server: the API address (VITE_API_BASE_URL) was not set when it was built. Set it in the hosting settings and redeploy.'

/** An API failure with the server's message and, for validation errors, a message per field. */
export class ApiError extends Error {
  status: number
  fieldErrors: Record<string, string>
  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

/** Which business a request is for. The server checks it against the signed-in account; this is only a request. */
function currentAppId(): string | null {
  const { session, activeTenantId } = useAuth.getState()
  if (!session) return null
  return session.user.role === 'super_admin' ? activeTenantId : session.user.tenantId
}

async function request<T>(path: string, init: RequestInit & { business?: boolean } = {}): Promise<T> {
  if (!API_CONFIGURED) throw new ApiError(NOT_CONFIGURED_MESSAGE, 0)
  const { business, ...fetchInit } = init
  // An action with no data (such as confirming setup) still sends a JSON body, so every server accepts it.
  if (fetchInit.body === undefined && ['POST', 'PUT', 'PATCH'].includes(fetchInit.method ?? '')) fetchInit.body = '{}'
  const token = useAuth.getState().session?.token
  const appId = business ? currentAppId() : null
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...fetchInit,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(appId ? { 'X-App-Id': appId } : {}),
        ...fetchInit.headers,
      },
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0)
  }
  const body = await res.json().catch(() => ({}))
  // A 401 on a signed-in request means the session ended; a failed sign-in is also a 401 but has no token yet.
  // (changing the password can also answer 401 from an older server when the current password is wrong; that is a form error)
  if (res.status === 401 && token && !path.endsWith('/auth/change-password')) useAuth.getState().logout()
  if (!res.ok) throw new ApiError(body?.message ?? `Request failed (${res.status})`, res.status, body?.errors ?? {})
  return (body?.data ?? body) as T
}

const json = (body: unknown) => JSON.stringify(body)
const q = (appId: string | null) => (appId ? `?tenantId=${encodeURIComponent(appId)}` : '')

export const api = {
  login: (email: string, password: string) =>
    request<Session>('/api/admin/auth/login', { method: 'POST', body: json({ email, password }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<Session>('/api/admin/auth/change-password', { method: 'POST', body: json({ currentPassword, newPassword }) }),

  // platform (businesses and team)
  businesses: {
    list: () => request<Business[]>('/api/admin/tenants'),
    create: (input: NewBusinessInput) => request<CreatedBusiness>('/api/admin/tenants', { method: 'POST', body: json(input) }),
    setStatus: (appId: string, status: Business['status']) =>
      request<Business>(`/api/admin/tenants/${appId}/status`, { method: 'PATCH', body: json({ status }) }),
  },
  users: {
    list: (appId: string | null) => request<AdminUser[]>(`/api/admin/users${q(appId)}`),
    create: (input: NewUserInput) => request<CreatedUser>('/api/admin/users', { method: 'POST', body: json(input) }),
    setActive: (userId: string, active: boolean) =>
      request<AdminUser>(`/api/admin/users/${userId}/active`, { method: 'PATCH', body: json({ active }) }),
  },

  // one business's configuration (the X-App-Id header names the business)
  business: {
    overview: () => request<Overview>('/api/admin/business/overview', { business: true }),
    updateSettings: (input: Partial<Pick<Business, 'name' | 'appName' | 'brandColor' | 'logoUrl' | 'supportEmail' | 'supportPhone'>>) =>
      request<Business>('/api/admin/business/settings', { method: 'PUT', body: json(input), business: true }),
    setMarket: (market: Market) => request<Business>('/api/admin/business/market', { method: 'PUT', body: json(market), business: true }),
    completeSetup: () => request<SetupStatus>('/api/admin/business/setup/complete', { method: 'POST', business: true }),

    regions: () => request<Region[]>('/api/admin/business/regions', { business: true }),
    addRegions: (input: { state: string; cities: (string | { name: string; lat: number; lng: number })[]; zoneName: string; radiusKm: number | string }) =>
      request<{ created: Region[]; skipped: string[] }>('/api/admin/business/regions', { method: 'POST', body: json(input), business: true }),
    updateRegion: (id: string, input: { zoneName?: string; active?: boolean; center?: { lat: number | string; lng: number | string } | null; radiusKm?: number | string }) =>
      request<Region>(`/api/admin/business/regions/${id}`, { method: 'PATCH', body: json(input), business: true }),

    locate: (point: { lat: number | string; lng: number | string }) =>
      request<LocateResult>('/api/admin/business/regions/locate', { method: 'POST', body: json(point), business: true }),

    categories: () => request<Category[]>('/api/admin/business/categories', { business: true }),
    createCategory: (input: CategoryInput) =>
      request<Category>('/api/admin/business/categories', { method: 'POST', body: json(input), business: true }),
    updateCategory: (id: string, input: Partial<CategoryInput> & { active?: boolean }) =>
      request<Category>(`/api/admin/business/categories/${id}`, { method: 'PATCH', body: json(input), business: true }),

    fareRules: () => request<FareRule[]>('/api/admin/business/fare-rules', { business: true }),
    saveFareRule: (input: FareRuleFields & { categoryId: string; regionId: string | null }) =>
      request<FareRule>('/api/admin/business/fare-rules', { method: 'PUT', body: json(input), business: true }),
    deleteFareRule: (id: string) => request<{ id: string }>(`/api/admin/business/fare-rules/${id}`, { method: 'DELETE', business: true }),
    previewFare: (rule: FareRuleFields, trip: Record<string, number | string>) =>
      request<FarePreview>('/api/admin/business/fare-preview', { method: 'POST', body: json({ rule, trip }), business: true }),

    policies: () => request<CancellationPolicy[]>('/api/admin/business/cancellation-policies', { business: true }),
    savePolicy: (input: PolicyFields & { categoryId: string; regionId: string | null }) =>
      request<CancellationPolicy>('/api/admin/business/cancellation-policies', { method: 'PUT', body: json(input), business: true }),
    deletePolicy: (id: string) =>
      request<{ id: string }>(`/api/admin/business/cancellation-policies/${id}`, { method: 'DELETE', business: true }),
  },
}

// ---- drivers, vehicles, documents and verification ----


const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}
const biz = (path: string, init: RequestInit = {}) => request<never>(`/api/admin/business${path}`, { ...init, business: true }) as Promise<unknown>
const get = <T>(path: string) => biz(path) as Promise<T>
const send = <T>(method: string, path: string, body?: unknown) => biz(path, { method, body: body === undefined ? undefined : json(body) }) as Promise<T>

export type DocumentKind = 'drivers' | 'vehicles'

/**
 * Uploads one document (multipart) and reports progress. fetch cannot report upload progress, so this uses XMLHttpRequest;
 * it sends the same sign-in token and business header as every other request.
 */
export function uploadDocument(
  kind: DocumentKind,
  id: string,
  fields: { type: string; number?: string; expiryDate?: string },
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<{ document: unknown; verificationStatus: VerificationStatus }> {
  if (!API_CONFIGURED) return Promise.reject(new ApiError(NOT_CONFIGURED_MESSAGE, 0))
  const token = useAuth.getState().session?.token
  const appId = currentAppId()
  const form = new FormData()
  form.append('type', fields.type)
  if (fields.number) form.append('number', fields.number)
  if (fields.expiryDate) form.append('expiryDate', fields.expiryDate)
  form.append('file', file)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}/api/admin/business/${kind}/${id}/documents`)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    if (appId) xhr.setRequestHeader('X-App-Id', appId)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total) }
    xhr.onerror = () => reject(new ApiError('Cannot reach the server. Check your connection and try again.', 0))
    xhr.onload = () => {
      let body: { data?: never; message?: string; errors?: Record<string, string> } = {}
      try { body = JSON.parse(xhr.responseText) } catch { /* not JSON */ }
      if (xhr.status === 401 && token) useAuth.getState().logout()
      if (xhr.status >= 200 && xhr.status < 300) resolve(body.data as never)
      else reject(new ApiError(body.message ?? `Upload failed (${xhr.status})`, xhr.status, body.errors ?? {}))
    }
    xhr.send(form)
  })
}

export const platform = {
  overview: () => request<PlatformOverview>('/api/admin/platform/overview'),
}

export const ops = {
  audit: (params: Record<string, string | number | undefined>) => get<AuditPage>(`/audit${qs(params)}`),
  alerts: () => get<AlertsPayload>('/alerts'),
  stats: () => get<OpsStats>('/stats'),
  riders: {
    list: (params: Record<string, string | number | undefined>) => get<Paged<RiderItem>>(`/riders${qs(params)}`),
    get: (id: string) => get<RiderDetail>(`/riders/${id}`),
  },
  trips: {
    list: (params: Record<string, string | number | undefined>) => get<Paged<TripItem>>(`/trips${qs(params)}`),
    get: (id: string) => get<TripDetail>(`/trips/${id}`),
  },
}

export const fleet = {
  rideSettings: {
    get: () => get<RideSettings>('/ride-settings'),
    update: (input: Partial<RideSettings>) => send<RideSettings>('PUT', '/ride-settings', input),
  },
  availability: () => get<Availability>('/availability'),
  requirements: {
    get: () => get<{ driver: RequirementDef[]; vehicle: RequirementDef[] }>('/requirements'),
    update: (input: { driver?: Record<string, boolean>; vehicle?: Record<string, boolean> }) =>
      send<{ driver: RequirementDef[]; vehicle: RequirementDef[] }>('PUT', '/requirements', input),
  },
  drivers: {
    list: (params: Record<string, string | number | undefined>) => get<Paged<DriverListItem>>(`/drivers${qs(params)}`),
    get: (id: string) => get<DriverDetail>(`/drivers/${id}`),
    create: (input: DriverInput) => send<{ id: string }>('POST', '/drivers', input),
    update: (id: string, input: Partial<DriverInput>) => send<{ id: string }>('PATCH', `/drivers/${id}`, input),
    setStatus: (id: string, status: string, reason: string) => send<{ id: string }>('POST', `/drivers/${id}/status`, { status, reason }),
    history: (id: string) => get<HistoryEntry[]>(`/drivers/${id}/history`),
    documents: (id: string) => get<DocumentsPayload>(`/drivers/${id}/documents`),
    assignVehicle: (id: string, vehicleId: string, reassign: boolean) => send<{ assignmentId: string }>('POST', `/drivers/${id}/assign-vehicle`, { vehicleId, reassign }),
    unassignVehicle: (id: string, reason: string) => send<{ ok: boolean }>('POST', `/drivers/${id}/unassign-vehicle`, { reason }),
  },
  vehicles: {
    list: (params: Record<string, string | number | undefined>) => get<Paged<VehicleListItem>>(`/vehicles${qs(params)}`),
    get: (id: string) => get<VehicleDetail>(`/vehicles/${id}`),
    create: (input: VehicleInput) => send<{ id: string }>('POST', '/vehicles', input),
    update: (id: string, input: Partial<VehicleInput>) => send<{ id: string }>('PATCH', `/vehicles/${id}`, input),
    setStatus: (id: string, status: string, reason: string) => send<{ id: string }>('POST', `/vehicles/${id}/status`, { status, reason }),
    history: (id: string) => get<HistoryEntry[]>(`/vehicles/${id}/history`),
    documents: (id: string) => get<DocumentsPayload>(`/vehicles/${id}/documents`),
    assignDriver: (id: string, driverId: string, reassign: boolean) => send<{ assignmentId: string }>('POST', `/vehicles/${id}/assign-driver`, { driverId, reassign }),
    unassignDriver: (id: string, reason: string) => send<{ ok: boolean }>('POST', `/vehicles/${id}/unassign-driver`, { reason }),
  },
  documents: {
    link: (kind: DocumentKind, docId: string) =>
      get<{ url: string; expiresInSeconds: number; mime: string; fileName: string }>(`/${kind === 'drivers' ? 'driver' : 'vehicle'}-documents/${docId}/url`),
    review: (kind: DocumentKind, docId: string, decision: 'APPROVE' | 'REJECT', reason: string) =>
      send<{ documentStatus: string; verificationStatus: VerificationStatus }>('POST', `/${kind === 'drivers' ? 'driver' : 'vehicle'}-documents/${docId}/review`, { decision, reason }),
  },
}
