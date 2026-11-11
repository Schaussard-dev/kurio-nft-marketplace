import { createFileRoute } from '@tanstack/react-router'
import { parseCouponParam } from '@/features/cart/coupon-param'
import { CheckoutPage } from '@/features/checkout/components/CheckoutPage'

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

function PaymentPage() {
  const { cupom } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <CheckoutPage
      cupom={cupom}
      onCouponChange={(code) => void navigate({ search: code ? { cupom: code } : {}, replace: true, resetScroll: false })}
    />
  )
}
