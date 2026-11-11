import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { Providers } from '@/app/providers'
import { queryClient, router } from '@/app/router'
import '@/styles/globals.css'

if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
  await (await import('./mocks/browser')).startMocks()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
)
