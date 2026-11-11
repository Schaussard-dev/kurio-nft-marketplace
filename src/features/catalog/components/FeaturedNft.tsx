import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { nftQueryOptions } from '@/features/nft/queries'
import { Skeleton } from '@/shared/ui/Skeleton'
import { ART_DESCRIPTIONS } from '../art'
import { ArtImage } from './ArtImage'

// Editorial pick drawn in the Figma sidebar; name and art come from the API.
const FEATURED_NFT_ID = 'nft_009'

/** Sidebar "NFT em destaque". Hidden when the NFT cannot be loaded and nothing is cached (e.g. removed from the catalog). */
export function FeaturedNft() {
  const { data: nft, isError } = useQuery(nftQueryOptions(FEATURED_NFT_ID))
  // A failed background refetch keeps showing cached data; hide only when there is nothing to show.
  if (isError && !nft) return null

  return (
    <section aria-labelledby="destaque-titulo" className="overflow-hidden bg-gradient-to-b from-surface to-ink">
      <div className="px-5 pt-6 pb-4">
        <h2 id="destaque-titulo" className="text-heading-24 text-text-accent">
          NFT EM DESTAQUE
        </h2>
        <p className="mt-2 text-center text-title-22 font-bold text-foreground">OFERTA LIMITADA</p>
      </div>
      {nft ? (
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="block rounded-[20px]">
          <ArtImage
            art={nft.art}
            sizes="310px"
            alt={`Ver ${nft.name}: ${ART_DESCRIPTIONS[nft.art]}`}
            className="h-[366px] w-full rounded-[20px] object-cover"
          />
        </Link>
      ) : (
        <Skeleton className="h-[366px] w-full rounded-[20px]" />
      )}
    </section>
  )
}
