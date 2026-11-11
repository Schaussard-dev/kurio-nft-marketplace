import { createFileRoute } from '@tanstack/react-router'

interface PaymentSearch {
  /** Coupon applied in the cart, re-validated by the quote at checkout. */
  cupom?: string
}

export const Route = createFileRoute('/_authenticated/pagamento')({
  validateSearch: (search: Record<string, unknown>): PaymentSearch =>
    typeof search.cupom === 'string' && search.cupom ? { cupom: search.cupom } : {},
  component: PaymentPage,
})

// Placeholder; a later task builds checkout.
function PaymentPage() {
  return <h1 className="text-heading-28 text-foreground">Pagamento</h1>
}
