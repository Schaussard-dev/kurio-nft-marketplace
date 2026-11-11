import { Link } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import type { NftSummary } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/format'
import { UNAVAILABLE_MESSAGE } from '@/shared/lib/unavailable'
import { cn } from '@/shared/lib/utils'
import { ART_DESCRIPTIONS } from '../art'
import { ArtImage } from './ArtImage'

export interface NftCardActions {
  /** Wired by the cart feature; without it the action says it is unavailable (never fakes success). */
  onAddToCart?: (nft: NftSummary) => void
  /** An add of this NFT is in flight: the cart action is busy and ignores clicks. */
  isAddingToCart?: (nft: NftSummary) => boolean
  /** Wired by the favorites feature; same rule as above. */
  onToggleFavorite?: (nft: NftSummary) => void
  isFavorite?: (nft: NftSummary) => boolean
}

const ACTION =
  'relative z-10 inline-flex size-9 items-center justify-center rounded-md bg-ink/90 text-foreground transition-colors hover:bg-primary hover:text-ink'

export const CARD_IMAGE_SIZES = '(min-width: 1024px) 250px, (min-width: 768px) 30vw, 45vw'

/** Catalog card: whole card links to the detail page; hover/focus reveals cart, favorite and view actions. */
export function NftCard({
  nft,
  className,
  onAddToCart,
  isAddingToCart,
  onToggleFavorite,
  isFavorite,
}: { nft: NftSummary; className?: string } & NftCardActions) {
  const favorite = isFavorite?.(nft) ?? false
  const adding = isAddingToCart?.(nft) ?? false
  const addToCart = () => {
    if (adding) return
    if (onAddToCart) onAddToCart(nft)
    else toast(UNAVAILABLE_MESSAGE)
  }
  const toggleFavorite = () => (onToggleFavorite ? onToggleFavorite(nft) : toast(UNAVAILABLE_MESSAGE))
  const favoriteLabel = `${favorite ? 'Remover' : 'Adicionar'} ${nft.name} ${favorite ? 'da' : 'à'} lista de interesse`
  const favoriteIcon = <Heart aria-hidden className={cn('size-5', favorite && 'fill-current text-text-accent')} />

  return (
    <li
      data-testid="nft-card"
      data-category={nft.category}
      data-network={nft.network}
      className={cn('group relative flex flex-col max-md:even:mt-8', className)}
    >
      <div className="relative rounded-3xl bg-surface p-1 md:rounded-none md:px-1 md:py-5">
        <ArtImage
          art={nft.art}
          sizes={CARD_IMAGE_SIZES}
          alt={`${nft.name}: ${ART_DESCRIPTIONS[nft.art]}`}
          className="aspect-square w-full rounded-[20px] object-cover"
        />
        {nft.rare && (
          <span className="absolute top-0 left-0 bg-primary px-4 py-1.5 text-caption-13 font-medium text-ink">RARO</span>
        )}

        {/* Mobile frame: favorite stays visible in the top-right corner. */}
        <div className="absolute top-3 right-3 md:hidden">
          <button
            type="button"
            className={cn(ACTION, 'rounded-full')}
            aria-label={favoriteLabel}
            aria-pressed={favorite}
            onClick={toggleFavorite}
          >
            {favoriteIcon}
          </button>
        </div>

        {/* Desktop (Login frame): actions appear on hover or keyboard focus. */}
        <div className="absolute inset-x-0 bottom-1 hidden justify-center gap-2 transition-opacity md:flex [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
          <button
            type="button"
            className={cn(ACTION, 'aria-busy:cursor-progress aria-busy:opacity-70')}
            aria-label={`Adicionar ${nft.name} ao carrinho`}
            aria-busy={adding || undefined}
            aria-disabled={adding || undefined}
            onClick={addToCart}
          >
            <ShoppingCart aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            className={ACTION}
            aria-label={favoriteLabel}
            aria-pressed={favorite}
            onClick={toggleFavorite}
          >
            {favoriteIcon}
          </button>
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className={ACTION} aria-label={`Ver detalhes de ${nft.name}`}>
            <Search aria-hidden className="size-5" />
          </Link>
        </div>
      </div>

      <h3 className="mt-3 truncate px-4 text-body-15 leading-5 text-foreground md:px-0 md:text-body-lg-16">
        {/* Stretched link: the whole card opens the detail page; action buttons sit above it (z-10). */}
        <Link
          to="/nft/$nftId"
          params={{ nftId: nft.id }}
          className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary"
        >
          {nft.name}
        </Link>
      </h3>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 px-4 text-body-lg-16 font-bold text-text-accent md:px-0 md:text-body-lg-18">
        <span>
          <span className="sr-only">Preço: </span>
          {formatEth(nft.price)}
        </span>
        {nft.previousPrice && (
          <s className="font-normal text-muted">
            <span className="sr-only">preço anterior: </span>
            {formatEth(nft.previousPrice)}
          </s>
        )}
      </p>
    </li>
  )
}
