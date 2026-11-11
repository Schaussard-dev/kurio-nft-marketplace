import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@/shared/contracts'

const SESSION: Session = {
  token: 't',
  expiresAt: '2030-01-01T00:00:00.000Z',
  user: { id: 'u1', username: 'ana', email: 'ana@kurio.dev', displayName: 'Ana', avatarUrl: null },
}

function stubStorage(): Map<string, string> {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  })
  return data
}

describe('sessionStore', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('round-trips a session and notifies subscribers', async () => {
    stubStorage()
    const { sessionStore } = await import('./session-storage')
    const fn = vi.fn()
    const unsubscribe = sessionStore.subscribe(fn)
    sessionStore.set(SESSION)
    expect(sessionStore.get()).toEqual(SESSION)
    sessionStore.clear()
    expect(sessionStore.get()).toBeNull()
    expect(fn).toHaveBeenCalledTimes(2)
    unsubscribe()
    sessionStore.set(SESSION)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('treats invalid stored JSON as null and clears it', async () => {
    const data = stubStorage()
    data.set('kurio-session', '{"token":1}')
    const { sessionStore } = await import('./session-storage')
    expect(sessionStore.get()).toBeNull()
    expect(data.has('kurio-session')).toBe(false)
  })

  it('falls back to memory when localStorage throws', async () => {
    const denied = () => {
      throw new Error('denied')
    }
    vi.stubGlobal('localStorage', { getItem: denied, setItem: denied, removeItem: denied })
    const { sessionStore, getGuestCartId } = await import('./session-storage')
    sessionStore.set(SESSION)
    expect(sessionStore.get()).toEqual(SESSION)
    expect(getGuestCartId()).toBe(getGuestCartId())
  })
})

describe('guest cart id', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('persists a uuid and resets it', async () => {
    const data = stubStorage()
    const { getGuestCartId, resetGuestCartId } = await import('./session-storage')
    const id = getGuestCartId()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(data.get('kurio-guest-cart-id')).toBe(id)
    expect(getGuestCartId()).toBe(id)
    resetGuestCartId()
    expect(getGuestCartId()).not.toBe(id)
  })
})
