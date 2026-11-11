import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { sessionQueryOptions, useSession } from '@/features/auth/queries'
import { getGuestCartId } from '@/shared/api/session-storage'
import type { Session } from '@/shared/contracts'

export type CartScope = { kind: 'user'; userId: string } | { kind: 'guest'; guestId: string }

export function cartScopeFor(session: Session | null): CartScope {
  return session ? { kind: 'user', userId: session.user.id } : { kind: 'guest', guestId: getGuestCartId() }
}

/** `['user', id, 'cart']` for a signed-in user, `['guest-cart', guestId]` for a visitor. */
export function cartQueryKey(scope: CartScope) {
  return scope.kind === 'user' ? queryKeys.user(scope.userId).cart() : queryKeys.guestCart(scope.guestId)
}

/** Id that scopes quotes to the same cart owner. */
export function cartScopeId(scope: CartScope): string {
  return scope.kind === 'user' ? `user:${scope.userId}` : `guest:${scope.guestId}`
}

/** Whose cart the UI shows: the signed-in user's, else the visitor's (guest id from localStorage). */
export function useCartScope(): CartScope {
  const session = useSession()
  return cartScopeFor(session)
}

/**
 * True once the stored session was checked by the API (or there is none). Cart requests wait for it, so a
 * stale token never reaches the cart API before the session check/guard decide what an expiry means.
 */
export function useSessionVerified(): boolean {
  return useQuery({ ...sessionQueryOptions(), select: () => true }).isSuccess
}
