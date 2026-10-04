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
export const useRegions = () => useBusinessQuery('regions', api.business.regions)
export const useCategories = () => useBusinessQuery('categories', api.business.categories)
export const useFareRules = () => useBusinessQuery('fare-rules', api.business.fareRules)
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
export const useTrip = (id: string) => useBusinessQuery(`trip:${id}`, () => ops.trips.get(id), !!id)
