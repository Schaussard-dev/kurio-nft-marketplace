import { useMediaQuery } from '@/shared/lib/use-media-query'
import { CatalogSearchField } from './CatalogSearchField'
import { CatalogSection } from './CatalogSection'
import { FilterSheet } from './FilterSheet'
import { Hero } from './Hero'
import { JournalSection } from './JournalSection'
import { PromoBanners } from './PromoBanners'

/** Início body. Also rendered behind the desktop sign-in dialog (/entrar, /cadastro), as in Figma. */
export function HomeContent() {
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
