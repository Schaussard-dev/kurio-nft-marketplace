import { QueryClient } from '@tanstack/react-query'
import { toApiError } from '@/shared/api/api-error'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, err) => toApiError(err).isTransient && count < 2,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
        staleTime: 30_000,
        gcTime: 300_000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  })
}

// Every key is an `as const` tuple. `queryKeys.users` (['user']) and
// `queryKeys.user(id).all` (['user', id]) are prefixes of all per-user keys.
export const queryKeys = {
  nfts: (params: unknown) => ['nfts', params] as const,
  nft: (id: string) => ['nft', id] as const,
  session: () => ['session'] as const,
  users: ['user'] as const,
  user: (userId: string) =>
    ({
      all: ['user', userId] as const,
      cart: () => ['user', userId, 'cart'] as const,
      favorites: () => ['user', userId, 'favorites'] as const,
      profile: () => ['user', userId, 'profile'] as const,
      wallets: () => ['user', userId, 'wallets'] as const,
      order: (orderId: string) => ['user', userId, 'order', orderId] as const,
      pendingOrders: () => ['user', userId, 'pending-orders'] as const,
    }) as const,
  guestCart: (guestId: string) => ['guest-cart', guestId] as const,
  quote: (scopeId: string, input: unknown) => ['quote', scopeId, input] as const,
}
