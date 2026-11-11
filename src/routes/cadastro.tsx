import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/cadastro')({
  component: SignUpPage,
})

// Placeholder; a later task builds the sign-up form.
function SignUpPage() {
  return <h1 className="text-heading-28 text-foreground">Criar conta</h1>
}
