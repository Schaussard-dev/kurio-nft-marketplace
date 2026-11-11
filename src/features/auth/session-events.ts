import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { sessionStore } from '@/shared/api/session-storage'
import type { Session } from '@/shared/contracts'
import { isPrivatePath } from './private-paths'

export type SessionEndReason = 'logout' | 'expired' | 'switch'

/** sessionStorage key holding where to resume after an expiry (no sensitive data). */
export const RESUME_KEY = 'kurio-resume'

type SessionEndedListener = (reason: SessionEndReason) => void
type SessionStartHook = (queryClient: QueryClient, session: Session) => void | Promise<void>

/** Router bridge (bound in app/router.tsx) so this module does not import the route tree. */
export interface SessionNavigator {
  /** Current (or pending) in-app location: pathname + search. */
  currentPath(): string
  /** Sends the user to /entrar with `redirect` and `reason=expired`. */
  toLogin(redirect: string): void
}

const endedListeners = new Set<SessionEndedListener>()
const startHooks = new Set<SessionStartHook>()
let navigator: SessionNavigator | null = null
let expiredHint = false

/** The session check found the stored token rejected by the API (consumed by the route guard). */
export function markSessionRejected(): void {
  expiredHint = true
}

/** Returns whether the last stored token was rejected, and clears the flag. */
export function takeExpiredHint(): boolean {
  const hint = expiredHint
  expiredHint = false
  return hint
}

export function bindSessionNavigator(next: SessionNavigator | null): void {
  navigator = next
}

/** Subscribes to session ends (logout, expiry, user switch). Returns the unsubscribe function. */
export function onSessionEnded(listener: SessionEndedListener): () => void {
  endedListeners.add(listener)
  return () => {
    endedListeners.delete(listener)
  }
}

/** Features run work right after sign-in (e.g. the cart merges the guest cart). Returns the unregister function. */
export function registerSessionStartHook(hook: SessionStartHook): () => void {
  startHooks.add(hook)
  return () => {
    startHooks.delete(hook)
  }
}

function currentPath(): string {
  if (navigator) return navigator.currentPath()
  return typeof location === 'undefined' ? '/' : `${location.pathname}${location.search}`
}

function saveResume(path: string): void {
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ path }))
  } catch {
    // Storage unavailable: the redirect param still brings the user back.
  }
}

/** Reads and clears the resume context saved by an expiry. */
export function takeResume(): { path: string } | null {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY)
    sessionStorage.removeItem(RESUME_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object' && typeof Reflect.get(parsed, 'path') === 'string') {
      return { path: Reflect.get(parsed, 'path') as string }
    }
  } catch {
    // ignore unreadable context
  }
  return null
}

function clearResume(): void {
  try {
    sessionStorage.removeItem(RESUME_KEY)
  } catch {
    // nothing to clear
  }
}

/**
 * Saves where the user was and sends them to /entrar?redirect=…&reason=expired. Skipped when already
 * on /entrar (parallel 401s redirect once) and, with onlyFromPrivate, when the current route is public.
 */
export function redirectAfterExpiry({ onlyFromPrivate = false }: { onlyFromPrivate?: boolean } = {}): void {
  const path = currentPath()
  if (path === '/entrar' || path.startsWith('/entrar?')) return
  if (onlyFromPrivate && !isPrivatePath(path)) return
  saveResume(path)
  navigator?.toLogin(path)
}

/**
 * Ends the client session: clears the token, drops every user-scoped query, caches "no session"
 * and notifies subscribers (the realtime provider disconnects its socket). An expiry keeps the
 * resume context and, unless navigate is false, redirects to /entrar; logout and switch drop it.
 */
export function endSession(
  queryClient: QueryClient,
  reason: SessionEndReason,
  { navigate = true }: { navigate?: boolean } = {},
): void {
  sessionStore.clear()
  queryClient.removeQueries({ queryKey: queryKeys.users })
  queryClient.setQueryData(queryKeys.session(), null)
  endedListeners.forEach((listener) => listener(reason))

  if (reason !== 'expired') {
    expiredHint = false
    clearResume()
    return
  }
  if (navigate) redirectAfterExpiry()
}

/** Starts a client session after login/register; a different previous user is ended first (switch). */
export async function startSession(queryClient: QueryClient, session: Session): Promise<void> {
  const previous = sessionStore.get()
  if (previous && previous.user.id !== session.user.id) endSession(queryClient, 'switch')
  expiredHint = false
  sessionStore.set(session)
  queryClient.setQueryData(queryKeys.session(), session)
  // Public data may carry viewer-specific fields later (e.g. favorite flags): refresh it.
  void queryClient.invalidateQueries({ queryKey: ['nfts'] })
  void queryClient.invalidateQueries({ queryKey: ['nft'] })
  for (const hook of startHooks) {
    try {
      await hook(queryClient, session)
    } catch {
      // A failing hook (e.g. cart merge) must not undo the sign-in; the hook reports its own errors.
    }
  }
}
