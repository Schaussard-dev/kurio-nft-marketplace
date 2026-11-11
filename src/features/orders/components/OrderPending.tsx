import { LoaderCircle } from 'lucide-react'
import type { Order } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/format'

/** Waiting for the (simulated) network: the order is safe to leave, it resolves on its own. */
export function OrderPending({ order }: { order: Order }) {
  return (
    <section
      aria-labelledby="order-pending-title"
      className="mx-auto flex w-full max-w-[700px] flex-col items-center gap-4 bg-surface px-6 py-12 text-center"
    >
      <h1 id="order-pending-title" className="text-title-20 font-bold text-text-secondary">
        Pedido em processamento
      </h1>
      <div role="status" className="flex flex-col items-center gap-3">
        <LoaderCircle aria-hidden className="size-12 animate-spin text-primary motion-reduce:animate-none" />
        <p className="text-body-lg-16 text-foreground">Aguardando confirmação na rede…</p>
      </div>
      <p className="max-w-md text-body-15 leading-6 text-text-secondary">
        Você pode sair desta página com segurança. Avisaremos quando a rede confirmar o pagamento de{' '}
        {formatEth(order.snapshot.total)}.
      </p>
    </section>
  )
}
