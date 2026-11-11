import { z } from 'zod'
import { catalogQuerySchema } from '@/shared/contracts'

const shape = catalogQuerySchema.shape

/**
 * Route search schema for `/`: the catalog query contract minus `pageSize`, where any
 * invalid value falls back to its default instead of failing the route.
 */
export const catalogSearchSchema = z.object({
  q: shape.q.catch(undefined),
  categories: shape.categories.catch(undefined),
  networks: shape.networks.catch(undefined),
  minPrice: shape.minPrice.catch(undefined),
  maxPrice: shape.maxPrice.catch(undefined),
  tab: shape.tab.catch('all'),
  sort: shape.sort.catch('recent'),
  page: shape.page.catch(1),
})
export type CatalogSearch = z.output<typeof catalogSearchSchema>
export type CatalogTab = CatalogSearch['tab']
export type CatalogSort = CatalogSearch['sort']

export const CATALOG_TABS: { value: CatalogTab; label: string }[] = [
  { value: 'all', label: 'Todos os NFTs' },
  { value: 'new', label: 'Novos lançamentos' },
  { value: 'trending', label: 'Em alta' },
]

export const isCatalogTab = (value: string): value is CatalogTab => CATALOG_TABS.some((tab) => tab.value === value)

export const CATALOG_DEFAULTS = { tab: 'all', sort: 'recent', page: 1 } as const satisfies Partial<CatalogSearch>

/** Any filter, search, tab or sort change goes back to the first page. */
export function withFilterChange(prev: Partial<CatalogSearch>, patch: Partial<CatalogSearch>): Partial<CatalogSearch> {
  return { ...prev, ...patch, page: 1 }
}

/** Drops defaults and empty values so URLs stay clean (`/` instead of `/?tab=all&sort=recent&page=1`). */
export function stripDefaults(search: Partial<CatalogSearch>): Partial<CatalogSearch> {
  const out: Partial<CatalogSearch> = {}
  if (search.q?.trim()) out.q = search.q
  if (search.categories?.length) out.categories = search.categories
  if (search.networks?.length) out.networks = search.networks
  if (search.minPrice) out.minPrice = search.minPrice
  if (search.maxPrice) out.maxPrice = search.maxPrice
  if (search.tab && search.tab !== CATALOG_DEFAULTS.tab) out.tab = search.tab
  if (search.sort && search.sort !== CATALOG_DEFAULTS.sort) out.sort = search.sort
  if (search.page && search.page !== CATALOG_DEFAULTS.page) out.page = search.page
  return out
}

/** True when any filter that narrows results (not tab/sort/page) is active. */
export function hasActiveFilters(search: Partial<CatalogSearch>): boolean {
  return Boolean(
    search.q?.trim() || search.categories?.length || search.networks?.length || search.minPrice || search.maxPrice,
  )
}
