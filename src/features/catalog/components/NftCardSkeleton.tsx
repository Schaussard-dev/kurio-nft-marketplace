import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/ui/Skeleton'

/** Same box model as NftCard (square art + name + price lines), so swapping in real cards causes no shift. */
export function NftCardSkeleton({ className }: { className?: string }) {
  return (
    <li aria-hidden className={cn('flex flex-col max-md:even:mt-8', className)}>
      <div className="rounded-3xl bg-surface p-1 md:rounded-none md:px-1 md:py-5">
        <Skeleton className="aspect-square w-full rounded-[20px] bg-surface-2" />
      </div>
      <div className="mt-3 px-4 md:px-0">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-1.5 h-4 w-1/3 md:h-[18px]" />
      </div>
    </li>
  )
}
