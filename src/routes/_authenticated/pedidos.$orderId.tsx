import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/pedidos/$orderId')({
  component: OrderPage,
})

// Placeholder; a later task builds the order confirmation.
function OrderPage() {
  return <h1 className="text-heading-28 text-foreground">Pedido</h1>
}
