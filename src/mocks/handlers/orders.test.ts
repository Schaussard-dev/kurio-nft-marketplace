import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { orderSchema, quoteSchema, type CreateOrderInput, type Quote } from '@/shared/contracts'
import type { CartRecord, MockDb } from '../db/schema'
import { createSeed } from '../db/seed'
import { computeQuote, isQuoteError } from '../pricing'
import { placeOrder, payloadHashOf } from './orders'

let seed: MockDb
let db: MockDb
const now = new Date('2026-11-11T12:00:00.000Z')

beforeAll(async () => {
  seed = await createSeed()
})

function anaCart(state: MockDb): CartRecord {
  return state.carts.find((c) => c.owner.type === 'user' && c.owner.id === 'usr_ana')!
}

function quoteFor(state: MockDb, at = now): Quote {
  const quote = computeQuote(state, anaCart(state), { network: 'ethereum', now: at })
  if (isQuoteError(quote)) throw new Error(quote.message)
  state.quotes.push({ cartId: anaCart(state).id, quote })
  return quote
}

function inputFor(quote: Quote, overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    quoteId: quote.quoteId,
    walletId: 'wlt_ana_primary',
    network: 'ethereum',
    payer: {
      displayName: 'Ana Souza',
      username: 'ana',
      profileName: 'ana',
      email: 'ana@kurio.dev',
      ensName: 'ana.kurio.eth',
      referralCode: 'KURIO-ANA',
      walletAddress: '0xA91F3c2d4E5f60718293a4b5C6d7E8f90123E82C',
    },
    ...overrides,
  }
}

function place(input: CreateOrderInput, key = 'k-1', outcome: 'confirmed' | 'declined' = 'confirmed') {
  const user = db.users.find((u) => u.id === 'usr_ana')!
  return placeOrder(db, { user, cart: anaCart(db), key, input, payloadHash: payloadHashOf(input), now, outcome })
}

describe('placeOrder', () => {
  beforeEach(() => {
    db = structuredClone(seed)
  })

  it('creates a pending order with an immutable snapshot of the quote, resolveAt +2.5 s and the planned outcome', () => {
    const quote = quoteFor(db)
    const result = place(inputFor(quote), 'k-1', 'declined')
    if (!('order' in result)) throw new Error(result.error.code)
    expect(result.created).toBe(true)
    const { order } = result
    expect(orderSchema.safeParse(order).success).toBe(true)
    expect(order.status).toBe('pending')
    expect(order.snapshot.total).toBe(quote.total)
    expect(order.snapshot.lines).toEqual([
      expect.objectContaining({ nftId: 'nft_009', name: 'Sage Nomad #009', editionLabel: '1/50', quantity: 1 }),
    ])
    expect(order.snapshot.network).toBe('ethereum')
    expect(order.resolveAt).toBe('2026-11-11T12:00:02.500Z')
    expect(order.plannedOutcome).toBe('declined')
    expect(db.orders).toHaveLength(1)
    expect(db.idempotency).toEqual([{ key: 'k-1', userId: 'usr_ana', payloadHash: order.payloadHash, orderId: order.id }])
  })

  it('same key + same payload returns the same order; same key + another payload is IDEMPOTENCY_CONFLICT', () => {
    const quote = quoteFor(db)
    const first = place(inputFor(quote))
    const again = place(inputFor(quote))
    if (!('order' in first) || !('order' in again)) throw new Error('expected orders')
    expect(again.created).toBe(false)
    expect(again.order.id).toBe(first.order.id)
    expect(db.orders).toHaveLength(1)

    const conflict = place(inputFor(quote, { note: 'outro' }))
    expect(conflict).toMatchObject({ error: { status: 409, code: 'IDEMPOTENCY_CONFLICT' } })
  })

  it('answers QUOTE_STALE with the new quote when the price changed since the quote', () => {
    const quote = quoteFor(db)
    db.nfts.find((n) => n.id === 'nft_009')!.price = '9.99'
    const result = place(inputFor(quote))
    expect(result).toMatchObject({ error: { status: 409, code: 'QUOTE_STALE' } })
    if ('order' in result) throw new Error('expected an error')
    const fresh = quoteSchema.parse((result.error.details as { quote: unknown }).quote)
    expect(fresh.lines[0].unitPrice).toBe('9.99')
    expect(fresh.quoteId).not.toBe(quote.quoteId)
    // The new quote is stored, so confirming it creates the order.
    const confirmed = place(inputFor(fresh), 'k-2')
    expect(confirmed).toHaveProperty('order.snapshot.lines.0.unitPrice', '9.99')
  })

  it('treats an unknown quote or another network as stale', () => {
    const quote = quoteFor(db)
    expect(place(inputFor({ ...quote, quoteId: 'qt_unknown' }))).toMatchObject({ error: { code: 'QUOTE_STALE' } })
    expect(
      place(
        inputFor(quote, {
          walletId: null,
          network: 'polygon',
        }),
        'k-3',
      ),
    ).toMatchObject({ error: { code: 'QUOTE_STALE' } })
  })

  it('answers OUT_OF_STOCK when a line exceeds the stock', () => {
    const quote = quoteFor(db)
    db.nfts.find((n) => n.id === 'nft_009')!.editions.find((e) => e.id === 'nft_009_e3')!.available = 0
    expect(place(inputFor(quote))).toMatchObject({ error: { status: 409, code: 'OUT_OF_STOCK' } })
    expect(db.orders).toHaveLength(0)
  })

  it('a stock-only change is not QUOTE_STALE: enough stock left creates the order from the reviewed quote', () => {
    const quote = quoteFor(db)
    db.nfts.find((n) => n.id === 'nft_009')!.editions.find((e) => e.id === 'nft_009_e3')!.available = 1
    const result = place(inputFor(quote))
    expect(result).toHaveProperty('order.snapshot.total', quote.total)
  })

  it('requires the payer address to be the address of the registered wallet it names', () => {
    const quote = quoteFor(db)
    const input = inputFor(quote)
    const other = { ...input, payer: { ...input.payer, walletAddress: '0x1234567890abcdef1234567890abcdef12345678' } }
    expect(place(other)).toMatchObject({ error: { status: 422, fieldErrors: { walletAddress: [expect.any(String)] } } })
    expect(db.orders).toHaveLength(0)
  })

  it('validates the wallet: foreign wallet id, network mismatch and an address invalid for the network', () => {
    const quote = quoteFor(db)
    expect(place(inputFor(quote, { walletId: 'wlt_bruno_primary' }))).toMatchObject({
      error: { status: 422, code: 'VALIDATION_ERROR' },
    })
    expect(place(inputFor(quote, { walletId: 'wlt_ana_secondary' }), 'k-4')).toMatchObject({
      error: { status: 422, fieldErrors: { network: [expect.any(String)] } },
    })
    const manual = inputFor(quote, { walletId: null })
    expect(
      place({ ...manual, payer: { ...manual.payer, walletAddress: 'not-an-address' } }, 'k-5'),
    ).toMatchObject({ error: { status: 422, fieldErrors: { walletAddress: [expect.any(String)] } } })
  })
})
