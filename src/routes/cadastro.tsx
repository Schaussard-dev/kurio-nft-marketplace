import { createFileRoute } from '@tanstack/react-router'
import { redirectIfAuthenticated, validateAuthSearch } from '@/features/auth/auth-route'
import { AuthScreen } from '@/features/auth/components/AuthDialog'

export const Route = createFileRoute('/cadastro')({
  validateSearch: validateAuthSearch,
  beforeLoad: ({ context, search }) => redirectIfAuthenticated(context.queryClient, search),
  component: SignUpPage,
})

function SignUpPage() {
  return <AuthScreen mode="register" search={Route.useSearch()} />
}
