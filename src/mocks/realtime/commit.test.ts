import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eventEnvelopeSchema, nftUpdatedDataSchema, orderUpdatedDataSchema, type EventEnvelope } from '@/shared/contracts'
import { getDb, initDb, memoryStorage, mutate, setStorage } from '../db/store'
import type { OrderRecord } from '../db/schema'
import { MAX_EVENT_LOG, commitNftUpdate, commitOrderUpdate, commitWalletDisconnect, replayEvent } from './commit'
import {
  dropAll,
  isDropped,
  registerConnection,
  resetRealtimeServer,
  resolveUserId,
  restore,
  type SocketIoDuplex,
} from './server'

/** Minimal stand-in for the binding's duplex connection: records emits and closes. */
function fakeConnection() {
  const emitted: Array<[string, EventEnvelope]> = []
  let closed = false
  const io = {
    client: { emit: (type: string, envelope: EventEnvelope) => emitted.push([type, envelope]) },
    rawClient: { send: vi.fn(), close: () => (closed = true), addEventListener: vi.fn() },
  } as unknown as SocketIoDuplex
  return { io, emitted, isClosed: () => closed }
}

function seedOrder(): OrderRecord {
  const order: OrderRecord = {
    id: 'ord_test',
    status: 'pending',
    version: 1,
    createdAt: '2026-11-11T10:00:00.000Z',
    resolvedAt: null,
    declineReason: null,
    txHash: '0xabc',
    explorerUrl: 'https://etherscan.io/tx/0xabc',
    snapshot: {
      lines: [],
      subtotal: '1.19',
      discount: '0',
      networkFee: '0.016',
      total: '1.206',
      walletLabel: 'MetaMask',
      network: 'ethereum',
    },
    userId: 'usr_ana',
    idempotencyKey: 'key-1',
    payloadHash: 'hash',
    resolveAt: '2026-11-11T10:00:02.500Z',
    plannedOutcome: 'confirmed',
  }
  mutate((db) => {
    db.orders.push(order)
  })
  return getDb().orders.find((o) => o.id === order.id)!
}

beforeEach(async () => {
  setStorage(memoryStorage())
  await initDb()
})

afterEach(() => {
  resetRealtimeServer()
  vi.useRealTimers()
})

describe('commitNftUpdate', () => {
  it('builds a valid envelope, updates the DB, bumps the version and logs the event', () => {
    const envelope = commitNftUpdate('nft_042', { price: '1.29' })

    expect(eventEnvelopeSchema.parse(envelope)).toEqual(envelope)
    expect(envelope).toMatchObject({ type: 'nft.updated', resource: { type: 'nft', id: 'nft_042' }, userId: null })
    expect(envelope.eventId).toMatch(/^[0-9a-f-]{36}$/)
    const data = nftUpdatedDataSchema.parse(envelope.data)
    expect(data).toMatchObject({ price: '1.29', previousPrice: '1.19' })

    const nft = getDb().nfts.find((n) => n.id === 'nft_042')!
    expect(nft.price).toBe('1.29')
    expect(nft.previousPrice).toBe('1.19')
    expect(envelope.version).toBe(2)
    expect(nft.version).toBe(2)
    expect(getDb().eventLog).toEqual([envelope.eventId])

    const second = commitNftUpdate('nft_042', { price: '1.39' })
    expect(second.version).toBe(3)
    expect(second.data).toMatchObject({ price: '1.39', previousPrice: '1.29' })
    expect(getDb().eventLog).toEqual([envelope.eventId, second.eventId])
  })

  it('updates edition availability without touching the price', () => {
    const nft = getDb().nfts.find((n) => n.id === 'nft_042')!
    const editionId = nft.editions[0]!.id
    const envelope = commitNftUpdate('nft_042', { editions: [{ id: editionId, available: 0 }] })
    expect(nft.editions[0]!.available).toBe(0)
    expect(nft.price).toBe('1.19')
    expect(nftUpdatedDataSchema.parse(envelope.data).editions).toContainEqual({ id: editionId, available: 0 })
  })

  it('rejects invalid patches and unknown resources without side effects', () => {
    expect(() => commitNftUpdate('nft_042', { price: '-1' })).toThrow()
    expect(() => commitNftUpdate('nft_999', { price: '1.00' })).toThrow(/Unknown NFT/)
    expect(() => commitNftUpdate('nft_042', { editions: [{ id: 'nope', available: 1 }] })).toThrow(/Unknown edition/)
    expect(getDb().eventLog).toEqual([])
    expect(getDb().nfts.find((n) => n.id === 'nft_042')!.version).toBe(1)
  })

  it('broadcasts to guests and users alike', () => {
    const guest = fakeConnection()
    const ana = fakeConnection()
    registerConnection(null, guest.io)
    registerConnection('usr_ana', ana.io)
    const envelope = commitNftUpdate('nft_042', { price: '1.29' })
    expect(guest.emitted).toEqual([['nft.updated', envelope]])
    expect(ana.emitted).toEqual([['nft.updated', envelope]])
  })

  it('keeps the persisted event log bounded', () => {
    mutate((db) => {
      db.eventLog = Array.from({ length: MAX_EVENT_LOG }, (_, i) => `old-${i}`)
    })
    const envelope = commitNftUpdate('nft_042', { price: '1.29' })
    expect(getDb().eventLog).toHaveLength(MAX_EVENT_LOG)
    expect(getDb().eventLog.at(-1)).toBe(envelope.eventId)
    expect(getDb().eventLog[0]).toBe('old-1')
  })
})

describe('commitOrderUpdate', () => {
  it('emits only to the owner, with the public order shape and a bumped version', () => {
    seedOrder()
    const ana = fakeConnection()
    const bruno = fakeConnection()
    const guest = fakeConnection()
    registerConnection('usr_ana', ana.io)
    registerConnection('usr_bruno', bruno.io)
    registerConnection(null, guest.io)

    const resolvedAt = '2026-11-11T10:00:03.000Z'
    const envelope = commitOrderUpdate('ord_test', { status: 'confirmed', resolvedAt })

    expect(eventEnvelopeSchema.parse(envelope)).toEqual(envelope)
    expect(envelope).toMatchObject({ type: 'order.updated', userId: 'usr_ana', version: 2 })
    const data = orderUpdatedDataSchema.parse(envelope.data)
    expect(data.status).toBe('confirmed')
    expect(data.order).toMatchObject({ status: 'confirmed', resolvedAt, version: 2 })
    expect(data.order).not.toHaveProperty('userId')
    expect(data.order).not.toHaveProperty('plannedOutcome')
    expect(getDb().orders[0]!.status).toBe('confirmed')

    expect(ana.emitted).toEqual([['order.updated', envelope]])
    expect(bruno.emitted).toEqual([])
    expect(guest.emitted).toEqual([])
  })
})

describe('commitWalletDisconnect', () => {
  it('emits wallet.disconnected to that user only', () => {
    const ana = fakeConnection()
    const bruno = fakeConnection()
    registerConnection('usr_ana', ana.io)
    registerConnection('usr_bruno', bruno.io)
    const envelope = commitWalletDisconnect('usr_ana')
    expect(eventEnvelopeSchema.parse(envelope)).toEqual(envelope)
    expect(ana.emitted).toEqual([['wallet.disconnected', envelope]])
    expect(bruno.emitted).toEqual([])
  })
})

describe('replayEvent', () => {
  it('re-sends the exact same envelope to the original audience', () => {
    const ana = fakeConnection()
    registerConnection('usr_ana', ana.io)
    const envelope = commitNftUpdate('nft_042', { price: '1.29' })
    expect(replayEvent(envelope.eventId)).toBe(true)
    expect(ana.emitted).toEqual([
      ['nft.updated', envelope],
      ['nft.updated', envelope],
    ])
    expect(replayEvent('unknown')).toBe(false)
  })
})

describe('mock socket server', () => {
  it('dropAll closes every connection and stops delivering to it until restore', () => {
    const ana = fakeConnection()
    registerConnection('usr_ana', ana.io)
    dropAll()
    expect(ana.isClosed()).toBe(true)
    expect(isDropped()).toBe(true)
    commitNftUpdate('nft_042', { price: '1.29' })
    expect(ana.emitted).toEqual([])
    restore()
    expect(isDropped()).toBe(false)
  })

  it('a timed drop restores by itself', () => {
    vi.useFakeTimers()
    dropAll(2)
    vi.advanceTimersByTime(1999)
    expect(isDropped()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(isDropped()).toBe(false)
  })

  it('pings each connection every 25s', () => {
    vi.useFakeTimers()
    const ana = fakeConnection()
    registerConnection('usr_ana', ana.io)
    vi.advanceTimersByTime(50_000)
    expect(ana.io.rawClient.send).toHaveBeenCalledTimes(2)
    expect(ana.io.rawClient.send).toHaveBeenCalledWith('2')
  })

  it('resolves only valid, unexpired session tokens', () => {
    mutate((db) => {
      db.sessions.push(
        { token: 'live', userId: 'usr_ana', expiresAt: new Date(Date.now() + 60_000).toISOString() },
        { token: 'dead', userId: 'usr_bruno', expiresAt: new Date(Date.now() - 1).toISOString() },
      )
    })
    expect(resolveUserId('live')).toBe('usr_ana')
    expect(resolveUserId('dead')).toBeNull()
    expect(resolveUserId('missing')).toBeNull()
    expect(resolveUserId('')).toBeNull()
    expect(resolveUserId(null)).toBeNull()
  })
})
