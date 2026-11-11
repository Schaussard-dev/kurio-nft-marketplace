import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memorySessionStorage } from '@/features/checkout/test-storage'
import { clearAttempt, getAttempt } from './idempotency'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('getAttempt', () => {
  beforeEach(() => vi.stubGlobal('sessionStorage', memorySessionStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('reuses the key while the payload hash is the same and starts a new attempt when it changes', () => {
    const first = getAttempt('usr_ana', 'hash-a')
    expect(first.key).toMatch(UUID)
    expect(first.payloadHash).toBe('hash-a')
    expect(getAttempt('usr_ana', 'hash-a').key).toBe(first.key)

    const second = getAttempt('usr_ana', 'hash-b')
    expect(second.key).not.toBe(first.key)
    expect(getAttempt('usr_ana', 'hash-b').key).toBe(second.key)
  })

  it('is stored per user under kurio-order-attempt:<userId> and cleared by clearAttempt', () => {
    const ana = getAttempt('usr_ana', 'hash-a')
    const bruno = getAttempt('usr_bruno', 'hash-a')
    expect(bruno.key).not.toBe(ana.key)
    expect(JSON.parse(sessionStorage.getItem('kurio-order-attempt:usr_ana')!)).toEqual(ana)

    clearAttempt('usr_ana')
    expect(sessionStorage.getItem('kurio-order-attempt:usr_ana')).toBeNull()
    expect(getAttempt('usr_ana', 'hash-a').key).not.toBe(ana.key)
    expect(getAttempt('usr_bruno', 'hash-a').key).toBe(bruno.key)
  })

  it('ignores an unreadable stored attempt', () => {
    sessionStorage.setItem('kurio-order-attempt:usr_ana', '{not json')
    expect(getAttempt('usr_ana', 'hash-a').key).toMatch(UUID)
  })
})
