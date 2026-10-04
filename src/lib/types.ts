export type Role = 'super_admin' | 'client_admin' | 'operations' | 'support' | 'finance'

export interface Market {
  country: string // ISO 3166-1 alpha-2
  currency: string // ISO 4217
  timezone: string // IANA
}

/** A business (tenant). `appId` is assigned once by the server and never changes. */
export interface Business {
  id: string
  appId: string
  name: string
  slug: string
  appName: string
  packageName: string
  city: string
  plan: 'trial' | 'standard' | 'enterprise'
  status: 'active' | 'trial' | 'suspended'
  brandColor: string
  supportEmail: string
  supportPhone: string
  market: Market | null
  createdAt: string
  /** Only on the platform list. */
  setup?: { percent: number; complete: boolean; nextStep: string | null }
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: Role
  /** null for super admins (they belong to the platform, not a business). */
  tenantId: string | null
  /** Set for accounts created with a temporary password; the dashboard asks for a new one. */
  mustChangePassword?: boolean
  /** false once an admin has deactivated the account. */
  active?: boolean
}

export interface Session {
  token: string
  user: AdminUser
}

export interface NewBusinessInput {
  name: string
  appName: string
  packageName: string
  city: string
  plan: Business['plan']
  brandColor: string
  adminName: string
  adminEmail: string
}

export interface CreatedBusiness extends Business {
  /** Shown once, right after the business is created. */
  initialAdmin: { email: string; temporaryPassword: string }
}

export interface NewUserInput {
  name: string
  email: string
  role: Exclude<Role, 'super_admin'>
  /** Super admin only: which business the user joins. Business admins always add to their own business. */
  tenantId?: string
}

export interface CreatedUser extends AdminUser {
  temporaryPassword: string
}

// ---- business configuration ----

export interface Region {
  id: string
  country: string
  state: string
  city: string
  zoneName: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export const ICON_KEYS = ['car', 'suv', 'hatchback', 'premium', 'auto', 'bike', 'electric', 'van'] as const
export type IconKey = (typeof ICON_KEYS)[number]

export const RIDE_TYPES = [
  { value: 'economy', label: 'Economy' },
  { value: 'comfort', label: 'Comfort' },
  { value: 'premium', label: 'Premium' },
  { value: 'shared', label: 'Shared' },
  { value: 'two_wheeler', label: 'Two-wheeler' },
  { value: 'three_wheeler', label: 'Three-wheeler' },
  { value: 'van', label: 'Van / large group' },
] as const

export interface Category {
  id: string
  name: string
  description: string
  icon: IconKey
  imageUrl: string
  passengerCapacity: number
  luggageCapacity: number | null
  rideType: string
  regionIds: string[]
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CategoryInput {
  name: string
  description: string
  icon: IconKey
  imageUrl: string
  passengerCapacity: number | string
  luggageCapacity: number | string | null
  rideType: string
  regionIds: string[]
}

export interface AdditionalCharge { name: string; type: 'fixed' | 'percent_of_fare'; amount: number | string }
export interface TaxLine { name: string; ratePercent: number | string; appliesTo: 'fare' | 'fare_and_fees' }

export interface FareRuleFields {
  baseFare: number | string
  perKm: number | string
  perMinute: number | string
  minimumFare: number | string
  bookingFee: number | string
  waitingFreeMinutes: number | string
  waitingPerMinute: number | string
  additionalCharges: AdditionalCharge[]
  taxes: TaxLine[]
  surge: { enabled: boolean; maxMultiplier: number | string }
}

export interface FareRule extends FareRuleFields {
  id: string
  categoryId: string
  regionId: string | null
  currency: string
  active: boolean
  updatedAt: string
}

export interface PolicyFields {
  rider: { freeCancellationMinutes: number | string; feeAfterWindow: number | string; feeAfterDriverArrived: number | string; noShowFee: number | string }
  driver: { penaltyFee: number | string; graceCancellations: number | string }
  conditions: string
}

export interface CancellationPolicy extends PolicyFields {
  id: string
  categoryId: string
  regionId: string | null
  currency: string
}

export interface FareLine { key: string; label: string; amount: number }
export interface FarePreview {
  currency: string
  multiplier: number
  lines: FareLine[]
  fare: number
  fees: FareLine[]
  feesTotal: number
  taxes: FareLine[]
  taxesTotal: number
  discount: number
  total: number
}

export interface SetupStep { key: 'regions' | 'categories' | 'pricing' | 'confirm'; title: string; path: string; done: boolean }
export interface SetupStatus {
  steps: SetupStep[]
  nextStep: SetupStep | null
  percent: number
  ready: boolean
  complete: boolean
  warnings: { code: string; message: string; path: string }[]
}

export interface Overview {
  business: Business
  setup: SetupStatus
  counts: {
    regions: number
    activeRegions: number
    categories: number
    activeCategories: number
    fareRules: number
    pricedCategories: number
  }
}
