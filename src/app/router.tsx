import { createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { NotFound } from '@/app/NotFound'
import { createQueryClient } from '@/app/query-client'

export const APP_NAME = 'Kurio'

export const queryClient = createQueryClient()

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultNotFoundComponent: NotFound,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
