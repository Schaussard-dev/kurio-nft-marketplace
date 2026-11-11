import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { safeRedirect } from '@/shared/lib/safe-redirect'
import { sessionQueryOptions } from './queries'

export interface AuthSearch {
  /** Where to go after signing in; validated with `safeRedirect` wherever it is followed. */
  redirect?: string
  reason?: 'expired'
}

export function validateAuthSearch(search: Record<string, unknown>): AuthSearch {
  return {
    ...(typeof search.redirect === 'string' && { redirect: search.redirect }),
    ...(search.reason === 'expired' && { reason: 'expired' as const }),
  }
}

/** /entrar and /cadastro are visitor-only: a signed-in user goes straight to the (internal) target. */
export async function redirectIfAuthenticated(queryClient: QueryClient, search: AuthSearch): Promise<void> {
  const session = await queryClient.ensureQueryData(sessionQueryOptions())
  if (session) throw redirect({ href: safeRedirect(search.redirect), replace: true })
}
