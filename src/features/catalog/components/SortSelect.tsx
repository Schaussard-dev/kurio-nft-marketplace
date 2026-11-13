import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import type { CatalogSort } from '../search-params'

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: 'recent', label: 'Listados recentemente' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
  { value: 'name', label: 'Nome (A–Z)' },
]

const isSort = (value: string): value is CatalogSort => SORT_OPTIONS.some((option) => option.value === value)

export function SortSelect({ value, onChange }: { value: CatalogSort; onChange: (sort: CatalogSort) => void }) {
  return (
    <div className="flex items-center gap-1 text-body-15 text-foreground lg:whitespace-nowrap">
      <span id="catalogo-ordenar">Ordenar por:</span>
      <Select value={value} onValueChange={(next) => isSort(next) && onChange(next)}>
        <SelectTrigger
          aria-labelledby="catalogo-ordenar"
          className="h-auto gap-1 border-none bg-transparent px-0 py-1 text-body-15 text-foreground [&_svg:not([class*='text-'])]:text-foreground"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end">
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
