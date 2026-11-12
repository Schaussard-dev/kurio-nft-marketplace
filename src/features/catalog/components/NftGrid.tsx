import type { UseQueryResult } from '@tanstack/react-query'
import { SearchX, TriangleAlert } from 'lucide-react'
import type { CatalogResponse } from '@/shared/contracts'
import { Button } from '@/shared/ui/button'
import { NftCard, type NftCardActions } from './NftCard'
import { NftCardSkeleton } from './NftCardSkeleton'

const PAGE_SIZE = 9
/** First row on mobile (2 columns): above the fold, so their images are not lazy-loaded. */
const EAGER_CARDS = 2
const GRID = 'grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-[34px] md:gap-y-12'

interface NftGridProps extends NftCardActions {
  query: UseQueryResult<CatalogResponse>
  onClearFilters: () => void
  /** Used when the URL points past the last page (e.g. `?page=99`). */
  onFirstPage: () => void
}

/** Catalog results with loading (skeletons), empty, error and background-refresh states. */
export function NftGrid({ query, onClearFilters, onFirstPage, ...actions }: NftGridProps) {
  const { data, isError, isFetching, refetch } = query

  if (isError && !data) {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 rounded-lg bg-surface px-6 py-16 text-center">
        <TriangleAlert aria-hidden className="size-8 text-danger" />
        <p className="text-body-lg-18 font-bold text-foreground">Não foi possível carregar os NFTs.</p>
        <p className="text-body-14 text-text-secondary">Verifique sua conexão e tente novamente.</p>
        <Button onClick={() => void refetch()} disabled={isFetching}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (data && data.total === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg bg-surface px-6 py-16 text-center">
        <SearchX aria-hidden className="size-8 text-text-accent" />
        <h3 className="text-body-lg-18 font-bold text-foreground">Nenhum NFT encontrado</h3>
        <p className="text-body-14 text-text-secondary">Tente outra busca ou ajuste os filtros.</p>
        <Button variant="outline" onClick={onClearFilters}>
          Limpar filtros
        </Button>
      </div>
    )
  }

  if (data && data.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg bg-surface px-6 py-16 text-center">
        <SearchX aria-hidden className="size-8 text-text-accent" />
        <h3 className="text-body-lg-18 font-bold text-foreground">Nenhum NFT nesta página</h3>
        <p className="text-body-14 text-text-secondary">
          Esta busca tem {data.totalPages} {data.totalPages === 1 ? 'página' : 'páginas'}.
        </p>
        <Button variant="outline" onClick={onFirstPage}>
          Voltar à primeira página
        </Button>
      </div>
    )
  }

  const refreshing = isFetching && Boolean(data)
  return (
    <div className="relative">
      {/* Subtle top progress bar while a background fetch keeps the previous results on screen. */}
      <div aria-hidden className="absolute inset-x-0 -top-4 h-0.5 overflow-hidden rounded-full">
        {refreshing && <div className="catalog-progress h-full w-1/3 bg-primary" />}
      </div>
      <ul aria-label="NFTs" aria-busy={isFetching} className={GRID}>
        {data
          ? data.items.map((nft, index) => <NftCard key={nft.id} nft={nft} eager={index < EAGER_CARDS} {...actions} />)
          : Array.from({ length: PAGE_SIZE }, (_, index) => <NftCardSkeleton key={index} />)}
      </ul>
    </div>
  )
}
