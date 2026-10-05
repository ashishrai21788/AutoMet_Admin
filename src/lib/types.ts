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
  /** https link to the logo shown in the business's apps; empty when none. */
  logoUrl: string
  supportEmail: string
  supportPhone: string
  market: Market | null
  createdAt: string
  isDefault?: boolean
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
  /** Authenticator-app sign-in is on for this account. */
  twoFactorEnabled?: boolean
  /** The platform owner must turn it on before the dashboard opens. */
  twoFactorSetupRequired?: boolean
  /** false once an admin has deactivated the account. */
  active?: boolean
}

export interface Session {
  token: string
  user: AdminUser
}

/** The password was right but the account needs its two-step code before a session is given. */
export interface TwoFactorChallenge { twoFactorRequired: true; challenge: string }

export interface TwoFactorSetup { secret: string; otpauthUri: string }

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

export interface DriverListItem extends PresenceFields {
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

export interface DriverDetail extends PresenceFields {
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

// ---- ride settings and driver availability ----

export interface RideSettings {
  requireEligibleDrivers: boolean
}

export interface Availability {
  totalDrivers: number
  activeAccounts: number
  eligible: number
  notEligible: number
  online: number
  onlineEligible: number
  onlineNotEligible: number
  /** for active drivers: why each would be blocked once eligibility is required (reason code -> drivers) */
  blockedBy: Record<string, number>
  truncated: boolean
  settings: RideSettings
}

// ---- operations: audit log, alerts, statistics, riders, trips ----

export interface AuditEntry {
  id: string
  at: string
  action: string
  actorEmail: string | null
  targetType: string | null
  targetId: string | null
  details: Record<string, string> | null
}

export interface AuditPage extends Paged<AuditEntry> {
  facets: { actions: string[]; targetTypes: string[]; actors: string[] }
}

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface AlertItem {
  kind: 'driver' | 'vehicle' | 'category' | 'region'
  id: string
  label: string
  detail?: string
}

export interface OpsAlert {
  id: string
  severity: AlertSeverity
  type: string
  title: string
  detail: string
  count: number
  items: AlertItem[]
  more: number
  link: string
}

export interface AlertsPayload {
  alerts: OpsAlert[]
  counts: Record<AlertSeverity, number>
  generatedAt: string
}

export interface OpsStats {
  drivers: { total: number; activeAccounts: number; eligible: number; online: number; onlineEligible: number; onlineNotEligible: number; onlineLive: number; onlineStale: number; onlineNoSignal: number; partial: boolean }
  trips: {
    active: number; searching: number; requestedToday: number; completedToday: number; cancelledToday: number
    acceptanceRate: number; cancellationRate: number; partial: boolean
    last7Days: { date: string; requested: number; completed: number; cancelled: number }[]
  }
  revenue: { today: number; currency: string | null; basis: string; partial: boolean }
  riders: { total: number; newThisWeek: number }
  notAvailable: string[]
}

export type TripStatusGroup = 'searching' | 'active' | 'completed' | 'cancelled' | 'unanswered' | 'other'

export interface TripItem {
  id: string
  requestedAt: string
  status: string
  statusGroup: TripStatusGroup
  rider: { id: string; name: string | null; phone: string | null }
  driver: { id: string; name: string | null }
  pickup: string
  drop: string
  fare: number | null
  currency: string | null
  fareBasis: 'ESTIMATE' | 'ACTUAL' | null
  paymentMode: string | null
  distanceKm: number | null
  regionId: string | null
  categoryId: string | null
  cancelledBy: 'USER' | 'DRIVER' | 'ADMIN' | null
}

export interface TripDetail extends TripItem {
  pickupPoint: { lat: number; lng: number } | null
  dropPoint: { lat: number; lng: number } | null
  region: { id: string; name: string } | null
  category: { id: string; name: string } | null
  note: string
  fareDetail: { amount: number | null; currency: string | null; basis: string | null; source: string | null; breakdown: unknown; estimatedDurationMin: number | null }
  cancellation: { by: string | null; stage: string | null; reason: string; at: string | null } | null
  rejectReason: string
  timeline: { label: string; at: string }[]
  events: { event: string; at: string }[]
  payment: { status: string | null; available: boolean }
  rating: null
}

export interface RiderItem {
  id: string
  name: string
  phone: string
  email: string
  phoneVerified: boolean
  accountStatus: string
  suspendedAt: string | null
  suspendedReason: string | null
  registeredAt: string | null
  lastActiveAt: string | null
  trips: { total: number; completed: number; cancelled: number }
}

export interface RiderDetail extends RiderItem {
  recentTrips: TripItem[]
}

// ---- platform overview (super admin) ----

export interface PlatformBusiness {
  appId: string
  name: string
  appName: string
  status: 'active' | 'trial' | 'suspended'
  plan: string
  isDefault: boolean
  createdAt: string
  drivers: { total: number; online: number; suspended: number }
  riders: { total: number; newThisWeek: number }
  admins: number
  trips: { requestedToday: number; active: number; searching: number; last7Days: number }
  setup: { percent: number; complete: boolean; nextStep: string | null }
}

export interface PlatformOverview {
  totals: {
    businesses: number; active: number; trial: number; suspended: number; setupComplete: number
    drivers: number; driversOnline: number; riders: number; tripsToday: number; activeTrips: number; tripsLast7Days: number
  }
  businesses: PlatformBusiness[]
  integrations: {
    database: { configured: boolean; connected: boolean }
    documentStorage: { provider: string | null; configured: boolean }
    pushNotifications: { provider: string | null; configured: boolean }
    adminSecurity: { configured: boolean }
    otpDelivery: { provider: string | null; configured: boolean }
    payments: { provider: string | null; configured: boolean }
  }
  partial: boolean
  generatedAt: string
}

// ---- driver presence and the live map ----

export type Presence = 'LIVE' | 'STALE' | 'NO_SIGNAL' | 'OFFLINE'

export interface PresenceFields {
  online: boolean
  presence: Presence
  locationAgeSeconds: number | null
  lastLocationAt: string | null
  lastSeenAt: string | null
  position: { lat: number; lng: number } | null
  wentOfflineReason: string | null
  currentTripId: string | null
}

export interface LiveDriver {
  id: string
  name: string
  phone: string | null
  lat: number
  lng: number
  heading: number | null
  speedKph: number | null
  presence: 'LIVE' | 'STALE'
  ageSeconds: number | null
  updatedAt: string
  eligible: boolean
  eligibilityReasons: string[]
  accountStatus: AccountStatus
  categoryId: string | null
  regionId: string | null
  regionName: string | null
  vehicle: { plate: string; label: string } | null
  currentTripId: string | null
}

export interface LiveTrip {
  id: string
  status: string
  statusGroup: TripStatusGroup
  requestedAt: string
  driverId: string
  riderId: string
  pickup: { address: string; lat: number; lng: number } | null
  drop: { address: string; lat: number; lng: number } | null
  fare: number | null
  currency: string | null
}

export interface LiveMapData {
  generatedAt: string
  freshSeconds: number
  staleOfflineSeconds: number
  refreshSeconds: number
  drivers: LiveDriver[]
  trips: LiveTrip[]
  regions: { id: string; name: string; center: { lat: number; lng: number }; radiusKm: number }[]
  counts: { live: number; stale: number; noSignal: number; eligibleLive: number; online: number; activeTrips: number; searching: number }
  partial: boolean
}

// ---- reports ----

export interface ReportGroupRow { id: string; name: string; requested: number; completed: number; cancelled: number; unanswered: number; fares: number }

export interface ReportData {
  range: { from: string; to: string; timezone: string }
  fromDay: string
  toDay: string
  currency: string | null
  partial: boolean
  rowLimit: number
  rides: {
    requested: number; completed: number; cancelled: number; noDriver: number; stillOpen: number
    completionRate: number; cancellationRate: number; noDriverRate: number
    cancelledByRiders: number; cancelledByDrivers: number
    avgResponseMinutes: number | null; avgTripMinutes: number | null; avgDistanceKm: number | null; avgFare: number | null
  }
  finance: {
    grossFares: number; bookingFees: number; taxes: number; completedTrips: number; estimatedFares: number; basis: string
    byPaymentMode: { mode: string; trips: number; fares: number }[]
    unavailable: string[]
  }
  byDay: { date: string; requested: number; completed: number; cancelled: number; unanswered: number; fares: number }[]
  byCategory: ReportGroupRow[]
  byRegion: ReportGroupRow[]
  drivers: { id: string; name: string; offered: number; accepted: number; declined: number; noResponse: number; completed: number; cancelled: number; fares: number; acceptanceRate: number }[]
}

// ---- support inbox (problems drivers report from the driver app) ----

export type IssueStatus = 'issue submitted' | 'under process' | 'complete'

export interface IssueItem {
  id: string
  /** who reported it: a driver from the driver app, or a rider from the rider app */
  reporterType: 'driver' | 'rider'
  reporterId: string
  tripId: string | null
  driverId: string | null
  driverName: string
  driverPhone: string | null
  text: string
  imageCount: number
  status: IssueStatus
  statusLabel: string
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  noteCount: number
}

export interface IssueDetail extends IssueItem {
  imageUrls: string[]
  notes: { at: string; by: string; text: string; status: IssueStatus | null }[]
}

export interface IssuePage extends Paged<IssueItem> { open: number }

export interface PlatformAuditEntry extends AuditEntry { tenantId: string | null; businessName: string }
export type PlatformAuditPage = Paged<PlatformAuditEntry>

// ---- platform revenue: what businesses pay AutoMet (never a business's own ride money) ----

export type InvoiceStatus = 'issued' | 'paid' | 'void'
export type InvoiceType = 'subscription' | 'setup_fee' | 'other'
export type PaymentMethod = 'bank_transfer' | 'upi' | 'card' | 'cash' | 'other'
export type SubscriptionStatus = 'trialing' | 'active' | 'cancelled'
export type Cycle = 'monthly' | 'yearly'

export interface Refund { at: string; amount: number; reason: string; by: string }

export interface Invoice {
  id: string
  number: string
  appId: string
  businessName: string
  type: InvoiceType
  description: string
  periodStart: string | null
  periodEnd: string | null
  amount: number
  currency: string
  status: InvoiceStatus
  overdue: boolean
  issuedAt: string
  dueDate: string
  paidAt: string | null
  paymentMethod: PaymentMethod | null
  reference: string
  refundedAmount: number
  refunds: Refund[]
  netPaid: number
  voidedAt: string | null
  voidReason: string
}

export interface Plan {
  id: string
  name: string
  description: string
  price: number
  cycle: Cycle
  setupFee: number
  trialDays: number | null
  active: boolean
  currency: string
  subscribers: number
}

export interface PlanInput { name: string; description?: string; price: number | string; cycle: Cycle; setupFee?: number | string; trialDays?: number | string | null; active?: boolean }

export interface Subscription {
  planId: string | null
  planName: string | null
  price: number
  cycle: Cycle
  currency: string
  setupFee: number
  status: SubscriptionStatus
  startDate: string | null
  trialEndsAt: string | null
  renewalDate: string | null
  cancelledAt: string | null
  cancelReason: string
  notes: string
  /** counts toward monthly recurring revenue */
  recurring: boolean
}

export interface BusinessBilling {
  subscription: Subscription | null
  businessStatus: Business['status']
  totals: { billed: number; collected: number; refunded: number; outstanding: number }
  invoices: Invoice[]
}

export interface AssignSubscriptionInput { planId: string; price?: number | string; startDate?: string; trial?: boolean; trialDays?: number | string; notes?: string; issueSetupInvoice?: boolean }

export interface PlatformSettings { companyName: string; billingEmail: string; invoiceDueDays: number; defaultTrialDays: number; invoiceNotes: string; currency: string }

export interface RevenueSummary {
  currency: string
  mrr: number
  arr: number
  billed: number
  collected: number
  refunded: number
  netCollected: number
  outstanding: number
  overdue: number
  counts: {
    businesses: number; suspended: number; activeSubscriptions: number; trialing: number; cancelled: number; withoutSubscription: number
    recurring: number; renewalsDue: number; renewalsOverdue: number; overdueInvoices: number; outstandingInvoices: number
  }
  upcomingRenewals: { appId: string; name: string; renewalDate: string; status: SubscriptionStatus; planName: string | null; price: number; cycle: Cycle }[]
  byPlan: { planId: string; name: string; price: number; cycle: Cycle; active: boolean; subscribers: number; mrr: number }[]
  byBusiness: {
    appId: string; name: string; status: Business['status']; subscriptionStatus: SubscriptionStatus | 'none'; planName: string | null
    price: number | null; cycle: Cycle | null; mrr: number; renewalDate: string | null
    billed: number; collected: number; refunded: number; outstanding: number; overdue: number
  }[]
  series: { month: string; billed: number; collected: number; refunded: number; net: number }[]
  acquisition: { month: string; newBusinesses: number }[]
  range: { from: string; to: string }
  generatedAt: string
  partial: boolean
}
