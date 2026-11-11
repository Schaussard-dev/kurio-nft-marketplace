import { createFileRoute } from '@tanstack/react-router'
import { WalletsPage } from '@/features/wallets/components/WalletsPage'

interface WalletsSearch {
  /** Where to go after the first wallet is saved (checkout); validated with `safeRedirect` when followed. */
  redirect?: string
}

export const Route = createFileRoute('/_authenticated/perfil/carteiras')({
  validateSearch: (search: Record<string, unknown>): WalletsSearch =>
    typeof search.redirect === 'string' ? { redirect: search.redirect } : {},
  component: CarteirasRoute,
})

function CarteirasRoute() {
  const { redirect } = Route.useSearch()
  return <WalletsPage redirect={redirect} />
}
