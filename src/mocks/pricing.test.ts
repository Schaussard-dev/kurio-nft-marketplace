import { describe, expect, it } from 'vitest'
import { quoteSchema } from '@/shared/contracts'
import { buildNfts } from './fixtures/nfts'
import { COUPON_SEEDS } from './fixtures/users'
import type { CartRecord } from './db/schema'
import { computeQuote, isQuoteError, NETWORK_FEES } from './pricing'

const NOW = new Date('2026-11-11T12:00:00.000Z')

function setup() {
  const db = { nfts: buildNfts(), coupons: COUPON_SEEDS.map((c) => ({ ...c })) }
  // Figma Carrinho: 2× Emerald Ape (1.19), 6× Violet Nomad (1.39), 9× Ivory Baron (1.79).
  const cart: CartRecord = {
    id: 'crt_test',
    owner: { type: 'guest', id: 'guest-1' },
    version: 3,
    lines: [
      { lineId: 'ln_1', nftId: 'nft_042', editionId: 'nft_042_e2', quantity: 2 },
      { lineId: 'ln_2', nftId: 'nft_314', editionId: 'nft_314_e2', quantity: 6 },
      { lineId: 'ln_3', nftId: 'nft_088', editionId: 'nft_088_e3', quantity: 9 },
    ],
  }
  return { db, cart }
}

function quoteOf(result: ReturnType<typeof computeQuote>) {
  if (isQuoteError(result)) throw new Error(`unexpected error ${result.code}`)
  return result
}

describe('computeQuote', () => {
  it('matches the Figma summary without a coupon on ethereum', () => {
    const { db, cart } = setup()
    const quote = quoteOf(computeQuote(db, cart, { network: 'ethereum', now: NOW }))
    expect(quote).toMatchObject({ subtotal: '26.83', discount: '0', networkFee: '0.016', total: '26.846', coupon: null })
    expect(quote.lines.map((l) => [l.lineId, l.unitPrice, l.quantity, l.lineTotal])).toEqual([
      ['ln_1', '1.19', 2, '2.38'],
      ['ln_2', '1.39', 6, '8.34'],
      ['ln_3', '1.79', 9, '16.11'],
    ])
    expect(quoteSchema.parse(quote)).toEqual(quote)
    expect(quote.expiresAt).toBe('2026-11-11T12:10:00.000Z')
  })

  it('applies KURIO10 as 10% of the subtotal (code is case-insensitive)', () => {
    const { db, cart } = setup()
    const quote = quoteOf(computeQuote(db, cart, { coupon: ' kurio10 ', network: 'ethereum', now: NOW }))
    expect(quote).toMatchObject({ discount: '2.683', total: '24.163', coupon: { code: 'KURIO10', percent: 10 } })
  })

  it('charges the fee of the chosen network', () => {
    const { db, cart } = setup()
    const quote = quoteOf(computeQuote(db, cart, { network: 'polygon', now: NOW }))
    expect(quote.networkFee).toBe(NETWORK_FEES.polygon)
    expect(quote.total).toBe('26.832')
  })

  it('rejects an expired coupon with COUPON_EXPIRED on the coupon field', () => {
    const { db, cart } = setup()
    const result = computeQuote(db, cart, { coupon: 'LANCAMENTO24', network: 'ethereum', now: NOW })
    expect(isQuoteError(result)).toBe(true)
    expect(result).toMatchObject({ status: 422, code: 'COUPON_EXPIRED', fieldErrors: { coupon: ['Cupom expirado'] } })
  })

  it('rejects an unknown coupon with COUPON_INVALID on the coupon field', () => {
    const { db, cart } = setup()
    const result = computeQuote(db, cart, { coupon: 'XYZ', network: 'ethereum', now: NOW })
    expect(result).toMatchObject({ status: 422, code: 'COUPON_INVALID', fieldErrors: { coupon: ['Cupom inválido'] } })
  })

  it('treats an empty coupon as no coupon', () => {
    const { db, cart } = setup()
    expect(quoteOf(computeQuote(db, cart, { coupon: '  ', network: 'ethereum', now: NOW })).coupon).toBeNull()
  })

  it('keeps the fingerprint stable and changes it when a unit price changes', () => {
    const { db, cart } = setup()
    const first = quoteOf(computeQuote(db, cart, { network: 'ethereum', now: NOW }))
    const again = quoteOf(computeQuote(db, cart, { network: 'ethereum', now: new Date(NOW.getTime() + 1000) }))
    expect(again.fingerprint).toBe(first.fingerprint)

    db.nfts.find((n) => n.id === 'nft_042')!.price = '1.29'
    const changed = quoteOf(computeQuote(db, cart, { network: 'ethereum', now: NOW }))
    expect(changed.fingerprint).not.toBe(first.fingerprint)
  })

  it('changes the fingerprint with availability, coupon and network', () => {
    const { db, cart } = setup()
    const base = quoteOf(computeQuote(db, cart, { network: 'ethereum', now: NOW })).fingerprint
    expect(quoteOf(computeQuote(db, cart, { coupon: 'KURIO10', network: 'ethereum', now: NOW })).fingerprint).not.toBe(base)
    expect(quoteOf(computeQuote(db, cart, { network: 'solana', now: NOW })).fingerprint).not.toBe(base)
    db.nfts.find((n) => n.id === 'nft_042')!.editions[1]!.available = 1
    expect(quoteOf(computeQuote(db, cart, { network: 'ethereum', now: NOW })).fingerprint).not.toBe(base)
  })

  it('skips lines whose NFT or edition no longer exists', () => {
    const { db, cart } = setup()
    cart.lines.push({ lineId: 'ln_x', nftId: 'nft_gone', editionId: 'nft_gone_e1', quantity: 1 })
    const quote = quoteOf(computeQuote(db, cart, { network: 'ethereum', now: NOW }))
    expect(quote.lines).toHaveLength(3)
  })
})
