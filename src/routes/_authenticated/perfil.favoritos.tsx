import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/perfil/favoritos')({
  component: FavoritesPage,
})

// Placeholder; a later task builds the wishlist.
function FavoritesPage() {
  return <h1 className="text-heading-28 text-foreground">Lista de interesse</h1>
}
