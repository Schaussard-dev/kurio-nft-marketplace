import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { queryKeys } from '@/app/query-client'
import type { Cart, CatalogResponse, EventEnvelope, FavoritesResponse, NftDetail, NftSummary } from '@/shared/contracts'
import { applyNftUpdate } from './apply-nft-update'

function summary(id: string, name: string, price: string, version = 3): NftSummary {
  return {
    id,
    tokenNumber: Number(id.slice(4)),
    name,
    art: 'emerald',
    price,
    previousPrice: null,
    rare: false,
    category: 'arte-digital',
    network: 'ethereum',
    collection: 'Kurio Editions',
    createdAt: '2026-11-01T12:00:00.000Z',
    trendingScore: 1,
    version,
  }
}

const ape = summary('nft_042', 'Emerald Ape #042', '1.19')
const nomad = summary('nft_314', 'Violet Nomad #314', '1.39')

const edition = (id: string, available: number) => ({ id, label: '1/50' as const, available, maxPerOrder: 5 })

function catalogPage(items: NftSummary[]): CatalogResponse {
  return {
    items,
    page: 1,
    pageSize: 12,
    total: items.length,
    totalPages: 1,
    facets: { categories: [], networks: [], priceRange: { min: '0.1', max: '9' } },
  }
}

function detail(): NftDetail {
  return {
    ...ape,
    description: '',
    longDescription: '',
    attributes: [],
    contractAddress: '0x0',
    rating: 4,
    reviewCount: 0,
    editions: [edition('nft_042_e1', 0), edition('nft_042_e3', 15)],
    gallery: [],
    reviews: [],
  }
}

function cart(owner: Cart['owner'], quantity = 2): Cart {
  return {
    id: `crt_${owner.id}`,
    owner,
    version: 4,
    lines: [
      { lineId: 'ln_1', nftId: 'nft_042', editionId: 'nft_042_e3', quantity, nft: ape, edition: edition('nft_042_e3', 15) },
      { lineId: 'ln_2', nftId: 'nft_314', editionId: 'nft_314_e3', quantity: 1, nft: nomad, edition: edition('nft_314_e3', 4) },
    ],
  }
}

function event(data: { price: string; previousPrice?: string | null; editions?: { id: string; available: number }[] }, version = 4): EventEnvelope {
  return {
    eventId: `evt_${version}`,
    type: 'nft.updated',
    resource: { type: 'nft', id: 'nft_042' },
    version,
    occurredAt: '2026-11-11T12:00:00.000Z',
    userId: null,
    data: {
      price: data.price,
      previousPrice: data.previousPrice ?? '1.19',
      editions: data.editions ?? [
        { id: 'nft_042_e1', available: 0 },
        { id: 'nft_042_e3', available: 15 },
      ],
    },
  }
}

function seeded() {
  const qc = new QueryClient()
  const userCartKey = queryKeys.user('usr_ana').cart()
  const guestCartKey = queryKeys.guestCart('guest-1')
  const pageWithApe = queryKeys.nfts({ tab: 'all', page: 1 })
  const pageWithoutApe = queryKeys.nfts({ tab: 'all', page: 2 })
  qc.setQueryData(pageWithApe, catalogPage([nomad, ape]))
  qc.setQueryData(pageWithoutApe, catalogPage([nomad]))
  qc.setQueryData(queryKeys.nft('nft_042'), detail())
  qc.setQueryData(userCartKey, cart({ type: 'user', id: 'usr_ana' }))
  qc.setQueryData(guestCartKey, cart({ type: 'guest', id: 'guest-1' }))
  qc.setQueryData(queryKeys.user('usr_ana').favorites(), { nftIds: ['nft_042'], items: [ape] } satisfies FavoritesResponse)
  return { qc, userCartKey, guestCartKey, pageWithApe, pageWithoutApe }
}

describe('applyNftUpdate', () => {
  it('patches the catalog page, detail, carts and favorites and reports the cart price change', () => {
    const { qc, userCartKey, guestCartKey, pageWithApe, pageWithoutApe } = seeded()
    const untouchedPage = qc.getQueryData(pageWithoutApe)

    const result = applyNftUpdate(qc, event({ price: '1.29' }))

    expect(result.cartChange).toEqual({ name: 'Emerald Ape #042', from: '1.19', to: '1.29', soldOut: false })
    const page = qc.getQueryData<CatalogResponse>(pageWithApe)!
    expect(page.items.find((n) => n.id === 'nft_042')).toMatchObject({ price: '1.29', previousPrice: '1.19', version: 4 })
    expect(page.items.find((n) => n.id === 'nft_314')).toBe(nomad)
    expect(qc.getQueryData(pageWithoutApe)).toBe(untouchedPage)
    expect(qc.getQueryData<NftDetail>(queryKeys.nft('nft_042'))).toMatchObject({ price: '1.29', version: 4 })
    for (const key of [userCartKey, guestCartKey]) {
      const lines = qc.getQueryData<Cart>(key)!.lines
      expect(lines[0]!.nft).toMatchObject({ price: '1.29', version: 4 })
      expect(lines[1]!.nft).toBe(nomad)
    }
    expect(qc.getQueryData<FavoritesResponse>(queryKeys.user('usr_ana').favorites())!.items[0]).toMatchObject({ price: '1.29' })
  })

  it('updates edition availability in the detail and the cart line; sold out when the line edition hits 0', () => {
    const { qc, userCartKey } = seeded()
    const result = applyNftUpdate(
      qc,
      event({ price: '1.19', previousPrice: null, editions: [{ id: 'nft_042_e1', available: 0 }, { id: 'nft_042_e3', available: 0 }] }),
    )
    expect(result.cartChange).toEqual({ name: 'Emerald Ape #042', from: '1.19', to: '1.19', soldOut: true })
    expect(qc.getQueryData<Cart>(userCartKey)!.lines[0]!.edition.available).toBe(0)
    expect(qc.getQueryData<NftDetail>(queryKeys.nft('nft_042'))!.editions.map((e) => e.available)).toEqual([0, 0])

    applyNftUpdate(qc, event({ price: '1.19', editions: [{ id: 'nft_042_e3', available: 1 }] }, 5))
    expect(qc.getQueryData<Cart>(userCartKey)!.lines[0]!.edition.available).toBe(1)
  })

  it('never regresses data the cache already holds at the same or a newer version', () => {
    const { qc, userCartKey, pageWithApe } = seeded()
    applyNftUpdate(qc, event({ price: '1.39' }, 6))
    const stale = applyNftUpdate(qc, event({ price: '1.29' }, 5))
    expect(stale.cartChange).toBeNull()
    expect(qc.getQueryData<CatalogResponse>(pageWithApe)!.items[1]!.price).toBe('1.39')
    expect(qc.getQueryData<Cart>(userCartKey)!.lines[0]!.nft.price).toBe('1.39')
    expect(qc.getQueryData<NftDetail>(queryKeys.nft('nft_042'))!.price).toBe('1.39')
  })

  it('returns no cart change when the NFT is not in any cached cart, and marks quotes stale', async () => {
    const qc = new QueryClient()
    const quoteKey = queryKeys.quote('user:usr_ana', { network: 'ethereum', version: 4 })
    qc.setQueryData(quoteKey, { total: '1' })
    qc.setQueryData(queryKeys.nft('nft_042'), detail())
    expect(applyNftUpdate(qc, event({ price: '1.29' })).cartChange).toBeNull()
    expect(qc.getQueryState(quoteKey)!.isInvalidated).toBe(true)
  })

  it('cancels an in-flight (older) REST fetch so it cannot overwrite the event', async () => {
    const { qc, userCartKey } = seeded()
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const staleDetail = qc.fetchQuery({
      queryKey: queryKeys.nft('nft_042'),
      queryFn: () => gate.then(detail),
      staleTime: 0,
    })
    const staleCart = qc.fetchQuery({
      queryKey: userCartKey,
      queryFn: () => gate.then(() => cart({ type: 'user', id: 'usr_ana' })),
      staleTime: 0,
    })

    applyNftUpdate(qc, event({ price: '1.29' }))
    release()
    await Promise.allSettled([staleDetail, staleCart])

    expect(qc.getQueryData<NftDetail>(queryKeys.nft('nft_042'))!.price).toBe('1.29')
    expect(qc.getQueryData<Cart>(userCartKey)!.lines[0]!.nft.price).toBe('1.29')
    // The cancelled fetch is marked stale, so the next observer reads the server again.
    expect(qc.getQueryState(queryKeys.nft('nft_042'))!.isInvalidated).toBe(true)
  })

  it('ignores a payload that does not match the nft.updated contract', () => {
    const { qc, pageWithApe } = seeded()
    expect(applyNftUpdate(qc, { ...event({ price: '1.29' }), data: { price: 12 } }).cartChange).toBeNull()
    expect(qc.getQueryData<CatalogResponse>(pageWithApe)!.items[1]!.price).toBe('1.19')
  })
})
