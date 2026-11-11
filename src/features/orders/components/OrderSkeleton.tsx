import { Skeleton } from '@/shared/ui/Skeleton'

/** Placeholder while the order loads (same footprint as the receipt card, no layout shift). */
export function OrderSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[700px] flex-col items-center gap-6 bg-surface px-6 py-8" aria-busy="true">
      <span className="sr-only" role="status">
        Carregando pedido…
      </span>
      <Skeleton className="size-24" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}
