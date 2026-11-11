import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memorySessionStorage } from '@/features/checkout/test-storage'
import { clearAttempt, getAttempt, peekAttempt } from './idempotency'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('order attempts', () => {
  beforeEach(() => vi.stubGlobal('sessionStorage', memorySessionStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('stores the attempt with its exact payload before it is sent and reuses it for the same payload', () => {
    const first = getAttempt('usr_ana', 'hash-a', { quoteId: 'qt_1' })
    expect(first).toMatchObject({ payloadHash: 'hash-a', payload: { quoteId: 'qt_1' }, reused: false })
    expect(first.key).toMatch(UUID)
    expect(peekAttempt('usr_ana')).toEqual({ key: first.key, payloadHash: 'hash-a', payload: { quoteId: 'qt_1' } })
    expect(getAttempt('usr_ana', 'hash-a', { quoteId: 'qt_1' })).toMatchObject({ key: first.key, reused: true })
  })

  it('while unresolved, a different payload (new quote, edited field) replays the stored payload and key', () => {
    const first = getAttempt('usr_ana', 'hash-a', { quoteId: 'qt_1' })
    const again = getAttempt('usr_ana', 'hash-b', { quoteId: 'qt_2' })
    expect(again).toEqual({ key: first.key, payloadHash: 'hash-a', payload: { quoteId: 'qt_1' }, reused: true })
  })

  it('mints a new key only after a definitive answer cleared the attempt; attempts are per user', () => {
    const ana = getAttempt('usr_ana', 'hash-a', { n: 1 })
    const bruno = getAttempt('usr_bruno', 'hash-a', { n: 1 })
    expect(bruno.key).not.toBe(ana.key)
    clearAttempt('usr_ana')
    expect(peekAttempt('usr_ana')).toBeNull()
    const next = getAttempt('usr_ana', 'hash-b', { n: 2 })
    expect(next.key).not.toBe(ana.key)
    expect(next.reused).toBe(false)
    expect(getAttempt('usr_bruno', 'hash-a', { n: 1 }).key).toBe(bruno.key)
  })

  it('ignores an unreadable stored attempt', () => {
    sessionStorage.setItem('kurio-order-attempt:usr_ana', '{not json')
    expect(peekAttempt('usr_ana')).toBeNull()
    expect(getAttempt('usr_ana', 'hash-a', {}).key).toMatch(UUID)
  })
})
