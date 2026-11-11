import { http, HttpResponse } from 'msw'
import {
  catalogQuerySchema,
  nftDetailSchema,
  nftSummarySchema,
  type CatalogQuery,
  type CatalogResponse,
  type NftDetail,
  type NftSummary,
} from '@/shared/contracts'
import { compare } from '@/shared/lib/money'
import { getDb } from '../db/store'
import type { NftRecord } from '../db/schema'
import { CATEGORIES, SEED_NOW } from '../fixtures/nfts'
import { apiError, withNetwork } from '../network'

const DEFAULT_PAGE_SIZE = 9
const NEW_WINDOW_MS = 30 * 86_400_000
const NEW_SINCE = Date.parse(SEED_NOW) - NEW_WINDOW_MS
const TRENDING_MIN_SCORE = 70
const NETWORKS = ['ethereum', 'polygon', 'solana'] as const

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

type Group = 'q' | 'categories' | 'networks' | 'price' | 'tab'

/** Applies every filter group except the ones listed in `skip` (used for facets). */
function applyFilters(nfts: NftRecord[], query: CatalogQuery, skip: Group[] = []): NftRecord[] {
  const term = query.q ? normalize(query.q) : ''
  return nfts.filter((nft) => {
    if (!skip.includes('q') && term && !normalize(nft.name).includes(term) && !normalize(nft.collection).includes(term))
      return false
    if (!skip.includes('categories') && query.categories?.length && !query.categories.includes(nft.category))
      return false
    if (!skip.includes('networks') && query.networks?.length && !query.networks.includes(nft.network)) return false
    if (!skip.includes('price')) {
      if (query.minPrice && compare(nft.price, query.minPrice) < 0) return false
      if (query.maxPrice && compare(nft.price, query.maxPrice) > 0) return false
    }
    if (!skip.includes('tab')) {
      if (query.tab === 'new' && Date.parse(nft.createdAt) < NEW_SINCE) return false
      if (query.tab === 'trending' && nft.trendingScore < TRENDING_MIN_SCORE) return false
    }
    return true
  })
}

/**
 * `recent` ("Listados recentemente") is the listing order of the DB: most recently listed first, which is
 * the seed order (the Figma NFTs lead). `createdAt` is the mint date and drives the "new" tab instead.
 */
function sortNfts(nfts: NftRecord[], sort: CatalogQuery['sort']): NftRecord[] {
  if (sort === 'recent') return nfts
  const byId = (a: NftRecord, b: NftRecord) => a.id.localeCompare(b.id)
  const comparators: Record<Exclude<CatalogQuery['sort'], 'recent'>, (a: NftRecord, b: NftRecord) => number> = {
    'price-asc': (a, b) => compare(a.price, b.price) || byId(a, b),
    'price-desc': (a, b) => compare(b.price, a.price) || byId(a, b),
    name: (a, b) => a.name.localeCompare(b.name, 'pt-BR') || byId(a, b),
  }
  return [...nfts].sort(comparators[sort])
}

function priceRange(nfts: NftRecord[]): CatalogResponse['facets']['priceRange'] {
  if (nfts.length === 0) return { min: '0', max: '0' }
  let min = nfts[0]!.price
  let max = min
  for (const { price } of nfts) {
    if (compare(price, min) < 0) min = price
    if (compare(price, max) > 0) max = price
  }
  return { min, max }
}

export const toSummary = (nft: NftRecord): NftSummary => nftSummarySchema.parse(nft)

/** The detail payload: exactly the contract shape (Zod strips any field the record may carry beyond it). */
export const toDetail = (nft: NftRecord): NftDetail => nftDetailSchema.parse(nft)

/** Pure catalog query over the mock NFTs: filters, sort, page and facets (each facet ignores its own group). */
export function queryCatalog(nfts: NftRecord[], query: CatalogQuery): CatalogResponse {
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE
  const matching = sortNfts(applyFilters(nfts, query), query.sort)
  const start = (query.page - 1) * pageSize

  const forCategories = applyFilters(nfts, query, ['categories'])
  const forNetworks = applyFilters(nfts, query, ['networks'])

  return {
    items: matching.slice(start, start + pageSize).map(toSummary),
    page: query.page,
    pageSize,
    total: matching.length,
    totalPages: Math.ceil(matching.length / pageSize),
    facets: {
      categories: CATEGORIES.map(({ id, label }) => ({
        id,
        label,
        count: forCategories.filter((nft) => nft.category === id).length,
      })),
      networks: NETWORKS.map((id) => ({ id, count: forNetworks.filter((nft) => nft.network === id).length })),
      priceRange: priceRange(applyFilters(nfts, query, ['price'])),
    },
  }
}

/** Query strings carry arrays as repeated params (`?networks=a&networks=b`). */
function readQuery(url: URL): Record<string, string | string[]> {
  const raw: Record<string, string | string[]> = {}
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key)
    raw[key] = values.length > 1 ? values : values[0]!
  }
  return raw
}

export const nftHandlers = [
  http.get(
    '/api/nfts',
    withNetwork(({ request }) => {
      const parsed = catalogQuerySchema.safeParse(readQuery(new URL(request.url)))
      if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Parâmetros de busca inválidos')
      return HttpResponse.json(queryCatalog(getDb().nfts, parsed.data))
    }),
  ),

  http.get(
    '/api/nfts/:id',
    withNetwork(({ params }) => {
      const nft = getDb().nfts.find((item) => item.id === params.id)
      if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado')
      return HttpResponse.json(toDetail(nft))
    }),
  ),
]
