import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/pagamento')({
  component: PaymentPage,
})

// Placeholder; a later task builds checkout.
function PaymentPage() {
  return <h1 className="text-heading-28 text-foreground">Pagamento</h1>
}
