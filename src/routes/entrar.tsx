import { createFileRoute } from '@tanstack/react-router'
import { redirectIfAuthenticated, validateAuthSearch } from '@/features/auth/auth-route'
import { AuthScreen } from '@/features/auth/components/AuthDialog'

export const Route = createFileRoute('/entrar')({
  validateSearch: validateAuthSearch,
  beforeLoad: ({ context, search }) => redirectIfAuthenticated(context.queryClient, search),
  component: LoginPage,
})

function LoginPage() {
  return <AuthScreen mode="login" search={Route.useSearch()} />
}
