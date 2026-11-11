import { describe, expect, it } from 'vitest'
import type { EventEnvelope } from '@/shared/contracts'
import { createEventGuard } from './event-guard'

let seq = 0
function envelope(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  seq += 1
  return {
    eventId: `evt_${seq}`,
    type: 'nft.updated',
    resource: { type: 'nft', id: 'nft_042' },
    version: seq,
    occurredAt: '2026-11-11T12:00:00.000Z',
    userId: null,
    data: {},
    ...overrides,
  }
}

describe('createEventGuard', () => {
  it('applies an event once: a duplicate eventId is ignored', () => {
    const guard = createEventGuard()
    const event = envelope({ version: 5 })
    expect(guard.shouldApply(event, null)).toBe(true)
    expect(guard.shouldApply({ ...event }, null)).toBe(false)
  })

  it('ignores versions at or below the last applied version of the same resource', () => {
    const guard = createEventGuard()
    expect(guard.shouldApply(envelope({ version: 5 }), null)).toBe(true)
    expect(guard.shouldApply(envelope({ version: 4 }), null)).toBe(false)
    expect(guard.shouldApply(envelope({ version: 5 }), null)).toBe(false)
    expect(guard.shouldApply(envelope({ version: 6 }), null)).toBe(true)
  })

  it('tracks versions per resource (type + id)', () => {
    const guard = createEventGuard()
    expect(guard.shouldApply(envelope({ version: 5 }), null)).toBe(true)
    expect(guard.shouldApply(envelope({ version: 1, resource: { type: 'nft', id: 'nft_314' } }), null)).toBe(true)
    expect(
      guard.shouldApply(envelope({ version: 1, type: 'order.updated', resource: { type: 'order', id: 'nft_042' }, userId: 'usr_ana' }), 'usr_ana'),
    ).toBe(true)
  })

  it("drops another user's event and applies public and own events", () => {
    const guard = createEventGuard()
    const own = { type: 'order.updated' as const, resource: { type: 'order', id: 'ord_1' } }
    expect(guard.shouldApply(envelope({ ...own, userId: 'usr_bruno' }), 'usr_ana')).toBe(false)
    expect(guard.shouldApply(envelope({ ...own, userId: 'usr_bruno' }), null)).toBe(false)
    expect(guard.shouldApply(envelope({ ...own, userId: 'usr_ana' }), 'usr_ana')).toBe(true)
    expect(guard.shouldApply(envelope({ userId: null }), 'usr_ana')).toBe(true)
  })

  it('does not record rejected events', () => {
    const guard = createEventGuard()
    const foreign = envelope({ userId: 'usr_bruno', version: 9 })
    expect(guard.shouldApply(foreign, 'usr_ana')).toBe(false)
    // The same event later becomes applicable for its owner (e.g. after a user switch).
    expect(guard.shouldApply(foreign, 'usr_bruno')).toBe(true)
  })

  it('forgets the oldest eventIds beyond maxIds (LRU)', () => {
    const guard = createEventGuard({ maxIds: 2 })
    const first = envelope({ resource: { type: 'nft', id: 'a' }, version: 1 })
    guard.shouldApply(first, null)
    guard.shouldApply(envelope({ resource: { type: 'nft', id: 'b' }, version: 1 }), null)
    guard.shouldApply(envelope({ resource: { type: 'nft', id: 'c' }, version: 1 }), null)
    // The version barrier still blocks a plain replay...
    expect(guard.shouldApply(first, null)).toBe(false)
    // ...but the id itself was evicted: only the 2 most recent ids are remembered.
    expect(guard.shouldApply({ ...first, version: 2 }, null)).toBe(true)

    const kept = createEventGuard({ maxIds: 2 })
    kept.shouldApply(first, null)
    expect(kept.shouldApply({ ...first, version: 2 }, null)).toBe(false)
  })
})
