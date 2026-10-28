import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, fleet, ops } from '@/api'
import { useScope } from '@/lib/useScope'
import { loadGeo } from '@/lib/geo'
import { useToast } from '@/components/feedback'

/** Every business query is keyed by appId, so switching business never shows another business's cached data. */
export function useBusinessQuery<T>(name: string, fn: () => Promise<T>, enabled = true) {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, name], queryFn: fn, enabled: !!tenantId && enabled })
}

export const useOverview = () => useBusinessQuery('overview', api.business.overview)
export const useConfigHistory = (page: number) => { const { tenantId } = useScope(); return useQuery({ queryKey: ['biz', tenantId, 'config-history', page], queryFn: () => ops.configHistory.list(page), enabled: !!tenantId, placeholderData: keepPreviousData }) }
export const useConfigVersion = (version: number) => useBusinessQuery(`config-version:${version}`, () => ops.configHistory.get(version), !!version)
export const useChatSettings = () => useBusinessQuery('chat-settings', api.business.chatSettings)
export const useTollSettings = () => useBusinessQuery('toll-settings', api.business.tollSettings)
export const useAppVersions = () => useBusinessQuery('app-versions', api.business.appVersions)
export const useRegions = () => useBusinessQuery('regions', api.business.regions)
export const useCategories = () => useBusinessQuery('categories', api.business.categories)
export const useSurge = () => { const { tenantId } = useScope(); return useQuery({ queryKey: ['biz', tenantId, 'surge'], queryFn: api.business.surge, enabled: !!tenantId, refetchInterval: 30000 }) }
/** Emergencies, refreshed every 15 seconds: staff must see a new one soon after it is raised. */
export const useSos = (status: 'open' | 'resolved' | 'all' = 'open', enabled = true) => {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, `sos:${status}`], queryFn: () => api.business.sos(status), enabled: !!tenantId && enabled, refetchInterval: 15_000 })
}
export const useSetupDraft = () => useBusinessQuery('setup-draft', api.business.setupDraft)
export const usePricingDraft = () => useBusinessQuery('pricing-draft', api.business.pricingDraft)
export const usePricingSchedules = () => useBusinessQuery('pricing-schedules', api.business.pricingSchedules)
export const usePricingVersions = (page: number) => { const { tenantId } = useScope(); return useQuery({ queryKey: ['biz', tenantId, 'pricing-versions', page], queryFn: () => api.business.pricingVersions(page), enabled: !!tenantId, placeholderData: keepPreviousData }) }
export const usePricingVersion = (version: number) => useBusinessQuery(`pricing-version:${version}`, () => api.business.pricingVersion(version), !!version)
export const useFareRules = () => useBusinessQuery('fare-rules', api.business.fareRules)
export const usePolicyHistory = () => useBusinessQuery('policy-history', api.business.policyHistory)
export const usePolicies = () => useBusinessQuery('policies', api.business.policies)

/**
 * A save/delete action for the current business: toasts the outcome, refreshes that business's data, and exposes the
 * server's per-field messages so forms can show them next to the inputs.
 */
export function useBusinessMutation<TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
  options: { success?: string | ((r: TResult) => string); onSuccess?: (r: TResult) => void } = {},
) {
  const qc = useQueryClient()
  const toast = useToast()
  const { tenantId } = useScope()
  const mutation = useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ['biz', tenantId] })
      qc.invalidateQueries({ queryKey: ['businesses'] })
      const text = typeof options.success === 'function' ? options.success(result) : options.success
      if (text) toast.success(text)
      options.onSuccess?.(result)
    },
    onError: (e) => {
      // field-level problems are shown on the form; everything else is a toast
      if (!(e instanceof ApiError) || Object.keys(e.fieldErrors).length === 0) toast.error(e.message)
    },
  })
  const fieldErrors: Record<string, string> = mutation.error instanceof ApiError ? mutation.error.fieldErrors : {}
  return { ...mutation, fieldErrors }
}

/** Country and city options; loaded once, on demand. */
export const useGeo = () => useQuery({ queryKey: ['geo'], queryFn: loadGeo, staleTime: Infinity, gcTime: Infinity })

// ---- drivers and vehicles ----

type Params = Record<string, string | number | undefined>

/** A page of drivers from the server. The previous page stays visible while the next one loads. */
export function useDrivers(params: Params) {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, 'drivers', params], queryFn: () => fleet.drivers.list(params), enabled: !!tenantId, placeholderData: keepPreviousData })
}

export function useVehicles(params: Params, enabled = true) {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, 'vehicles', params], queryFn: () => fleet.vehicles.list(params), enabled: !!tenantId && enabled, placeholderData: keepPreviousData })
}

export const useDriver = (id: string) => useBusinessQuery(`driver:${id}`, () => fleet.drivers.get(id), !!id)
export const useDriverHistory = (id: string) => useBusinessQuery(`driver-history:${id}`, () => fleet.drivers.history(id), !!id)
export const useVehicle = (id: string) => useBusinessQuery(`vehicle:${id}`, () => fleet.vehicles.get(id), !!id)
export const useVehicleHistory = (id: string) => useBusinessQuery(`vehicle-history:${id}`, () => fleet.vehicles.history(id), !!id)
export const useRequirements = () => useBusinessQuery('requirements', fleet.requirements.get)

// ---- operations ----

export function useAudit(params: Params) {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, 'audit', params], queryFn: () => ops.audit(params), enabled: !!tenantId, placeholderData: keepPreviousData })
}
/** Alerts are worked out on the server from the live records; they are re-read every minute while a screen shows them. */
export const useAlerts = (enabled = true) => {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, 'alerts'], queryFn: ops.alerts, enabled: !!tenantId && enabled, refetchInterval: 60000 })
}
/** The live map, re-read at the interval the server asks for (the drivers' heartbeat rate) while the page is visible. */
export const useLiveMap = () => {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, 'live-map'], queryFn: ops.liveMap, enabled: !!tenantId, refetchInterval: (q) => (q.state.data?.refreshSeconds ?? 10) * 1000, placeholderData: keepPreviousData })
}
export function useReport(params: Params, enabled = true) {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, 'report', params], queryFn: () => ops.report(params), enabled: !!tenantId && enabled, placeholderData: keepPreviousData })
}
export function useIssues(params: Params) {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, 'issues', params], queryFn: () => ops.support.list(params), enabled: !!tenantId, placeholderData: keepPreviousData, refetchInterval: 60000 })
}
export function usePayouts(params: Params) {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, 'payouts', params], queryFn: () => ops.payouts.list(params), enabled: !!tenantId, placeholderData: keepPreviousData, refetchInterval: 60000 })
}
export const usePayout = (id: string, enabled = true) => useBusinessQuery(`payout:${id}`, () => ops.payouts.get(id), !!id && enabled)
// ---- Commission and Collections ----
export function usePayments(params: Params, enabled = true) {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, 'payments', params], queryFn: () => ops.payments.list(params), enabled: !!tenantId && enabled, placeholderData: keepPreviousData, refetchInterval: 60000 })
}
export const usePayment = (id: string, enabled = true) => useBusinessQuery(`payment:${id}`, () => ops.payments.get(id), !!id && enabled)
export const useCommission = (enabled = true) => useBusinessQuery('commission', ops.payments.commission, enabled)
export const useFindings = (status: 'open' | 'resolved' | '', enabled = true) => useBusinessQuery(`findings:${status}`, () => ops.payments.reconciliation(status), enabled)
export const usePaymentSettings = (enabled = true) => useBusinessQuery('payment-settings', ops.payments.settings, enabled)
export const useWeatherPricing = () => useBusinessQuery('weather-pricing', ops.payments.weather)
export const useLegal = () => useBusinessQuery('legal', ops.legal.overview)
export const useLegalAcceptances = () => useBusinessQuery('legal-acceptances', ops.legal.acceptances)
export function useLegalVersions(type: string, params: Params) {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, 'legal-versions', type, params], queryFn: () => ops.legal.versions(type, params), enabled: !!tenantId })
}
export function useCoupons(params: Params) {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, 'coupons', params], queryFn: () => ops.coupons.list(params), enabled: !!tenantId, placeholderData: keepPreviousData })
}
export function useCouponRedemptions(id: string, params: Params) {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, 'coupon-uses', id, params], queryFn: () => ops.coupons.uses(id, params), enabled: !!tenantId && !!id, placeholderData: keepPreviousData })
}
export const useIncentives = () => useBusinessQuery('incentives', ops.incentives.list)
export const useAdjustments = (params: Params) => { const { tenantId } = useScope(); return useQuery({ queryKey: ['biz', tenantId, 'adjustments', params], queryFn: () => ops.adjustments.list(params), enabled: !!tenantId }) }
export const usePayoutSettings = () => useBusinessQuery('payout-settings', ops.payouts.settings)
export const useIssue = (id: string) => useBusinessQuery(`issue:${id}`, () => ops.support.get(id), !!id)
export const useOpsStats = (enabled = true) => {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, 'stats'], queryFn: ops.stats, enabled: !!tenantId && enabled, refetchInterval: 30000 })
}
export function useRiders(params: Params) {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, 'riders', params], queryFn: () => ops.riders.list(params), enabled: !!tenantId, placeholderData: keepPreviousData })
}
export const useRider = (id: string) => useBusinessQuery(`rider:${id}`, () => ops.riders.get(id), !!id)
export function useTrips(params: Params) {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, 'trips', params], queryFn: () => ops.trips.list(params), enabled: !!tenantId, placeholderData: keepPreviousData, refetchInterval: 30000 })
}
export const useTripChat = (id: string) => useBusinessQuery(`trip-chat:${id}`, () => ops.trips.chat(id), !!id)
export const useTrip = (id: string) => useBusinessQuery(`trip:${id}`, () => ops.trips.get(id), !!id)
