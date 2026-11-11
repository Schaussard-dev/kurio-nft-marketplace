import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/entrar')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === 'string' ? { redirect: search.redirect } : {},
  component: LoginPage,
})

// Placeholder; Task 11 builds the login form.
function LoginPage() {
  return <h1 className="text-heading-28 text-foreground">Entrar</h1>
}
