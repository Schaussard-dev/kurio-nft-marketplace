import { describe, expect, it } from 'vitest'
import type { FavoritesResponse, NftSummary } from '@/shared/contracts'
import { applyFavorite, revertFavorite } from './cache'

const summary = (id: string): NftSummary => ({
  id,
  tokenNumber: 1,
  name: `NFT ${id}`,
  art: 'emerald',
  price: '1.00',
  previousPrice: null,
  rare: false,
  category: 'arte-digital',
  network: 'ethereum',
  collection: 'Kurio Apes',
  createdAt: '2026-11-01T12:00:00.000Z',
  trendingScore: 50,
  version: 1,
})

const data: FavoritesResponse = { nftIds: ['nft_042'], items: [summary('nft_042')] }

describe('applyFavorite', () => {
  it('adds the id and, when known, the summary first', () => {
    const next = applyFavorite(data, { nftId: 'nft_009', favorite: true, summary: summary('nft_009') })
    expect(next.nftIds).toEqual(['nft_009', 'nft_042'])
    expect(next.items.map((n) => n.id)).toEqual(['nft_009', 'nft_042'])
  })

  it('adds only the id when the summary is unknown', () => {
    const next = applyFavorite(data, { nftId: 'nft_009', favorite: true })
    expect(next.nftIds).toContain('nft_009')
    expect(next.items.map((n) => n.id)).toEqual(['nft_042'])
  })

  it('removes the id and the item', () => {
    expect(applyFavorite(data, { nftId: 'nft_042', favorite: false })).toEqual({ nftIds: [], items: [] })
  })

  it('is idempotent and never mutates the input', () => {
    const next = applyFavorite(data, { nftId: 'nft_042', favorite: true, summary: summary('nft_042') })
    expect(next).toEqual(data)
    expect(data.nftIds).toEqual(['nft_042'])
  })

  it('starts from an empty list when there is no cached data', () => {
    expect(applyFavorite(undefined, { nftId: 'nft_009', favorite: true }).nftIds).toEqual(['nft_009'])
  })
})

describe('revertFavorite', () => {
  it('undoes only the failed change, keeping concurrent changes to other NFTs', () => {
    const failed = { nftId: 'nft_009', favorite: true, summary: summary('nft_009') }
    // nft_552 was toggled on concurrently after the failed change.
    const current = applyFavorite(applyFavorite(data, failed), { nftId: 'nft_552', favorite: true, summary: summary('nft_552') })
    const reverted = revertFavorite(current, failed, data)
    expect(reverted.nftIds).toEqual(['nft_552', 'nft_042'])
    expect(reverted.items.map((n) => n.id)).toEqual(['nft_552', 'nft_042'])
  })

  it('restores a failed removal with the summary from the snapshot', () => {
    const failed = { nftId: 'nft_042', favorite: false }
    const reverted = revertFavorite(applyFavorite(data, failed), failed, data)
    expect(reverted).toEqual(data)
  })
})
