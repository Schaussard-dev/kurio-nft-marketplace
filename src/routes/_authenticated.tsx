import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { sessionQueryOptions } from '@/features/auth/queries'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions())
    if (!session) {
      throw redirect({ to: '/entrar', search: { redirect: location.href } })
    }
  },
  component: Outlet,
})
