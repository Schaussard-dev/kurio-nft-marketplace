import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/utils'

export function Skeleton({ className, ...props }: Omit<ComponentProps<'div'>, 'children'>) {
  return <div aria-hidden="true" className={cn('shimmer rounded-md', className)} {...props} />
}
