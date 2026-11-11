import { useId, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import type { CatalogResponse, Network } from '@/shared/contracts'
import { fromCents, toCents } from '@/shared/lib/money'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Slider } from '@/shared/ui/slider'
import type { CatalogSearch } from '../search-params'
import { CatalogSearchField } from './CatalogSearchField'
import { FeaturedNft } from './FeaturedNft'

type Facets = CatalogResponse['facets']

const NETWORK_LABELS: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

interface FilterPanelProps {
  facets: Facets | undefined
  search: CatalogSearch
  onChange: (patch: Partial<CatalogSearch>) => void
}

const GROUP_TITLE = 'text-body-lg-18 font-bold text-foreground'

function toggle<T>(list: T[] | undefined, value: T): T[] | undefined {
  const next = list?.includes(value) ? list.filter((item) => item !== value) : [...(list ?? []), value]
  return next.length ? next : undefined
}

function FacetOption({ label, count, checked, onToggle }: { label: string; count: number; checked: boolean; onToggle: () => void }) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-3 rounded-sm pl-3 text-left text-body-15 leading-10 transition-colors hover:text-foreground',
          checked ? 'text-text-accent' : 'text-text-secondary',
        )}
      >
        <span className="flex items-center gap-2">
          {label}
          {/* Selected state is never conveyed by color alone. */}
          {checked && <Check aria-hidden className="size-4" />}
        </span>
        <span className="font-bold">({count})</span>
      </button>
    </li>
  )
}

function FacetGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id}>
      <h3 id={id} className={GROUP_TITLE}>
        {title}
      </h3>
      <ul className="mt-3">{children}</ul>
    </div>
  )
}

const formatCentsBr = (cents: number) => fromCents(cents).replace('.', ',')

/** Two-thumb price slider; only applies on "Aplicar". Bounds come from `facets.priceRange`. */
function PriceFilter({ range, search, onChange }: { range: Facets['priceRange']; search: CatalogSearch; onChange: FilterPanelProps['onChange'] }) {
  const bounds: [number, number] = [toCents(range.min), toCents(range.max, 'ceil')]
  const clamp = (cents: number) => Math.min(bounds[1], Math.max(bounds[0], cents))
  const [draft, setDraft] = useState<[number, number]>([
    clamp(search.minPrice ? toCents(search.minPrice) : bounds[0]),
    clamp(search.maxPrice ? toCents(search.maxPrice, 'ceil') : bounds[1]),
  ])
  const disabled = bounds[0] >= bounds[1]
  const text = `${formatCentsBr(draft[0])} - ${formatCentsBr(draft[1])} ETH`

  return (
    <div role="group" aria-labelledby="filtro-preco">
      <h3 id="filtro-preco" className={GROUP_TITLE}>
        Faixa de preço
      </h3>
      <Slider
        className="mt-5"
        min={bounds[0]}
        max={bounds[1]}
        step={1}
        minStepsBetweenThumbs={0}
        value={draft}
        disabled={disabled}
        onValueChange={(value) => setDraft([value[0]!, value[1]!])}
        thumbs={[
          { 'aria-label': 'Preço mínimo', 'aria-valuetext': `${formatCentsBr(draft[0])} ETH` },
          { 'aria-label': 'Preço máximo', 'aria-valuetext': `${formatCentsBr(draft[1])} ETH` },
        ]}
      />
      <p className="mt-4 pl-3 text-body-15 text-foreground">Preço: {text}</p>
      <Button
        size="sm"
        className="mt-3 ml-3 h-9 px-3 text-body-lg-16"
        disabled={disabled}
        onClick={() =>
          onChange({
            minPrice: draft[0] > bounds[0] ? fromCents(draft[0]) : undefined,
            maxPrice: draft[1] < bounds[1] ? fromCents(draft[1]) : undefined,
          })
        }
      >
        Aplicar
      </Button>
    </div>
  )
}

/** Collections, price range and network filters; shared by the desktop sidebar and the mobile sheet. */
export function FilterPanel({ facets, search, onChange }: FilterPanelProps) {
  if (!facets) {
    return (
      <div aria-hidden className="flex flex-col gap-3">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-6" />
        ))}
      </div>
    )
  }
  const { priceRange } = facets
  return (
    <div className="flex flex-col gap-10">
      <FacetGroup title="Coleções">
        {facets.categories.map((category) => (
          <FacetOption
            key={category.id}
            label={category.label}
            count={category.count}
            checked={search.categories?.includes(category.id) ?? false}
            onToggle={() => onChange({ categories: toggle(search.categories, category.id) })}
          />
        ))}
      </FacetGroup>
      <PriceFilter
        // Re-seed the draft whenever the applied range or its bounds change.
        key={`${priceRange.min}-${priceRange.max}-${search.minPrice}-${search.maxPrice}`}
        range={priceRange}
        search={search}
        onChange={onChange}
      />
      <FacetGroup title="Rede">
        {facets.networks.map((network) => (
          <FacetOption
            key={network.id}
            label={NETWORK_LABELS[network.id]}
            count={network.count}
            checked={search.networks?.includes(network.id) ?? false}
            onToggle={() => onChange({ networks: toggle(search.networks, network.id) })}
          />
        ))}
      </FacetGroup>
    </div>
  )
}

/** Desktop sidebar (≥1024px): search, filters and the featured NFT. */
export function FilterSidebar(props: FilterPanelProps) {
  return (
    <aside aria-label="Filtros" className="flex flex-col gap-6">
      <div className="flex flex-col gap-8 bg-surface px-5 py-5">
        <CatalogSearchField variant="sidebar" />
        <FilterPanel {...props} />
      </div>
      <FeaturedNft />
    </aside>
  )
}
