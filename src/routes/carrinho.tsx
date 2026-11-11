import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/carrinho')({
  component: CartPage,
})

// Placeholder; Task 13 builds the cart.
function CartPage() {
  return <h1 className="text-heading-28 text-foreground">Carrinho</h1>
}
