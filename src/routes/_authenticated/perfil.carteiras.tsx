import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/perfil/carteiras')({
  component: WalletsPage,
})

// Placeholder; a later task builds the wallets list.
function WalletsPage() {
  return <h1 className="text-heading-28 text-foreground">Carteiras</h1>
}
