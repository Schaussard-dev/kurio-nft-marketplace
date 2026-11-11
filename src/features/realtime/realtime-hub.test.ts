import { describe, expect, it, vi } from 'vitest'
import type { EventEnvelope } from '@/shared/contracts'
import { createRealtimeHub } from './realtime-hub'

const envelope: EventEnvelope = {
  eventId: 'evt_1',
  type: 'nft.updated',
  resource: { type: 'nft', id: 'nft_042' },
  version: 3,
  occurredAt: '2026-11-11T12:00:00.000Z',
  userId: null,
  data: { price: '1.29', previousPrice: '1.19', editions: [] },
}

describe('createRealtimeHub', () => {
  it('delivers a valid event once to the handlers of its type', () => {
    const hub = createRealtimeHub()
    const nft = vi.fn()
    const order = vi.fn()
    hub.subscribe('nft.updated', nft)
    hub.subscribe('order.updated', order)

    hub.dispatch('nft.updated', envelope, null)
    hub.dispatch('nft.updated', envelope, null)

    expect(nft).toHaveBeenCalledTimes(1)
    expect(nft).toHaveBeenCalledWith(envelope)
    expect(order).not.toHaveBeenCalled()
  })

  it('drops malformed payloads, mismatched event names and other users’ events', () => {
    const hub = createRealtimeHub()
    const order = vi.fn()
    hub.subscribe('order.updated', order)
    hub.dispatch('order.updated', { eventId: 'x' }, 'usr_ana')
    hub.dispatch('order.updated', envelope, 'usr_ana')
    hub.dispatch('order.updated', { ...envelope, eventId: 'evt_2', type: 'order.updated', userId: 'usr_bruno' }, 'usr_ana')
    expect(order).not.toHaveBeenCalled()
  })

  it('unsubscribes handlers and publishes status changes', () => {
    const hub = createRealtimeHub()
    const nft = vi.fn()
    hub.subscribe('nft.updated', nft)()
    hub.dispatch('nft.updated', envelope, null)
    expect(nft).not.toHaveBeenCalled()

    const listener = vi.fn()
    hub.subscribeStatus(listener)
    expect(hub.getStatus()).toBe('reconnecting')
    hub.setStatus('connected')
    hub.setStatus('connected')
    expect(hub.getStatus()).toBe('connected')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
