import { describe, expect, it } from 'vitest'
import { favoritesResponseSchema, nftDetailSchema } from '@/shared/contracts'
import { buildNfts } from '../fixtures/nfts'
import type { FavoriteRecord } from '../db/schema'
import { listFavorites } from './favorites'
import { toDetail } from './nfts'

const nfts = buildNfts()

describe('listFavorites', () => {
  const favorites: FavoriteRecord[] = [
    { userId: 'usr_ana', nftId: 'nft_042' },
    { userId: 'usr_ana', nftId: 'nft_009' },
    { userId: 'usr_bruno', nftId: 'nft_552' },
    { userId: 'usr_ana', nftId: 'nft_gone' },
  ]

  it("returns only the user's favorites, newest first, as contract summaries", () => {
    const result = listFavorites({ nfts, favorites }, 'usr_ana')
    expect(favoritesResponseSchema.safeParse(result).success).toBe(true)
    expect(result.nftIds).toEqual(['nft_009', 'nft_042'])
    expect(result.items.map((n) => n.id)).toEqual(['nft_009', 'nft_042'])
    expect(result.items[0]).not.toHaveProperty('editions')
  })

  it('is empty for a user without favorites', () => {
    expect(listFavorites({ nfts, favorites }, 'usr_nobody')).toEqual({ nftIds: [], items: [] })
  })
})

describe('toDetail', () => {
  it('returns exactly the detail contract', () => {
    const detail = toDetail({ ...nfts[0]!, extra: 'internal' } as never)
    expect(nftDetailSchema.safeParse(detail).success).toBe(true)
    expect(detail).not.toHaveProperty('extra')
    expect(detail.reviews).toHaveLength(19)
  })
})
