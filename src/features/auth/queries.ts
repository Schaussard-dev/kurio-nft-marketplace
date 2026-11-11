import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { queryKeys } from '@/app/query-client'
import { toApiError } from '@/shared/api/api-error'
import { sessionStore } from '@/shared/api/session-storage'
import type { Session } from '@/shared/contracts'
import { fetchSession, loginRequest, logoutRequest, registerRequest } from './api'
import { endSession, markSessionRejected, startSession } from './session-events'

/**
 * The session, validated against the API. No stored token → null without a request.
 * 401 → the session ends without navigating (user queries dropped, sessionEnded emitted) and the
 * query resolves to null; the guard turns that into "session expired" on private routes. Network failures keep the stored session: private calls still re-check it.
 */
export function sessionQueryOptions() {
  return queryOptions<Session | null>({
    queryKey: queryKeys.session(),
    staleTime: 300_000,
    queryFn: async ({ signal, client }) => {
      const stored = sessionStore.get()
      if (!stored) return null
      // The user may log in/out while this request is in flight; only the token it checked is affected.
      const isCurrent = () => sessionStore.get()?.token === stored.token
      try {
        const fresh = await fetchSession(signal)
        return isCurrent() ? fresh : sessionStore.get()
      } catch (error) {
        const apiError = toApiError(error)
        if (apiError.code === 'CANCELED') throw error
        if (!isCurrent()) return sessionStore.get()
        if (apiError.status === 401) {
          // Same cleanup as any session end; redirecting is left to the guard (private routes only).
          endSession(client, 'expired', { navigate: false })
          markSessionRejected()
          return null
        }
        return stored
      }
    },
  })
}

export function useSession(): Session | null {
  // While the first check runs, the stored session avoids a signed-out flash in the header.
  return useQuery({ ...sessionQueryOptions(), placeholderData: () => sessionStore.get() }).data ?? null
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: loginRequest,
    onSuccess: (session) => startSession(queryClient, session),
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: registerRequest,
    onSuccess: (session) => startSession(queryClient, session),
  })
}

/** Ends the session on the API (best effort), then locally, and returns to Início. */
export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: async () => {
      try {
        await logoutRequest()
      } catch {
        // The local session ends anyway; an unreachable API must not keep the user signed in.
      }
    },
    onSuccess: async () => {
      endSession(queryClient, 'logout')
      await navigate({ to: '/' })
    },
  })
}
