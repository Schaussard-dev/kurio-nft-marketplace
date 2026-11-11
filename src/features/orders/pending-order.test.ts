import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memorySessionStorage } from '@/features/checkout/test-storage'
import { forgetPendingOrder, getPendingOrder, rememberPendingOrder, subscribePendingOrder } from './pending-order'

beforeEach(() => {
  vi.stubGlobal('localStorage', memorySessionStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pending order', () => {
  it('is kept per user in localStorage under kurio-pending-order:<userId>', () => {
    rememberPendingOrder('usr_ana', 'ord_1')
    expect(localStorage.getItem('kurio-pending-order:usr_ana')).toBe('ord_1')
    expect(getPendingOrder('usr_ana')).toBe('ord_1')
    expect(getPendingOrder('usr_bruno')).toBeNull()
  })

  it('forgets only the given user, and only the given order when one is named', () => {
    rememberPendingOrder('usr_ana', 'ord_1')
    rememberPendingOrder('usr_bruno', 'ord_2')
    forgetPendingOrder('usr_ana', 'ord_other')
    expect(getPendingOrder('usr_ana')).toBe('ord_1')
    forgetPendingOrder('usr_ana', 'ord_1')
    expect(getPendingOrder('usr_ana')).toBeNull()
    forgetPendingOrder('usr_bruno')
    expect(getPendingOrder('usr_bruno')).toBeNull()
  })

  it('notifies subscribers on every change', () => {
    const listener = vi.fn()
    const unsubscribe = subscribePendingOrder(listener)
    rememberPendingOrder('usr_ana', 'ord_1')
    forgetPendingOrder('usr_ana')
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    rememberPendingOrder('usr_ana', 'ord_2')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('survives unavailable storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => rememberPendingOrder('usr_ana', 'ord_1')).not.toThrow()
    expect(getPendingOrder('usr_ana')).toBeNull()
    expect(() => forgetPendingOrder('usr_ana')).not.toThrow()
  })
})
