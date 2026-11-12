import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/utils'

/** Shimmering placeholder block; `data-skeleton` marks every loading placeholder (styles and tests). */
export function Skeleton({ className, ...props }: Omit<ComponentProps<'div'>, 'children'>) {
  return <div aria-hidden="true" data-skeleton="" className={cn('shimmer rounded-md', className)} {...props} />
}
