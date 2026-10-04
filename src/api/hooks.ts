import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/api'
import { useScope } from '@/lib/useScope'
import { loadGeo } from '@/lib/geo'
import { useToast } from '@/components/feedback'

/** Every business query is keyed by appId, so switching business never shows another business's cached data. */
export function useBusinessQuery<T>(name: string, fn: () => Promise<T>) {
  const { tenantId } = useScope()
  return useQuery({ queryKey: ['biz', tenantId, name], queryFn: fn, enabled: !!tenantId })
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
