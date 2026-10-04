import type {
  AdminUser, Business, CancellationPolicy, Category, CategoryInput, CreatedBusiness, CreatedUser, FarePreview,
  FareRule, FareRuleFields, Market, NewBusinessInput, NewUserInput, Overview, PolicyFields, Region, Session, SetupStatus,
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
  if (res.status === 401 && token) useAuth.getState().logout()
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
    updateSettings: (input: Partial<Pick<Business, 'name' | 'appName' | 'brandColor' | 'supportEmail' | 'supportPhone'>>) =>
      request<Business>('/api/admin/business/settings', { method: 'PUT', body: json(input), business: true }),
    setMarket: (market: Market) => request<Business>('/api/admin/business/market', { method: 'PUT', body: json(market), business: true }),
    completeSetup: () => request<SetupStatus>('/api/admin/business/setup/complete', { method: 'POST', business: true }),

    regions: () => request<Region[]>('/api/admin/business/regions', { business: true }),
    addRegions: (input: { state: string; cities: string[]; zoneName: string }) =>
      request<{ created: Region[]; skipped: string[] }>('/api/admin/business/regions', { method: 'POST', body: json(input), business: true }),
    updateRegion: (id: string, input: { zoneName?: string; active?: boolean }) =>
      request<Region>(`/api/admin/business/regions/${id}`, { method: 'PATCH', body: json(input), business: true }),

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
