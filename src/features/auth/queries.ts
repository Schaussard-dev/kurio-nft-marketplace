import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { queryKeys } from '@/app/query-client'
import { sessionStore } from '@/shared/api/session-storage'
import type { Session } from '@/shared/contracts'

/**
 * Session read from the local store. Task 11 replaces the body (token validation against the API)
 * and keeps this signature.
 */
export function sessionQueryOptions() {
  return queryOptions<Session | null>({
    queryKey: queryKeys.session(),
    queryFn: () => sessionStore.get(),
    staleTime: Infinity,
  })
}

export function useSession(): Session | null {
  return useQuery(sessionQueryOptions()).data ?? null
}

/** Clears the local session, drops user-scoped cache and returns to the home page. */
export function useSignOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useCallback(() => {
    sessionStore.clear()
    queryClient.removeQueries({ queryKey: queryKeys.users })
    void navigate({ to: '/' })
  }, [queryClient, navigate])
}
