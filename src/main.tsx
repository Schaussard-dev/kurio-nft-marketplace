import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { Providers } from '@/app/providers'
import { queryClient, router } from '@/app/router'
import '@/styles/globals.css'

// Fetch the code-split chunks of the entry route now, in parallel with the rest of the boot, instead of
// after the first render (no loaders run here, so no API request leaves before the app mounts).
const [entryRoutes] = router.getMatchedRoutes(window.location.pathname)
for (const route of entryRoutes) {
  router.loadRouteChunk(route)?.catch(() => {
    // The router retries the chunk on render and shows its error boundary if it still fails.
  })
}

if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
  // Blocked site data makes storage throw, and MSW reads it while loading: shim it first.
  const { ensureWebStorage } = await import('./mocks/storage-shim')
  ensureWebStorage()
  await (await import('./mocks/browser')).startMocks()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
)
