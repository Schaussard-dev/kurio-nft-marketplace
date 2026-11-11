import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/app/query-client'
import { sessionStore } from '@/shared/api/session-storage'
import type { Session } from '@/shared/contracts'
import {
  RESUME_KEY,
  bindSessionNavigator,
  endSession,
  redirectAfterExpiry,
  onSessionEnded,
  registerSessionStartHook,
  startSession,
} from './session-events'

const ana: Session = {
  token: 'tok-ana',
  expiresAt: '2030-01-01T00:00:00.000Z',
  user: { id: 'usr_ana', username: 'ana', email: 'ana@kurio.dev', displayName: 'Ana Souza', avatarUrl: null },
}
const bruno: Session = {
  token: 'tok-bruno',
  expiresAt: '2030-01-01T00:00:00.000Z',
  user: { id: 'usr_bruno', username: 'bruno', email: 'bruno@kurio.dev', displayName: 'Bruno Lima', avatarUrl: null },
}

function seededClient(): QueryClient {
  const qc = new QueryClient()
  qc.setQueryData(queryKeys.nfts({ page: 1 }), { items: [] })
  qc.setQueryData(queryKeys.nft('nft_001'), { id: 'nft_001' })
  qc.setQueryData(queryKeys.user('usr_ana').favorites(), ['nft_042'])
  qc.setQueryData(queryKeys.user('usr_ana').cart(), { lines: [] })
  qc.setQueryData(queryKeys.session(), ana)
  return qc
}

describe('session events', () => {
  beforeEach(() => {
    sessionStore.clear()
    bindSessionNavigator(null)
  })

  it('endSession(logout) drops every user-scoped query and keeps public ones', () => {
    sessionStore.set(ana)
    const qc = seededClient()

    endSession(qc, 'logout')

    expect(qc.getQueryCache().findAll({ queryKey: ['user'] })).toHaveLength(0)
    expect(qc.getQueryCache().findAll({ queryKey: ['nfts'] })).toHaveLength(1)
    expect(qc.getQueryCache().findAll({ queryKey: ['nft'] })).toHaveLength(1)
    expect(qc.getQueryData(queryKeys.session())).toBeNull()
    expect(sessionStore.get()).toBeNull()
  })

  it('notifies sessionEnded subscribers with the reason', () => {
    const listener = vi.fn()
    const unsubscribe = onSessionEnded(listener)
    endSession(new QueryClient(), 'switch')
    unsubscribe()
    endSession(new QueryClient(), 'logout')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('switch')
  })

  it('endSession(expired) saves the resume path and sends the user to /entrar', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    })
    const toLogin = vi.fn()
    bindSessionNavigator({ currentPath: () => '/perfil/carteiras?x=1', toLogin })

    endSession(new QueryClient(), 'expired')

    expect(JSON.parse(storage.get(RESUME_KEY)!)).toEqual({ path: '/perfil/carteiras?x=1' })
    expect(toLogin).toHaveBeenCalledWith('/perfil/carteiras?x=1')
    vi.unstubAllGlobals()
  })

  it('endSession(expired) does not navigate again when already on /entrar', () => {
    const toLogin = vi.fn()
    bindSessionNavigator({ currentPath: () => '/entrar?redirect=%2Fperfil', toLogin })
    endSession(new QueryClient(), 'expired')
    expect(toLogin).not.toHaveBeenCalled()
  })

  it('startSession stores the session, caches it and runs the start hooks', async () => {
    const qc = new QueryClient()
    const hook = vi.fn()
    const unregister = registerSessionStartHook(hook)

    await startSession(qc, ana)
    unregister()

    expect(sessionStore.get()).toEqual(ana)
    expect(qc.getQueryData(queryKeys.session())).toEqual(ana)
    expect(hook).toHaveBeenCalledWith(qc, ana)
  })

  it('startSession with a different user ends the previous session first (switch)', async () => {
    sessionStore.set(ana)
    const qc = seededClient()
    const listener = vi.fn()
    const unsubscribe = onSessionEnded(listener)

    await startSession(qc, bruno)
    unsubscribe()

    expect(listener).toHaveBeenCalledWith('switch')
    expect(qc.getQueryCache().findAll({ queryKey: ['user'] })).toHaveLength(0)
    expect(qc.getQueryData(queryKeys.session())).toEqual(bruno)
  })

  it('logout and switch drop a saved resume context; expiry keeps it', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    })
    storage.set(RESUME_KEY, JSON.stringify({ path: '/perfil' }))
    endSession(new QueryClient(), 'expired', { navigate: false })
    expect(storage.has(RESUME_KEY)).toBe(true)
    endSession(new QueryClient(), 'logout')
    expect(storage.has(RESUME_KEY)).toBe(false)
    storage.set(RESUME_KEY, JSON.stringify({ path: '/perfil' }))
    endSession(new QueryClient(), 'switch')
    expect(storage.has(RESUME_KEY)).toBe(false)
    vi.unstubAllGlobals()
  })

  it('endSession(expired, { navigate: false }) ends the session without redirecting', () => {
    const toLogin = vi.fn()
    bindSessionNavigator({ currentPath: () => '/perfil', toLogin })
    const qc = seededClient()
    endSession(qc, 'expired', { navigate: false })
    expect(qc.getQueryCache().findAll({ queryKey: ['user'] })).toHaveLength(0)
    expect(toLogin).not.toHaveBeenCalled()
  })

  it('redirectAfterExpiry only redirects while the user is on a private route', () => {
    const toLogin = vi.fn()
    let path = '/nft/nft_001'
    bindSessionNavigator({ currentPath: () => path, toLogin })
    redirectAfterExpiry({ onlyFromPrivate: true })
    expect(toLogin).not.toHaveBeenCalled()
    path = '/perfil/carteiras'
    redirectAfterExpiry({ onlyFromPrivate: true })
    expect(toLogin).toHaveBeenCalledWith('/perfil/carteiras')
  })
})
