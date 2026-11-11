import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/perfil/')({
  component: ProfilePage,
})

// Placeholder; a later task builds the profile form.
function ProfilePage() {
  return <h1 className="text-heading-28 text-foreground">Perfil do colecionador</h1>
}
