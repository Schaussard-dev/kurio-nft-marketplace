import { SlidersHorizontal } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/shared/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/ui/sheet'
import { catalogQueryOptions } from '../queries'
import { CLEARED_FILTERS, hasActiveFilters } from '../search-params'
import { useCatalogNavigate, useCatalogSearch } from '../use-catalog-search'
import { FilterPanel } from './FilterSidebar'

const countActive = (search: ReturnType<typeof useCatalogSearch>) =>
  (search.categories?.length ?? 0) + (search.networks?.length ?? 0) + (search.minPrice || search.maxPrice ? 1 : 0)

/** Below 1024px the filters live in a bottom sheet opened from the search bar ("Filtros"). */
export function FilterSheet() {
  const search = useCatalogSearch()
  // Same query key as the grid: shares its cache, so this adds no request.
  const { data } = useQuery(catalogQueryOptions(search))
  const navigateCatalog = useCatalogNavigate()
  const active = countActive(search)
  const total = data?.total

  return (
    <Sheet>
      <SheetTrigger
        // The badge is visual only: the name carries the count ("Filtros, 2 ativos").
        aria-label={active === 0 ? 'Filtros' : `Filtros, ${active} ${active === 1 ? 'ativo' : 'ativos'}`}
        className="relative inline-flex size-[45px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-light to-primary-dark text-ink"
      >
        <SlidersHorizontal aria-hidden className="size-5" />
        {active > 0 && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-foreground text-tiny-10 font-bold text-ink"
          >
            {active}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl border-border-strong bg-surface">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-body-lg-18 font-bold">Filtros</SheetTitle>
          <SheetDescription>Coleções e redes valem na hora; a faixa de preço, ao tocar em Aplicar.</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-5 py-2">
          <FilterPanel facets={data?.facets} search={search} onChange={(patch) => void navigateCatalog(patch)} />
        </div>
        {/* Stacked full-width actions: side by side, the two labels do not fit a 320–390px phone. */}
        <SheetFooter className="flex-col gap-3 px-5 pb-6">
          <SheetClose asChild>
            <Button className="h-11 w-full">Ver resultados{total !== undefined ? ` (${total})` : ''}</Button>
          </SheetClose>
          {hasActiveFilters(search) && (
            <Button variant="outline" className="h-11 w-full" onClick={() => void navigateCatalog(CLEARED_FILTERS)}>
              Limpar filtros
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
