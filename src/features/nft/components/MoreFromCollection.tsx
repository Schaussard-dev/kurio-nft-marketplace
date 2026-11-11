import { useQuery } from '@tanstack/react-query'
import { NftCard, type NftCardActions } from '@/features/catalog/components/NftCard'
import { NftCardSkeleton } from '@/features/catalog/components/NftCardSkeleton'
import { catalogQueryOptions } from '@/features/catalog/queries'
import { useFavoriteToggle } from '@/features/favorites/queries'
import type { NftDetail } from '@/shared/contracts'

const SHOWN = 5
const ITEM = 'w-[42vw] max-w-[220px] shrink-0 snap-start md:w-auto md:max-w-none'

/** Other NFTs of the same collection (catalog search by collection), as catalog cards. */
export function MoreFromCollection({ nft, onAddToCart }: { nft: NftDetail } & Pick<NftCardActions, 'onAddToCart'>) {
  // One extra so the list stays full after removing the current NFT.
  const query = useQuery({ ...catalogQueryOptions({ q: nft.collection, pageSize: SHOWN + 1 }), placeholderData: undefined })
  const { isFavorite, toggleFavorite } = useFavoriteToggle()
  const items = query.data?.items.filter((item) => item.id !== nft.id).slice(0, SHOWN)

  if (query.isError || (items && items.length === 0)) return null

  return (
    <section aria-labelledby="mais-colecao-titulo" className="flex flex-col gap-6">
      <h2
        id="mais-colecao-titulo"
        className="border-b border-border-strong pb-3 text-body-lg-17 font-bold text-text-accent"
      >
        Mais desta coleção
      </h2>
      <ul
        aria-label={`Mais NFTs de ${nft.collection}`}
        aria-busy={!items}
        className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 lg:grid-cols-5"
      >
        {items
          ? items.map((item) => (
              <NftCard
                key={item.id}
                nft={item}
                className={ITEM}
                onAddToCart={onAddToCart}
                isFavorite={(card) => isFavorite(card.id)}
                onToggleFavorite={(card) => toggleFavorite(card.id, card)}
              />
            ))
          : Array.from({ length: SHOWN }, (_, index) => <NftCardSkeleton key={index} className={ITEM} />)}
      </ul>
    </section>
  )
}
