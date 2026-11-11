import { lazy, Suspense } from 'react'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { PageShell } from '@/shared/layout/PageShell'

// Demo tooling: the chunk is only referenced (and therefore only built) in the mock build.
const MockPanel =
  import.meta.env.VITE_ENABLE_MOCKS === 'true' ? lazy(() => import('@/features/mock-panel/MockPanel')) : null

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <PageShell>
        <Outlet />
      </PageShell>
      {MockPanel && (
        <Suspense fallback={null}>
          <MockPanel />
        </Suspense>
      )}
    </>
  )
}
