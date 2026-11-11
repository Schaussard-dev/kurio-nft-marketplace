import { describe, expect, it } from 'vitest'
import { cartSchema } from '@/shared/contracts'
import { buildNfts } from '../fixtures/nfts'
import type { CartRecord } from '../db/schema'
import { lineLimit, mergeGuestLines, toCartResponse } from './cart'

function setup() {
  const db = { nfts: buildNfts() }
  const user: CartRecord = {
    id: 'crt_usr_ana',
    owner: { type: 'user', id: 'usr_ana' },
    version: 1,
    lines: [{ lineId: 'ln_ana', nftId: 'nft_009', editionId: 'nft_009_e3', quantity: 1 }],
  }
  const guest: CartRecord = { id: 'crt_guest', owner: { type: 'guest', id: 'g-1' }, version: 4, lines: [] }
  let next = 0
  const newLineId = () => `ln_new_${++next}`
  return { db, user, guest, newLineId }
}

describe('lineLimit', () => {
  it('is the lower of availability and the per-order cap', () => {
    expect(lineLimit({ id: 'e', label: '1/10', available: 3, maxPerOrder: 10 })).toBe(3)
    expect(lineLimit({ id: 'e', label: '1/10', available: 9, maxPerOrder: 4 })).toBe(4)
  })
})

describe('mergeGuestLines', () => {
  it('adds guest lines and sums quantities of the same NFT edition', () => {
    const { db, user, guest, newLineId } = setup()
    guest.lines.push(
      { lineId: 'g1', nftId: 'nft_009', editionId: 'nft_009_e3', quantity: 2 },
      { lineId: 'g2', nftId: 'nft_042', editionId: 'nft_042_e2', quantity: 2 },
    )
    const adjustments = mergeGuestLines(db, user, guest, newLineId)
    expect(adjustments).toEqual([])
    expect(user.lines).toEqual([
      { lineId: 'ln_ana', nftId: 'nft_009', editionId: 'nft_009_e3', quantity: 3 },
      { lineId: 'ln_new_1', nftId: 'nft_042', editionId: 'nft_042_e2', quantity: 2 },
    ])
  })

  it('clamps merged quantities to the available stock and reports the adjustment', () => {
    const { db, user, guest, newLineId } = setup()
    db.nfts.find((n) => n.id === 'nft_042')!.editions[2]!.available = 3
    guest.lines.push({ lineId: 'g1', nftId: 'nft_042', editionId: 'nft_042_e3', quantity: 10 })
    const adjustments = mergeGuestLines(db, user, guest, newLineId)
    expect(adjustments).toEqual([
      { lineId: 'ln_new_1', nftId: 'nft_042', name: 'Emerald Ape #042', requested: 10, applied: 3, reason: 'stock' },
    ])
    expect(user.lines.find((l) => l.editionId === 'nft_042_e3')?.quantity).toBe(3)
  })

  it('drops a line whose edition sold out and reports applied 0', () => {
    const { db, user, guest, newLineId } = setup()
    db.nfts.find((n) => n.id === 'nft_009')!.editions[2]!.available = 0
    guest.lines.push({ lineId: 'g1', nftId: 'nft_009', editionId: 'nft_009_e3', quantity: 1 })
    const adjustments = mergeGuestLines(db, user, guest, newLineId)
    expect(adjustments).toEqual([
      { lineId: 'ln_ana', nftId: 'nft_009', name: 'Sage Nomad #009', requested: 2, applied: 0, reason: 'stock' },
    ])
    expect(user.lines).toEqual([])
  })

  it('ignores guest lines whose NFT no longer exists', () => {
    const { db, user, guest, newLineId } = setup()
    guest.lines.push({ lineId: 'g1', nftId: 'nft_gone', editionId: 'x', quantity: 1 })
    expect(mergeGuestLines(db, user, guest, newLineId)).toEqual([])
    expect(user.lines).toHaveLength(1)
  })
})

describe('toCartResponse', () => {
  it('joins NFT summary and edition and satisfies the contract', () => {
    const { db, user } = setup()
    const cart = toCartResponse(db, user)
    expect(cartSchema.parse(cart)).toEqual(cart)
    expect(cart.lines[0]).toMatchObject({ nft: { name: 'Sage Nomad #009', price: '1.69' }, edition: { label: '1/50' } })
  })
})
