import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Tabs } from 'radix-ui'
import { useFavoriteToggle } from '@/features/favorites/queries'
import { useAnnounce } from '@/shared/ui/LiveRegion'
import { catalogQueryOptions } from '../queries'
import { CLEARED_FILTERS, isCatalogTab } from '../search-params'
import { useCatalogNavigate, useCatalogSearch } from '../use-catalog-search'
import { CatalogTabs } from './CatalogTabs'
import { FilterSidebar } from './FilterSidebar'
import { NftGrid } from './NftGrid'
import { Pagination } from './Pagination'
import { SortSelect } from './SortSelect'

/** Catalog driven entirely by the URL: sidebar filters (desktop), tabs, sort, grid and pagination. */
export function CatalogSection({ showSidebar }: { showSidebar: boolean }) {
  const search = useCatalogSearch()
  const query = useQuery(catalogQueryOptions(search))
  const navigateCatalog = useCatalogNavigate()
  const announce = useAnnounce()
  const { isFavorite, toggleFavorite } = useFavoriteToggle()

  const total = query.data?.total
  const settled = query.isSuccess && !query.isPlaceholderData
  // Announce once per result set (new params or new total), not on background refetches of the same one.
  const resultKey = JSON.stringify(search)
  useEffect(() => {
    if (settled && total !== undefined) announce(`${total} ${total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}`)
  }, [settled, total, resultKey, announce])

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
          <NftGrid
            query={query}
            onClearFilters={() => void navigateCatalog(CLEARED_FILTERS)}
            onFirstPage={() => void navigateCatalog({ page: 1 }, { keepPage: true })}
            isFavorite={(nft) => isFavorite(nft.id)}
            onToggleFavorite={(nft) => toggleFavorite(nft.id, nft)}
          />
          {/* Past the last page the grid offers "Voltar à primeira página" instead of a broken pager. */}
          {query.data && search.page <= query.data.totalPages && (
            <Pagination page={search.page} totalPages={query.data.totalPages} />
          )}
        </Tabs.Content>
      </Tabs.Root>
    </section>
  )
}
