import { Link } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import type { CartLine } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/ui/Skeleton'

export interface CartLineProps {
  line: CartLine
  /** From the API quote; undefined while the quote loads. */
  lineTotal: string | undefined
  onRemove: (line: CartLine) => void
  removing: boolean
}

/** Stock/refusal message of a line, announced politely. */
export function LineMessage({ message, className }: { message: string; className?: string }) {
  return (
    <p aria-live="polite" className={cn('text-caption-13 text-text-accent empty:hidden', className)}>
      {message}
    </p>
  )
}

export function LineName({ line, className }: { line: CartLine; className?: string }) {
  return (
    <Link
      to="/nft/$nftId"
      params={{ nftId: line.nftId }}
      search={{ edition: line.editionId }}
      className={cn('font-bold text-foreground hover:text-text-accent', className)}
    >
      {line.nft.name}
    </Link>
  )
}

export function LineTotal({ value, className }: { value: string | undefined; className?: string }) {
  if (value === undefined) return <Skeleton className={cn('inline-block h-5 w-20 align-middle', className)} />
  return (
    <span data-testid="line-total" className={className}>
      {formatEth(value)}
    </span>
  )
}

export function RemoveLineButton({
  line,
  onRemove,
  removing,
  className,
}: Omit<CartLineProps, 'lineTotal'> & { className?: string }) {
  return (
    <button
      type="button"
      data-cart-remove
      aria-label={`Remover ${line.nft.name} do carrinho`}
      aria-disabled={removing || undefined}
      onClick={() => !removing && onRemove(line)}
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-accent aria-disabled:cursor-progress aria-disabled:opacity-50',
        className,
      )}
    >
      <Trash2 aria-hidden className="size-5" />
    </button>
  )
}

