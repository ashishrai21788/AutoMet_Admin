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
  /** The area the region covers: every point within radiusKm of the centre. Null until set. */
  center: { lat: number; lng: number } | null
  radiusKm: number | null
  createdAt: string
  updatedAt: string
}

export interface LocateResult {
  serviceAreasSet: boolean
  inside: boolean
  region: Region | null
  distanceKm: number | null
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

// ---- drivers, vehicles, documents and verification ----

export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
export type VerificationStatus = 'INCOMPLETE' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
export type DocumentStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED'

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface VehicleBrief {
  id: string
  registrationNumber: string
  make: string
  model: string
  categoryId: string
  status: AccountStatus
}

export interface DriverListItem {
  id: string
  name: string
  phone: string
  photoUrl: string | null
  vehicle: VehicleBrief | null
  operatingRegionId: string | null
  eligibleCategoryId: string | null
  verificationStatus: VerificationStatus
  accountStatus: AccountStatus
  eligible: boolean
  registeredAt: string
}

export interface Eligibility {
  eligible: boolean
  reasons: { code: string; message: string }[]
}

export interface DriverDetail {
  id: string
  name: string
  fullName: string
  phone: string
  email: string | null
  dateOfBirth: string | null
  address: { country?: string; state?: string; city?: string; line?: string } | null
  photoUrl: string | null
  operatingRegionId: string | null
  eligibleCategoryId: string | null
  eligibleCategoryName: string | null
  accountStatus: AccountStatus
  verificationStatus: VerificationStatus
  verification: { missing: string[]; rejected: string[]; expired: string[]; pending: string[] }
  eligibility: Eligibility
  vehicle: VehicleBrief | null
  assignedAt: string | null
  activity: { registeredAt: string; createdByAdmin: boolean; phoneVerified: boolean; lastActiveAt: string | null; signedInOnApp: boolean }
  appReportedVehicle: { registrationNumber: string; model: string | null; type: string | null; colour: string | null } | null
  canViewDocuments: boolean
  createdAt: string
}

export interface DriverInput {
  fullName: string
  phone: string
  email: string
  dateOfBirth: string
  address: { country: string; state: string; city: string; line: string }
  operatingRegionId: string
  eligibleCategoryId: string
}

export interface VehicleListItem {
  id: string
  registrationNumber: string
  make: string
  model: string
  year: number | null
  colour: string
  categoryId: string
  categoryName: string | null
  driver: { id: string; name: string; phone: string; accountStatus: AccountStatus } | null
  operatingRegionId: string | null
  regionName: string | null
  status: AccountStatus
  verificationStatus: VerificationStatus
  createdAt: string
}

export interface VehicleDetail extends VehicleListItem {
  verification: { missing: string[]; rejected: string[]; expired: string[]; pending: string[] }
  passengerCapacity: number
  luggageCapacity: number | null
  assignedAt: string | null
  operational: boolean
  canViewDocuments: boolean
}

export interface VehicleInput {
  registrationNumber: string
  make: string
  model: string
  year: string
  colour: string
  categoryId: string
  passengerCapacity: string
  luggageCapacity: string
  operatingRegionId: string
  status: AccountStatus
}

export interface DocumentInfo {
  id: string
  type: string
  number: string
  expiryDate: string | null
  status: DocumentStatus
  effectiveStatus: DocumentStatus | 'EXPIRED'
  rejectionReason: string
  submittedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  version: number
  mime: string | null
  fileName: string | null
  viewable: boolean
}

export interface DocumentRequirement {
  type: string
  label: string
  mandatory: boolean
  needsNumber: boolean
  needsExpiry: boolean
  photo: boolean
  document: DocumentInfo | null
}

export interface DocumentsPayload {
  verificationStatus: VerificationStatus
  verification: { missing: string[]; rejected: string[]; expired: string[]; pending: string[] }
  canView: boolean
  canReview: boolean
  requirements: DocumentRequirement[]
}

export interface HistoryEntry {
  id: string
  kind: string
  action: string
  from: string | null
  to: string | null
  detail: string
  reason: string
  actor: string | null
  at: string
}

export interface RequirementDef {
  type: string
  label: string
  mandatory: boolean
  needsNumber: boolean
  needsExpiry: boolean
  locked?: boolean
  photo?: boolean
}
