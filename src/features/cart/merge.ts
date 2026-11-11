import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/app/query-client'
import { peekGuestCartId, resetGuestCartId } from '@/shared/api/session-storage'
import type { MergeCartResult, Session } from '@/shared/contracts'
import { mergeGuestCart } from './api'

type Adjustment = MergeCartResult['adjustments'][number]

export const MERGE_ADJUSTED_TITLE = 'Carrinho ajustado ao estoque disponível'
export const MERGE_ERROR = 'Não foi possível trazer os itens do carrinho de visitante. Eles continuam salvos.'

export function describeAdjustments(adjustments: Adjustment[]): string {
  return adjustments
    .map(({ name, requested, applied }) => (applied === 0 ? `${name}: esgotado, removido` : `${name}: ${requested} → ${applied}`))
    .join(' · ')
}

// One merge per sign-in (session token): a repeated start hook call must not merge twice.
let mergedToken: string | null = null

/**
 * Session start hook (registered in app/router.tsx): moves the visitor's cart into the account
 * (`POST /cart/merge`), stores the merged cart, drops the guest cart query and guest id, and lists
 * stock adjustments in a toast. On failure the guest id is kept so a later sign-in can retry.
 */
export async function mergeGuestCartAfterSignIn(queryClient: QueryClient, session: Session): Promise<void> {
  if (mergedToken === session.token) return
  mergedToken = session.token
  const guestId = peekGuestCartId()
  if (!guestId) return

  let result: MergeCartResult
  try {
    result = await mergeGuestCart(guestId)
  } catch {
    mergedToken = null
    toast.error(MERGE_ERROR)
    return
  }

  const userCartKey = queryKeys.user(session.user.id).cart()
  // A cart request started before the merge answered must not overwrite the merged cart; requests made
  // after this point already see the merged state, so the response is authoritative (no extra refetch).
  await queryClient.cancelQueries({ queryKey: userCartKey })
  queryClient.setQueryData(userCartKey, result.cart)
  queryClient.removeQueries({ queryKey: queryKeys.guestCart(guestId) })
  resetGuestCartId()

  if (result.adjustments.length > 0) {
    toast.warning(MERGE_ADJUSTED_TITLE, { description: describeAdjustments(result.adjustments), duration: 10_000 })
  }
}
