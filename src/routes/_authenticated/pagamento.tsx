import { createFileRoute } from '@tanstack/react-router'
import { parseCouponParam } from '@/features/cart/coupon-param'

interface PaymentSearch {
  /** Coupon applied in the cart, re-validated by the quote at checkout. */
  cupom?: string
}

export const Route = createFileRoute('/_authenticated/pagamento')({
  validateSearch: (search: Record<string, unknown>): PaymentSearch => {
    // Always set the key: an omitted key would let the raw (unvalidated) root search value through.
    return { cupom: parseCouponParam(search.cupom) }
  },
  component: PaymentPage,
})

// Placeholder; a later task builds checkout.
function PaymentPage() {
  return <h1 className="text-heading-28 text-foreground">Pagamento</h1>
}
