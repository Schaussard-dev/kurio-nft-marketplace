import { Link, useRouterState } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { useSession } from '@/features/auth/queries'
import { toApiError } from '@/shared/api/api-error'
import { forgetPendingOrder, getPendingOrder, subscribePendingOrder } from '../pending-order'
import { isTerminal, orderPath, settleTerminalOrder, useOrder } from '../queries'

/**
 * Recovery of a purchase left waiting (spec §7): with a session, the remembered pending order is read
 * again (GET /orders/:id, which also resolves it when due). Still pending → a banner links to it;
 * terminal (or not this user's / gone) → it is forgotten. Hidden on that order's own page.
 */
export function PendingOrderBanner() {
  const userId = useSession()?.user.id ?? null
  const pendingId = useSyncExternalStore(
    subscribePendingOrder,
    () => (userId ? getPendingOrder(userId) : null),
    () => null,
  )
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { data: order, error } = useOrder(pendingId)

  useEffect(() => {
    if (!userId || !pendingId) return
    if (order?.id === pendingId && isTerminal(order)) settleTerminalOrder(userId, order)
    else if (error && [403, 404].includes(toApiError(error).status)) forgetPendingOrder(userId, pendingId)
  }, [userId, pendingId, order, error])

  if (!order || order.id !== pendingId || order.status !== 'pending' || pathname === orderPath(order.id)) return null
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 border-primary bg-surface px-4 py-3 text-body-15 text-foreground"
    >
      <LoaderCircle aria-hidden className="size-4 animate-spin text-primary motion-reduce:animate-none" />
      <span>Você tem um pedido em processamento</span>
      <Link
        to="/pedidos/$orderId"
        params={{ orderId: order.id }}
        className="font-bold text-text-accent underline underline-offset-4 hover:no-underline"
      >
        Acompanhar pedido
      </Link>
    </div>
  )
}
