import { Skeleton } from '@/shared/ui/Skeleton'

/** Generic page placeholder (title + content blocks) while a route resolves, e.g. the private-route session check. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Carregando página" data-page-loading="" className="flex flex-col gap-6">
      <Skeleton className="h-7 w-1/2 max-w-[320px]" />
      <div className="flex flex-col gap-4 lg:flex-row">
        <Skeleton className="hidden h-[320px] w-[280px] shrink-0 lg:block" />
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  )
}
