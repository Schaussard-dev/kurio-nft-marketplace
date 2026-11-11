import { useQuery } from '@tanstack/react-query'
import { NftCard } from '@/features/catalog/components/NftCard'
import { NftCardSkeleton } from '@/features/catalog/components/NftCardSkeleton'
import { catalogQueryOptions } from '@/features/catalog/queries'
import { useFavoriteToggle } from '@/features/favorites/queries'
import { useQuickAddToCart } from '../queries'

const SHOWN = 5
const ITEM = 'w-[42vw] max-w-[220px] shrink-0 snap-start md:w-auto md:max-w-none'

/**
 * "Colecionadores também viram": trending NFTs from the catalog API, minus the ones already in the
 * cart. Hidden when the API fails or has nothing to suggest.
 */
export function AlsoViewed({ excludeIds }: { excludeIds: string[] }) {
  // Extra items so the row stays full after removing the cart's NFTs.
  const query = useQuery({ ...catalogQueryOptions({ tab: 'trending', pageSize: SHOWN * 2 }), placeholderData: undefined })
  const { isFavorite, toggleFavorite } = useFavoriteToggle()
  const { quickAdd, isAdding } = useQuickAddToCart()
  const items = query.data?.items.filter((item) => !excludeIds.includes(item.id)).slice(0, SHOWN)

  if (query.isError || (items && items.length === 0)) return null

  return (
    <section aria-labelledby="tambem-viram-titulo" className="flex flex-col gap-6">
      <h2 id="tambem-viram-titulo" className="border-b border-border-strong pb-3 text-title-20 font-bold text-text-accent">
        Colecionadores também viram
      </h2>
      <ul
        aria-label="NFTs que colecionadores também viram"
        aria-busy={!items}
        className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 lg:grid-cols-5"
      >
        {items
          ? items.map((item) => (
              <NftCard
                key={item.id}
                nft={item}
                className={ITEM}
                onAddToCart={(card) => void quickAdd(card)}
                isAddingToCart={isAdding}
                isFavorite={(card) => isFavorite(card.id)}
                onToggleFavorite={(card) => toggleFavorite(card.id, card)}
              />
            ))
          : Array.from({ length: SHOWN }, (_, index) => <NftCardSkeleton key={index} className={ITEM} />)}
      </ul>
    </section>
  )
}
