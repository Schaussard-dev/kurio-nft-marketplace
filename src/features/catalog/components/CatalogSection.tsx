import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Tabs } from 'radix-ui'
import { useAnnounce } from '@/shared/ui/LiveRegion'
import { catalogQueryOptions } from '../queries'
import { isCatalogTab, type CatalogSearch } from '../search-params'
import { useCatalogNavigate, useCatalogSearch } from '../use-catalog-search'
import { CatalogTabs } from './CatalogTabs'
import { FilterSidebar } from './FilterSidebar'
import { NftGrid } from './NftGrid'
import { Pagination } from './Pagination'
import { SortSelect } from './SortSelect'

const CLEARED_FILTERS: Partial<CatalogSearch> = {
  q: undefined,
  categories: undefined,
  networks: undefined,
  minPrice: undefined,
  maxPrice: undefined,
}

/** Catalog driven entirely by the URL: sidebar filters (desktop), tabs, sort, grid and pagination. */
export function CatalogSection({ showSidebar }: { showSidebar: boolean }) {
  const search = useCatalogSearch()
  const query = useQuery(catalogQueryOptions(search))
  const navigateCatalog = useCatalogNavigate()
  const announce = useAnnounce()

  const total = query.data?.total
  const settled = query.isSuccess && !query.isPlaceholderData
  useEffect(() => {
    if (settled && total !== undefined) announce(`${total} ${total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}`)
  }, [settled, total, query.dataUpdatedAt, announce])

  return (
    <section
      id="catalogo"
      aria-labelledby="catalogo-titulo"
      className="scroll-mt-6 lg:grid lg:grid-cols-[310px_minmax(0,1fr)] lg:items-start lg:gap-12"
    >
      <h2 id="catalogo-titulo" className="sr-only">
        Catálogo de NFTs
      </h2>
      {showSidebar && (
        <FilterSidebar
          facets={query.data?.facets}
          search={search}
          onChange={(patch) => void navigateCatalog(patch)}
        />
      )}
      <Tabs.Root
        value={search.tab}
        onValueChange={(tab) => isCatalogTab(tab) && void navigateCatalog({ tab })}
        activationMode="manual"
        className="min-w-0"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CatalogTabs />
          <SortSelect value={search.sort} onChange={(sort) => void navigateCatalog({ sort })} />
        </div>
        <Tabs.Content value={search.tab} className="mt-8 outline-none">
          <NftGrid query={query} onClearFilters={() => void navigateCatalog(CLEARED_FILTERS)} />
          {query.data && <Pagination page={search.page} totalPages={query.data.totalPages} />}
        </Tabs.Content>
      </Tabs.Root>
    </section>
  )
}
