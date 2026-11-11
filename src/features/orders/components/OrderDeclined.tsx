import { Link } from '@tanstack/react-router'
import { CircleX } from 'lucide-react'
import type { Order } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/format'
import { buttonVariants } from '@/shared/ui/button'

/** Payment refused: nothing was charged and the cart still holds every item. */
export function OrderDeclined({ order }: { order: Order }) {
  return (
    <section
      aria-labelledby="order-declined-title"
      className="mx-auto flex w-full max-w-[700px] flex-col items-center gap-4 border-b-[10px] border-danger bg-surface px-6 py-12 text-center"
    >
      <CircleX aria-hidden className="size-12 text-danger" />
      <h1 id="order-declined-title" className="text-heading-28 font-bold text-foreground">
        Pagamento recusado
      </h1>
      <p data-testid="decline-reason" className="max-w-md text-body-lg-16 leading-6 text-text-secondary">
        {order.declineReason ?? 'A carteira recusou o pagamento.'}
      </p>
      <p className="text-body-15 text-text-secondary">
        Os itens do pedido ({formatEth(order.snapshot.total)}) continuam no seu carrinho.
      </p>
      <Link to="/carrinho" className={buttonVariants({ size: 'lg' })}>
        Voltar ao carrinho
      </Link>
    </section>
  )
}
