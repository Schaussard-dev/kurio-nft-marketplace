import { createFileRoute, Link } from '@tanstack/react-router'
import { CircleAlert, SearchX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { OrderDeclined } from '@/features/orders/components/OrderDeclined'
import { OrderPending } from '@/features/orders/components/OrderPending'
import { OrderReceipt } from '@/features/orders/components/OrderReceipt'
import { OrderSkeleton } from '@/features/orders/components/OrderSkeleton'
import { orderOutcomeText, useOrder } from '@/features/orders/queries'
import { toApiError } from '@/shared/api/api-error'
import type { OrderStatus } from '@/shared/contracts'
import { Button, buttonVariants } from '@/shared/ui/button'
import { useAnnounce } from '@/shared/ui/LiveRegion'
import { useDocumentTitle } from '@/shared/lib/use-document-title'

export const Route = createFileRoute('/_authenticated/pedidos/$orderId')({
  component: OrderPage,
})

/** Another user's order (403) looks exactly like a missing one (404): nothing about it is revealed. */
function OrderNotFound() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-start gap-4 py-20">
      <SearchX aria-hidden className="size-10 text-text-accent" />
      <h1 className="text-display-32 text-foreground">Pedido não encontrado</h1>
      <p className="text-body-lg-16 leading-6 text-text-secondary">
        Não encontramos este pedido na sua conta. Confira o link ou volte ao início.
      </p>
      <Link to="/" className={buttonVariants()}>
        Voltar ao início
      </Link>
    </section>
  )
}

function OrderPage() {
  useDocumentTitle('Pedido')
  const { orderId } = Route.useParams()
  const { data: order, error, isPending, isFetching, refetch } = useOrder(orderId)
  const announce = useAnnounce()

  // The outcome is spoken here when this page saw the order go from pending to terminal.
  const lastStatus = useRef<OrderStatus | null>(null)
  useEffect(() => {
    if (!order) return
    if (lastStatus.current === 'pending' && order.status !== 'pending') announce(orderOutcomeText(order))
    lastStatus.current = order.status
  }, [order, announce])

  if (isPending) return <OrderSkeleton />
  if (!order) {
    const status = toApiError(error).status
    if (status === 403 || status === 404) return <OrderNotFound />
    return (
      <section className="mx-auto flex max-w-xl flex-col items-start gap-4 py-20">
        <h1 className="text-heading-28 text-foreground">Pedido</h1>
        <p role="alert" className="flex items-start gap-2 text-body-lg-16 text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          Não foi possível carregar o pedido. Ele continua registrado.
        </p>
        <Button type="button" onClick={() => void refetch()} disabled={isFetching}>
          Tentar novamente
        </Button>
      </section>
    )
  }
  if (order.status === 'pending') return <OrderPending order={order} />
  if (order.status === 'declined') return <OrderDeclined order={order} />
  return <OrderReceipt order={order} />
}
