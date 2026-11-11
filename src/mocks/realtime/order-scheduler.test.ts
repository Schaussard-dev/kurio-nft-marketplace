import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb, initDb, memoryStorage, mutate, setStorage } from '../db/store'
import type { CartRecord, OrderRecord } from '../db/schema'
import { bootScheduler, resetOrderScheduler, resolveDueOrders, scheduleOrder } from './order-scheduler'
import { resetRealtimeServer } from './server'

const NOW = Date.parse('2026-11-11T12:00:00.000Z')

function anaCart(): CartRecord {
  return getDb().carts.find((c) => c.owner.type === 'user' && c.owner.id === 'usr_ana')!
}

function sage() {
  return getDb().nfts.find((n) => n.id === 'nft_009')!
}

/** ana's cart holds 3× Sage Nomad #009; the order bought `quantity` of that edition. */
function seedOrder({
  quantity = 2,
  outcome = 'confirmed',
  resolveAt = NOW - 1,
}: { quantity?: number; outcome?: 'confirmed' | 'declined'; resolveAt?: number } = {}): OrderRecord {
  const edition = sage().editions.find((e) => e.label === '1/50')!
  mutate(() => {
    anaCart().lines = [{ lineId: 'line_sage', nftId: 'nft_009', editionId: edition.id, quantity: 3 }]
  })
  const order: OrderRecord = {
    id: `ord_${Math.random().toString(16).slice(2, 10)}`,
    status: 'pending',
    version: 1,
    createdAt: new Date(NOW - 3000).toISOString(),
    resolvedAt: null,
    declineReason: null,
    txHash: '0xabc',
    explorerUrl: 'https://explorer.kurio.example/testnet/tx/0xabc',
    idempotencyKey: '7d7b3c1e-4a0f-4a51-9d6f-8b8f7f6f2a10',
    snapshot: {
      lines: [
        {
          nftId: 'nft_009',
          editionId: edition.id,
          name: 'Sage Nomad #009',
          art: sage().art,
          tokenNumber: sage().tokenNumber,
          editionLabel: '1/50',
          unitPrice: sage().price,
          quantity,
          lineTotal: sage().price,
        },
      ],
      subtotal: '1.69',
      discount: '0',
      networkFee: '0.016',
      total: '1.706',
      walletLabel: 'Principal · 0xA91F…E82C',
      network: 'ethereum',
    },
    userId: 'usr_ana',
    payloadHash: 'hash',
    resolveAt: new Date(resolveAt).toISOString(),
    plannedOutcome: outcome,
  }
  mutate((db) => {
    db.orders.push(order)
    db.resourceVersions[`order:${order.id}`] = 1
  })
  return order
}

const stored = (id: string) => getDb().orders.find((o) => o.id === id)!
const sageAvailable = (editionId: string) => sage().editions.find((e) => e.id === editionId)!.available

beforeEach(async () => {
  setStorage(memoryStorage())
  await initDb()
})

afterEach(() => {
  resetOrderScheduler()
  resetRealtimeServer()
  vi.useRealTimers()
})

describe('resolveDueOrders', () => {
  it('confirms a due order: status, resolvedAt, version+1, stock decremented and the bought quantity left the cart', () => {
    const order = seedOrder({ quantity: 2 })
    const editionId = order.snapshot.lines[0].editionId
    const stockBefore = sageAvailable(editionId)

    expect(resolveDueOrders(NOW)).toEqual([order.id])

    expect(stored(order.id)).toMatchObject({ status: 'confirmed', version: 2, declineReason: null })
    expect(stored(order.id).resolvedAt).not.toBeNull()
    expect(sageAvailable(editionId)).toBe(stockBefore - 2)
    expect(anaCart().lines).toEqual([expect.objectContaining({ lineId: 'line_sage', quantity: 1 })])
  })

  it('removes a cart line whose whole quantity was bought', () => {
    seedOrder({ quantity: 3 })
    resolveDueOrders(NOW)
    expect(anaCart().lines).toEqual([])
  })

  it('declines with a reason and leaves cart and stock untouched', () => {
    const order = seedOrder({ outcome: 'declined' })
    const editionId = order.snapshot.lines[0].editionId
    const stockBefore = sageAvailable(editionId)

    resolveDueOrders(NOW)

    expect(stored(order.id).status).toBe('declined')
    expect(stored(order.id).declineReason).toEqual(expect.any(String))
    expect(sageAvailable(editionId)).toBe(stockBefore)
    expect(anaCart().lines).toEqual([expect.objectContaining({ quantity: 3 })])
  })

  it('never resolves a terminal order twice (stock decremented once)', () => {
    const order = seedOrder({ quantity: 1 })
    const editionId = order.snapshot.lines[0].editionId
    const stockBefore = sageAvailable(editionId)

    resolveDueOrders(NOW)
    expect(resolveDueOrders(NOW + 10_000)).toEqual([])

    expect(sageAvailable(editionId)).toBe(stockBefore - 1)
    expect(stored(order.id).version).toBe(2)
    expect(anaCart().lines).toEqual([expect.objectContaining({ quantity: 2 })])
  })

  it('leaves orders that are not due yet pending', () => {
    const order = seedOrder({ resolveAt: NOW + 1000 })
    expect(resolveDueOrders(NOW)).toEqual([])
    expect(stored(order.id).status).toBe('pending')
  })
})

describe('scheduleOrder', () => {
  it('resolves the order when its resolveAt arrives', () => {
    vi.useFakeTimers({ now: NOW })
    const order = seedOrder({ resolveAt: NOW + 2500 })
    scheduleOrder(order)
    vi.advanceTimersByTime(2499)
    expect(stored(order.id).status).toBe('pending')
    vi.advanceTimersByTime(1)
    expect(stored(order.id).status).toBe('confirmed')
  })
})

describe('bootScheduler', () => {
  it('resolves the orders already due and reschedules the future ones (pending survives a reload)', () => {
    vi.useFakeTimers({ now: NOW })
    const due = seedOrder({ resolveAt: NOW - 5000 })
    const later = seedOrder({ resolveAt: NOW + 1000 })
    bootScheduler()
    expect(stored(due.id).status).toBe('confirmed')
    expect(stored(later.id).status).toBe('pending')
    vi.advanceTimersByTime(1000)
    expect(stored(later.id).status).toBe('confirmed')
  })
})
