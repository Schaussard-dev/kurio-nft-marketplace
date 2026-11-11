import { describe, expect, it } from 'vitest'
import { catalogQuerySchema, catalogResponseSchema } from '@/shared/contracts'
import { compare } from '@/shared/lib/money'
import { buildNfts, SEED_NOW } from '../fixtures/nfts'
import { queryCatalog } from './nfts'

const nfts = buildNfts()
const run = (query: Record<string, unknown>) => queryCatalog(nfts, catalogQuerySchema.parse(query))

describe('queryCatalog', () => {
  it('returns a valid first page of 9 in listing order (Figma NFTs first)', () => {
    const result = run({})
    expect(catalogResponseSchema.safeParse(result).success).toBe(true)
    expect(result.items).toHaveLength(9)
    expect(result).toMatchObject({ page: 1, pageSize: 9, total: 60, totalPages: 7 })
    expect(result.items.slice(0, 3).map((n) => n.name)).toEqual(['Emerald Ape #042', 'Sage Nomad #009', 'Neon Vessel #552'])
    // Summaries only: detail fields stay out of the list payload.
    expect(result.items[0]).not.toHaveProperty('editions')
  })

  it('matches q on name or collection, case- and accent-insensitive', () => {
    expect(run({ q: 'GOLDEN' }).items.map((n) => n.name)).toEqual(
      expect.arrayContaining(['Golden Beat #207', 'Golden Frequency #071', 'Golden Signal #160']),
    )
    expect(run({ q: 'golden' }).total).toBe(3)
    expect(run({ q: 'gólden' }).total).toBe(3)
    expect(run({ q: 'kurio apes' }).items.every((n) => n.collection === 'Kurio Apes')).toBe(true)
  })

  it('ORs values within a group and ANDs across groups', () => {
    const result = run({ categories: ['musica'], networks: ['polygon'], pageSize: 48 })
    expect(result.total).toBeGreaterThan(0)
    expect(result.items.every((n) => n.category === 'musica' && n.network === 'polygon')).toBe(true)

    const either = run({ categories: ['musica', 'jogos'], pageSize: 48 })
    expect(either.total).toBe(nfts.filter((n) => n.category === 'musica' || n.category === 'jogos').length)
  })

  it('filters the price range inclusively', () => {
    const result = run({ minPrice: '1.19', maxPrice: '1.69', pageSize: 48 })
    const prices = result.items.map((n) => n.price)
    expect(prices).toEqual(expect.arrayContaining(['1.19', '1.69']))
    expect(prices.every((p) => compare(p, '1.19') >= 0 && compare(p, '1.69') <= 0)).toBe(true)
  })

  it('applies the new and trending tabs', () => {
    const cutoff = Date.parse(SEED_NOW) - 30 * 86_400_000
    const fresh = run({ tab: 'new', pageSize: 48 })
    expect(fresh.total).toBe(nfts.filter((n) => Date.parse(n.createdAt) >= cutoff).length)
    expect(fresh.items.every((n) => Date.parse(n.createdAt) >= cutoff)).toBe(true)
    const trending = run({ tab: 'trending', pageSize: 48 })
    expect(trending.items.every((n) => n.trendingScore >= 70)).toBe(true)
  })

  it('sorts by price and name', () => {
    const asc = run({ sort: 'price-asc', pageSize: 48 }).items.map((n) => n.price)
    expect(asc.every((p, i) => i === 0 || compare(asc[i - 1]!, p) <= 0)).toBe(true)
    const desc = run({ sort: 'price-desc' }).items
    expect(desc[0]!.price).toBe('12.30')
    const names = run({ sort: 'name', pageSize: 48 }).items.map((n) => n.name)
    expect([...names].sort((a, b) => a.localeCompare(b, 'pt-BR'))).toEqual(names)
  })

  it('paginates and reports an empty page past the end', () => {
    const last = run({ page: 7 })
    expect(last.items).toHaveLength(60 - 6 * 9)
    expect(run({ page: 9 }).items).toHaveLength(0)
  })

  it('computes facets over the result set ignoring the facet own group', () => {
    const result = run({ categories: ['musica'], networks: ['polygon'] })
    const musicaAllNetworks = nfts.filter((n) => n.category === 'musica').length
    const polygonAllCategories = nfts.filter((n) => n.network === 'polygon').length
    // Network counts ignore the network filter (but respect categories) and vice versa.
    const networkTotal = result.facets.networks.reduce((acc, f) => acc + f.count, 0)
    const categoryTotal = result.facets.categories.reduce((acc, f) => acc + f.count, 0)
    expect(networkTotal).toBe(musicaAllNetworks)
    expect(categoryTotal).toBe(polygonAllCategories)
    expect(result.facets.categories).toHaveLength(9)
    expect(result.facets.categories.find((c) => c.id === 'musica')?.label).toBe('Música')
    expect(run({}).facets.priceRange).toEqual({ min: '0.02', max: '12.30' })
  })

  it('handles an empty catalog', () => {
    const result = queryCatalog([], catalogQuerySchema.parse({}))
    expect(catalogResponseSchema.safeParse(result).success).toBe(true)
    expect(result).toMatchObject({ total: 0, totalPages: 0, items: [] })
  })
})
