import { lazy, Suspense } from 'react'
import { Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { useCartCount } from '@/features/cart/queries'
import { PendingOrderBanner } from '@/features/orders/components/PendingOrderBanner'
import { PageShell } from '@/shared/layout/PageShell'
import { useMediaQuery } from '@/shared/lib/use-media-query'

// Demo tooling: the chunk is only referenced (and therefore only built) in the mock build.
const MockPanel =
  import.meta.env.VITE_ENABLE_MOCKS === 'true' ? lazy(() => import('@/features/mock-panel/MockPanel')) : null

const AUTH_PATHS = new Set(['/entrar', '/cadastro'])

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
})

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // Below 768px sign-in/sign-up and the NFT detail are full screens without the app chrome
  // (Mobile Login/Cadastro/Detalhes frames; the detail has its own back button and bottom bar).
  const isDialogWidth = useMediaQuery('(min-width: 768px)')
  const cartCount = useCartCount()
  const bare = (AUTH_PATHS.has(pathname) || pathname.startsWith('/nft/')) && !isDialogWidth
  return (
    <>
      <PageShell bare={bare} cartCount={cartCount}>
        <PendingOrderBanner />
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
