import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { queryKeys } from '@/app/query-client'
import { sessionQueryOptions } from '@/features/auth/queries'
import { redirectAfterExpiry, takeExpiredHint } from '@/features/auth/session-events'

/**
 * Re-checks a cached session in the background. A rejected token has already ended the session
 * (in the query); the user is sent to /entrar only if they are still on a private route.
 */
function revalidateSession(queryClient: QueryClient) {
  void queryClient.fetchQuery({ ...sessionQueryOptions(), staleTime: 0 }).then(
    (session) => {
      if (!session && takeExpiredHint()) redirectAfterExpiry({ onlyFromPrivate: true })
    },
    () => undefined,
  )
}

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context: { queryClient }, location }) => {
    const cached = queryClient.getQueryData(queryKeys.session())
    // Known session: navigate at once and validate it in the background.
    if (cached) {
      revalidateSession(queryClient)
      return
    }
    const session = await queryClient.ensureQueryData(sessionQueryOptions())
    if (!session) {
      throw redirect({
        to: '/entrar',
        search: { redirect: location.href, ...(takeExpiredHint() && { reason: 'expired' as const }) },
      })
    }
  },
  component: Outlet,
})
