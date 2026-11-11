import { Skeleton } from '@/shared/ui/Skeleton'

/** Pending state with the detail page's box model (gallery, title, price, chips, actions). */
export function NftDetailSkeleton() {
  return (
    <div role="status" aria-label="Carregando NFT" className="flex flex-col gap-6 md:grid md:grid-cols-[80px_minmax(0,1fr)] md:gap-x-7 lg:grid-cols-[100px_minmax(0,444px)_minmax(0,1fr)]">
      <div className="hidden flex-col gap-[15px] md:flex">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="aspect-square w-full" />
        ))}
      </div>
      <Skeleton className="aspect-square w-full rounded-[28px] md:rounded-md" />
      <div className="flex flex-col gap-4 md:col-span-2 lg:col-span-1">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}
