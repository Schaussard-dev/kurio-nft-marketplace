import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { queryKeys } from '@/app/query-client'
import { RealtimeProvider } from '@/features/realtime/RealtimeProvider'
import { sessionStore } from '@/shared/api/session-storage'
import { useMediaQuery } from '@/shared/lib/use-media-query'
import { LiveRegionProvider } from '@/shared/ui/LiveRegion'
import { Toaster } from '@/shared/ui/sonner'

export function Providers({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  // Below 1024px the bottom of the screen holds the tab bar or the buy bar: toasts go on top instead.
  const wide = useMediaQuery('(min-width: 1024px)')
  // Keeps the cached session in sync with the store (login, logout, expiry).
  useEffect(
    () => sessionStore.subscribe((session) => queryClient.setQueryData(queryKeys.session(), session)),
    [queryClient],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <LiveRegionProvider>
        <RealtimeProvider>
          {children}
          <Toaster position={wide ? 'bottom-right' : 'top-center'} />
        </RealtimeProvider>
      </LiveRegionProvider>
    </QueryClientProvider>
  )
}
