import { describe, expect, it } from 'vitest'
import type { Cart } from '@/shared/contracts'
import { buildNfts } from '@/mocks/fixtures/nfts'
import { cartItemCount, outOfStockMessage, setLineQuantity, stockIssues } from './cache'

const [ape] = buildNfts()
const summary = { ...ape!, reviews: undefined }
const line = (lineId: string, quantity: number, available = 4) => ({
  lineId,
  nftId: ape!.id,
  editionId: `${ape!.id}_e2`,
  quantity,
  nft: summary,
  edition: { id: `${ape!.id}_e2`, label: '1/10' as const, available, maxPerOrder: 4 },
})
const cart: Cart = { id: 'c', owner: { type: 'guest', id: 'g' }, version: 1, lines: [line('a', 2), line('b', 1)] }

describe('cart cache helpers', () => {
  it('sets one line quantity immutably', () => {
    const next = setLineQuantity(cart, 'a', 3)
    expect(next?.lines.map((l) => l.quantity)).toEqual([3, 1])
    expect(cart.lines[0]!.quantity).toBe(2)
    expect(setLineQuantity(undefined, 'a', 3)).toBeUndefined()
  })

  it('counts items as the sum of quantities', () => {
    expect(cartItemCount(cart)).toBe(3)
    expect(cartItemCount(undefined)).toBe(0)
  })

  it('pluralizes the stock message', () => {
    expect(outOfStockMessage(1)).toBe('Apenas 1 disponível')
    expect(outOfStockMessage(3)).toBe('Apenas 3 disponíveis')
    expect(outOfStockMessage(0)).toBe('Esgotado')
  })

  it('lists lines whose quantity exceeds the stock', () => {
    const short: Cart = { ...cart, lines: [line('a', 2, 1), line('b', 1, 0), line('c', 1, 5)] }
    expect(stockIssues(short)).toEqual([
      { lineId: 'a', name: ape!.name, available: 1 },
      { lineId: 'b', name: ape!.name, available: 0 },
    ])
  })
})
