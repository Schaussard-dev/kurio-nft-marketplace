import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/app/query-client'
import { useSession } from '@/features/auth/queries'
import { clearCheckoutDraft } from '@/features/checkout/draft'
import { isCartQueryKey } from '@/features/realtime/apply-nft-update'
import { useRealtimeEvent } from '@/features/realtime/realtime-hub'
import { useSocketStatus } from '@/features/realtime/use-socket-status'
import { sessionStore } from '@/shared/api/session-storage'
import { orderUpdatedDataSchema, type Order } from '@/shared/contracts'
import { clearAttempt, peekAttempt } from '@/shared/lib/idempotency'
import { fetchOrder } from './api'
import { forgetPendingOrder } from './pending-order'

/** While the socket is not connected, a pending order is polled this often (fallback for `order.updated`). */
export const ORDER_POLL_MS = 5000

export const isTerminal = (order: Pick<Order, 'status'>) => order.status !== 'pending'

/** What is said when an order reaches its outcome (live region / toast). */
export function orderOutcomeText(order: Order): string {
  if (order.status === 'confirmed') return 'Pedido confirmado. Seus NFTs agora estão na sua carteira.'
  return `Pagamento recusado. ${order.declineReason ?? ''}`.trim()
}

export const orderPath = (orderId: string) => `/pedidos/${orderId}`

export function orderQueryOptions(userId: string, orderId: string) {
  return queryOptions({
    queryKey: queryKeys.user(userId).order(orderId),
    queryFn: ({ signal }) => fetchOrder(orderId, signal),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
}

/**
 * An order of the signed-in user. `order.updated` keeps it current; while the socket is down a pending
 * order is re-read every 5 s instead (GET also resolves it when due), so it never waits for a reconnect.
 */
export function useOrder(orderId: string | null) {
  const session = useSession()
  const socket = useSocketStatus()
  const userId = session?.user.id ?? ''
  return useQuery({
    ...orderQueryOptions(userId, orderId ?? ''),
    enabled: Boolean(session && orderId),
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' && socket !== 'connected' ? ORDER_POLL_MS : false,
  })
}

/**
 * Everything the client keeps about a purchase in flight is over once the order is terminal. Returns
 * whether the unresolved checkout attempt was the one that created this order.
 */
export function settleTerminalOrder(userId: string, order: Order): boolean {
  forgetPendingOrder(userId, order.id)
  // Only the attempt that created THIS order: another unresolved attempt must keep its key (no duplicates).
  if (peekAttempt(userId)?.key !== order.idempotencyKey) return false
  clearAttempt(userId)
  clearCheckoutDraft(userId)
  return true
}

/** The checkout page reports the outcome of its own unresolved attempt itself (one feedback only). */
const CHECKOUT_PATH = '/pagamento'

/**
 * `order.updated` (already deduped, versioned and scoped to the session user by the hub): stores the
 * order, refreshes what its outcome changed (cart, stock, quotes) and settles a terminal order. The
 * order page speaks the outcome itself, and so does the checkout for its own unresolved attempt;
 * anywhere else a toast does (sonner's live region). Mounted by the RealtimeProvider.
 */
export function useOrderUpdates(): void {
  const queryClient = useQueryClient()
  useRealtimeEvent('order.updated', (envelope) => {
    const parsed = orderUpdatedDataSchema.safeParse(envelope.data)
    const userId = sessionStore.get()?.user.id
    if (!parsed.success || !userId || envelope.userId !== userId) return
    const { order } = parsed.data
    const key = queryKeys.user(userId).order(order.id)
    const cached = queryClient.getQueryData<Order>(key)
    if (!cached || cached.version < order.version) {
      void queryClient.cancelQueries({ queryKey: key, exact: true })
      queryClient.setQueryData(key, order)
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.user(userId).pendingOrders() })
    void queryClient.invalidateQueries({ predicate: ({ queryKey }) => isCartQueryKey(queryKey) })
    void queryClient.invalidateQueries({ queryKey: ['quote'] })
    void queryClient.invalidateQueries({ queryKey: ['nft'] })
    void queryClient.invalidateQueries({ queryKey: ['nfts'] })
    if (!isTerminal(order)) return
    const ownAttempt = settleTerminalOrder(userId, order)
    const path = window.location.pathname
    if (ownAttempt && path === CHECKOUT_PATH) return
    if (path !== orderPath(order.id)) toast(orderOutcomeText(order))
  })
}
