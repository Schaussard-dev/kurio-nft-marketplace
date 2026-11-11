import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/app/query-client'
import { ApiError } from '@/shared/api/api-error'
import { sessionStore } from '@/shared/api/session-storage'
import type { Session } from '@/shared/contracts'

vi.mock('./api', () => ({ fetchSession: vi.fn() }))

const { fetchSession } = await import('./api')
const { sessionQueryOptions } = await import('./queries')
const { bindSessionNavigator, onSessionEnded, takeExpiredHint } = await import('./session-events')

const ana: Session = {
  token: 'tok-ana',
  expiresAt: '2030-01-01T00:00:00.000Z',
  user: { id: 'usr_ana', username: 'ana', email: 'ana@kurio.dev', displayName: 'Ana Souza', avatarUrl: null },
}

describe('sessionQueryOptions', () => {
  beforeEach(() => {
    sessionStore.clear()
    takeExpiredHint()
    vi.mocked(fetchSession).mockReset()
  })

  it('a rejected token ends the session (user queries, sessionEnded) without navigating', async () => {
    sessionStore.set(ana)
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.user('usr_ana').favorites(), ['nft_042'])
    qc.setQueryData(queryKeys.nfts({ page: 1 }), { items: [] })
    vi.mocked(fetchSession).mockRejectedValue(
      new ApiError({ status: 401, code: 'SESSION_EXPIRED', message: 'Sua sessão expirou' }),
    )
    const toLogin = vi.fn()
    bindSessionNavigator({ currentPath: () => '/', toLogin })
    const ended = vi.fn()
    const unsubscribe = onSessionEnded(ended)

    const session = await qc.fetchQuery(sessionQueryOptions())
    unsubscribe()

    expect(session).toBeNull()
    expect(sessionStore.get()).toBeNull()
    expect(qc.getQueryCache().findAll({ queryKey: ['user'] })).toHaveLength(0)
    expect(qc.getQueryCache().findAll({ queryKey: ['nfts'] })).toHaveLength(1)
    expect(ended).toHaveBeenCalledWith('expired')
    expect(toLogin).not.toHaveBeenCalled()
    expect(takeExpiredHint()).toBe(true)
  })

  it('a network failure keeps the stored session', async () => {
    sessionStore.set(ana)
    vi.mocked(fetchSession).mockRejectedValue(new ApiError({ status: 0, code: 'NETWORK', message: 'x' }))
    expect(await new QueryClient().fetchQuery(sessionQueryOptions())).toEqual(ana)
    expect(sessionStore.get()).toEqual(ana)
  })
})
