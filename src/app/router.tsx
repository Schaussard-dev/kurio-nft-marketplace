import { createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { NotFound } from '@/app/NotFound'
import { createQueryClient } from '@/app/query-client'
import { bindSessionNavigator, endSession } from '@/features/auth/session-events'
import { setSessionExpiredHandler } from '@/shared/api/http'

export const APP_NAME = 'Kurio'

export const queryClient = createQueryClient()

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultNotFoundComponent: NotFound,
})

// Session expiry: any authenticated request answered with 401 ends the session and goes to /entrar.
bindSessionNavigator({
  currentPath: () => router.latestLocation.href,
  toLogin: (redirect) => void router.navigate({ to: '/entrar', search: { redirect, reason: 'expired' } }),
})
setSessionExpiredHandler(() => endSession(queryClient, 'expired'))

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
