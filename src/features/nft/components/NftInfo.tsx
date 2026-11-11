import { Mail, ShoppingCart, Star } from 'lucide-react'
import { toast } from 'sonner'
import { FavoriteButton } from '@/features/favorites/components/FavoriteButton'
import type { Edition, NftDetail } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/format'
import { UNAVAILABLE_MESSAGE } from '@/shared/lib/unavailable'
import { cn } from '@/shared/lib/utils'
import { buttonVariants } from '@/shared/ui/button'
import type { ClampedQuantity } from '../quantity'
import { EditionPicker } from './EditionPicker'
import { QuantityStepper } from './QuantityStepper'
import { Stars } from './Reviews'

/** Purchase state shared by the desktop info column and the mobile bottom bar. */
export interface PurchaseProps {
  nft: NftDetail
  edition: Edition | undefined
  quantity: ClampedQuantity
  onQuantityChange: (value: number) => void
  /**
   * Wired by the cart feature; without it COMPRAR says it is unavailable (never fakes success, README §3).
   * goToCart: COMPRAR / "Comprar NFT" open the cart; the mobile cart shortcut stays on the page.
   */
  onAddToCart?: (input: { nftId: string; editionId: string; quantity: number }, options: { goToCart: boolean }) => void
  /** An add request is in flight: the buy actions are disabled against repeated clicks. */
  adding?: boolean
}

interface NftInfoProps extends PurchaseProps {
  onSelectEdition: (editionId: string) => void
  variant: 'desktop' | 'mobile'
}

const META = 'text-body-14 leading-6 text-muted md:text-body-15'
const ratingText = (rating: number) => rating.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

function addToCart({ nft, edition, quantity, onAddToCart, adding }: PurchaseProps, goToCart: boolean) {
  if (!edition || quantity.value === 0 || adding) return
  if (!onAddToCart) {
    toast(UNAVAILABLE_MESSAGE)
    return
  }
  onAddToCart({ nftId: nft.id, editionId: edition.id, quantity: quantity.value }, { goToCart })
}

/** "Máximo de N por pedido" / "Edição indisponível", announced politely (spec §9). */
function PurchaseHint({ quantity, className }: { quantity: ClampedQuantity; className?: string }) {
  const message = quantity.max === 0 ? 'Edição indisponível' : quantity.limited ? `Máximo de ${quantity.max} por pedido` : ''
  return (
    <p aria-live="polite" className={cn('min-h-4 text-caption-13 text-text-accent', className)}>
      {message}
    </p>
  )
}

function ShareLinks({ nft }: { nft: NftDetail }) {
  const url = `${window.location.origin}/nft/${nft.id}`
  const text = `${nft.name} na Kurio`
  const links = [
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
          <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm6.5 0h3.8v1.5h.06c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.77 2.65 4.77 6.1v5.45h-4v-4.83c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55v4.91h-4v-11Z" />
        </svg>
      ),
    },
    {
      label: 'E-mail',
      href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`,
      icon: <Mail aria-hidden className="size-4" />,
    },
    {
      label: 'Twitter',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      icon: <img src="/icons/social-twitter.svg" alt="" width={16} height={14} className="size-4 object-contain" />,
    },
  ]
  return (
    <p className="flex items-center gap-3 text-body-15 font-bold text-foreground">
      Compartilhar este NFT:
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Compartilhar no ${link.label} (abre em nova aba)`}
          className="inline-flex size-6 items-center justify-center text-foreground hover:text-text-accent"
        >
          {link.icon}
        </a>
      ))}
    </p>
  )
}

/** Title, price, rating, description, editions, purchase actions (desktop) and metadata. */
export function NftInfo({ variant, onSelectEdition, ...purchase }: NftInfoProps) {
  const { nft, edition, quantity, onQuantityChange } = purchase
  const mobile = variant === 'mobile'
  const unavailable = quantity.max === 0

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {mobile ? (
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-title-22 font-bold text-foreground">{nft.name}</h1>
          <p className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary px-3 py-1.5 text-body-15 text-foreground">
            <Star aria-hidden className="size-4 fill-current text-text-accent" />
            <span className="sr-only">Nota </span>
            {ratingText(nft.rating)}
            <span>
              <span className="sr-only">, </span>({nft.reviewCount}
              <span className="sr-only"> avaliações</span>)
            </span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 border-b border-border-strong pb-3">
          <h1 className="text-heading-28 text-foreground">{nft.name}</h1>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-title-22 font-bold text-text-accent">
              <span className="sr-only">Preço: </span>
              <span data-testid="nft-price">{formatEth(nft.price)}</span>
            </p>
            <p className="flex items-center gap-2 text-body-15 text-foreground">
              <Stars rating={nft.rating} />
              {nft.reviewCount} avaliações de colecionadores
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {!mobile && <h2 className="text-body-15 font-bold text-foreground">Sobre este NFT:</h2>}
        <p className={cn('text-text-secondary', mobile ? 'text-body-lg-16 leading-7' : 'text-body-14 leading-6')}>
          {nft.description}
        </p>
      </div>

      <EditionPicker editions={nft.editions} selectedId={edition?.id} onSelect={onSelectEdition} />

      {!mobile && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <QuantityStepper value={quantity.value} max={quantity.max} onChange={onQuantityChange} />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={unavailable}
                aria-busy={purchase.adding || undefined}
                onClick={() => addToCart(purchase, true)}
                className={cn(buttonVariants(), 'h-10 w-[130px] text-caption-13')}
              >
                COMPRAR
              </button>
              <FavoriteButton nft={nft} />
            </div>
          </div>
          <PurchaseHint quantity={quantity} />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <p className={META}>ID do token: #{String(nft.tokenNumber).padStart(4, '0')}</p>
        <p className={META}>Coleção: {nft.collection}</p>
        <p className={META}>Atributos: {nft.attributes.join(', ')}</p>
      </div>
      <ShareLinks nft={nft} />
    </div>
  )
}

/** Mobile/Detalhes fixed bottom bar: Qtd. stepper, price, "Comprar NFT" and the cart shortcut. */
export function MobileBuyBar(purchase: PurchaseProps) {
  const { nft, quantity, onQuantityChange } = purchase
  const unavailable = quantity.max === 0
  return (
    <div data-bottom-bar className="fixed inset-x-0 bottom-0 z-40 rounded-t-[32px] border-t border-border-strong bg-surface px-6 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-body-lg-16 font-bold text-foreground">
            Qtd.
          </span>
          <QuantityStepper value={quantity.value} max={quantity.max} onChange={onQuantityChange} />
        </div>
        <p className="text-heading-24 text-text-accent">
          <span className="sr-only">Preço: </span>
          <span data-testid="nft-price">{formatEth(nft.price)}</span>
        </p>
      </div>
      <PurchaseHint quantity={quantity} className="mt-1" />
      <div className="mt-2 flex items-center gap-4">
        <button
          type="button"
          disabled={unavailable}
          aria-busy={purchase.adding || undefined}
          onClick={() => addToCart(purchase, true)}
          className="h-14 flex-1 rounded-full bg-gradient-to-r from-primary-light to-primary-dark text-body-lg-17 font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Comprar NFT
        </button>
        <button
          type="button"
          aria-label="Adicionar ao carrinho"
          disabled={unavailable}
          aria-busy={purchase.adding || undefined}
          onClick={() => addToCart(purchase, false)}
          className="inline-flex size-14 items-center justify-center rounded-full border border-border-strong bg-ink/40 text-text-accent transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          <ShoppingCart aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  )
}
