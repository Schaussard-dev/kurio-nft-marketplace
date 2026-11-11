import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { CatalogSearchField } from '@/features/catalog/components/CatalogSearchField'
import { CatalogSection } from '@/features/catalog/components/CatalogSection'
import { FilterSheet } from '@/features/catalog/components/FilterSheet'
import { Hero } from '@/features/catalog/components/Hero'
import { JournalSection } from '@/features/catalog/components/JournalSection'
import { PromoBanners } from '@/features/catalog/components/PromoBanners'
import { CATALOG_DEFAULTS, catalogSearchSchema } from '@/features/catalog/search-params'
import { useMediaQuery } from '@/shared/lib/use-media-query'

export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  // Links and navigations never write default values (tab=all, sort=recent, page=1) to the URL.
  search: { middlewares: [stripSearchParams(CATALOG_DEFAULTS)] },
  component: HomePage,
})

function HomePage() {
  // Desktop shows search + filters in the sidebar; below 1024px they move to a top bar and a sheet.
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  return (
    <div className="flex flex-col gap-8 lg:gap-24">
      <h1 className="sr-only">Kurio, marketplace de NFTs</h1>
      <div className="flex flex-col gap-4 lg:gap-0">
        {!isDesktop && (
          <div className="flex items-center gap-3">
            <CatalogSearchField variant="bar" className="flex-1" />
            <FilterSheet />
          </div>
        )}
        <Hero />
      </div>
      <CatalogSection showSidebar={isDesktop} />
      <div className="mt-12 flex flex-col gap-20 lg:mt-0 lg:gap-24">
        <PromoBanners />
        <JournalSection />
      </div>
    </div>
  )
}
