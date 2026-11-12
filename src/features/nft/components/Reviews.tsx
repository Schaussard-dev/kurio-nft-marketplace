import { Star } from 'lucide-react'
import type { Review } from '@/shared/contracts'
import { formatDate, formatRating } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

/** Five stars filled up to the rounded rating; one accessible name for the whole row. */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  const filled = Math.round(rating)
  return (
    <span role="img" aria-label={`Nota ${formatRating(rating)} de 5`} className={cn('inline-flex gap-0.5', className)}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden
          className={cn('size-3.5', index < filled ? 'fill-current text-text-accent' : 'text-muted')}
        />
      ))}
    </span>
  )
}

/** Read-only collector reviews, as returned by the API (spec §9). */
export function Reviews({ reviews, rating }: { reviews: Review[]; rating: number }) {
  if (reviews.length === 0) {
    return <p className="text-body-14 text-text-secondary">Este NFT ainda não tem avaliações de colecionadores.</p>
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-body-15 text-foreground">
        <Stars rating={rating} />
        <span>
          {formatRating(rating)} de 5 · {reviews.length} {reviews.length === 1 ? 'avaliação' : 'avaliações'}
        </span>
      </p>
      <ul className="flex flex-col divide-y divide-border">
        {reviews.map((review) => (
          <li key={review.id} className="flex flex-col gap-1.5 py-4 first:pt-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-body-15 font-bold text-foreground">{review.author}</span>
              <Stars rating={review.rating} />
              <time dateTime={review.createdAt} className="text-caption-12 text-text-secondary">
                {formatDate(review.createdAt)}
              </time>
            </div>
            <p className="text-body-14 leading-6 text-text-secondary">{review.comment}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
