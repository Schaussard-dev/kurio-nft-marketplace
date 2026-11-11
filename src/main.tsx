import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from '@/app/router'
import '@/styles/globals.css'

if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
  await (await import('./mocks/browser')).startMocks()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
