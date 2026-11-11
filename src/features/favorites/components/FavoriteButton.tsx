import { Heart } from 'lucide-react'
import { nftSummarySchema, type NftSummary } from '@/shared/contracts'
import { cn } from '@/shared/lib/utils'
import { buttonVariants } from '@/shared/ui/button'
import { useFavoriteToggle } from '../queries'

interface FavoriteButtonProps {
  nft: NftSummary
  /** `labelled`: outline button with text (Desktop/Detalhes); `icon`: round heart (Mobile/Detalhes). */
  variant?: 'labelled' | 'icon'
  className?: string
}

/** Toggle button (`aria-pressed`). Guests are sent to /entrar and come back here. */
export function FavoriteButton({ nft, variant = 'labelled', className }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavoriteToggle()
  const pressed = isFavorite(nft.id)
  const label = pressed ? 'Remover dos favoritos' : 'Favoritar'
  // The cache keeps summaries only (the detail payload carries editions and reviews).
  const onClick = () => toggleFavorite(nft.id, nftSummarySchema.parse(nft))
  const heart = <Heart aria-hidden className={cn('size-5', pressed && 'fill-current')} />

  if (variant === 'icon') {
    return (
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={label}
        onClick={onClick}
        className={cn(
          'inline-flex size-12 items-center justify-center rounded-full border border-border-strong bg-surface text-text-accent transition-colors hover:bg-surface-2',
          className,
        )}
      >
        {heart}
      </button>
    )
  }

  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(buttonVariants({ variant: 'outline' }), 'h-10 gap-2 px-3 font-medium', className)}
    >
      {heart}
      {label}
    </button>
  )
}
