import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { useSession } from '@/features/auth/queries'
import { toApiError } from '@/shared/api/api-error'
import type { CreateOrderInput } from '@/shared/contracts'
import { createOrder } from './api'

export interface CreateOrderVariables {
  input: CreateOrderInput
  idempotencyKey: string
}

/** Timeout, network failure or 5xx: the order may or may not exist, so only a same-key resend is safe. */
export function isUncertainOrderError(error: unknown): boolean {
  return toApiError(error).isTransient
}

/**
 * POST /orders. Mutations never retry (spec §8) except this one: after an uncertain failure it resends
 * once, automatically, with the same variables, hence the same Idempotency-Key.
 */
export function useCreateOrder() {
  const queryClient = useQueryClient()
  const userId = useSession()?.user.id ?? ''
  return useMutation({
    mutationKey: ['create-order'],
    mutationFn: ({ input, idempotencyKey }: CreateOrderVariables) => createOrder(input, idempotencyKey),
    retry: (failureCount, error) => failureCount < 1 && isUncertainOrderError(error),
    retryDelay: 0,
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.user(userId).order(order.id), order)
      void queryClient.invalidateQueries({ queryKey: queryKeys.user(userId).pendingOrders() })
    },
  })
}
