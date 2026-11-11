import { Link } from '@tanstack/react-router'
import { ART_DESCRIPTIONS } from '../art'
import { ArtImage } from './ArtImage'

// Editorial pick drawn in the Figma sidebar (Sage Nomad #009).
const FEATURED = { id: 'nft_009', name: 'Sage Nomad #009', art: 'sage' } as const

export function FeaturedNft() {
  return (
    <section aria-labelledby="destaque-titulo" className="overflow-hidden bg-gradient-to-b from-surface to-ink">
      <div className="px-5 pt-6 pb-4">
        <h2 id="destaque-titulo" className="text-heading-24 text-text-accent">
          NFT EM DESTAQUE
        </h2>
        <p className="mt-2 text-center text-title-22 font-bold text-foreground">OFERTA LIMITADA</p>
      </div>
      <Link to="/nft/$nftId" params={{ nftId: FEATURED.id }} className="block rounded-[20px]">
        <ArtImage
          art={FEATURED.art}
          sizes="310px"
          alt={`Ver ${FEATURED.name}: ${ART_DESCRIPTIONS[FEATURED.art]}`}
          className="h-[366px] w-full rounded-[20px] object-cover"
        />
      </Link>
    </section>
  )
}
