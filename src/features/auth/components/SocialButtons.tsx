import { Popover } from 'radix-ui'
import type { ReactNode } from 'react'
import { UNAVAILABLE_MESSAGE } from '@/shared/lib/unavailable'
import { cn } from '@/shared/lib/utils'
import type { AuthVariant } from './auth-styles'

/** Out-of-scope actions (README §3): the trigger opens an honest notice instead of faking success. */
export function UnavailablePopover({ children }: { children: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={6}
          aria-label={UNAVAILABLE_MESSAGE}
          className="z-[60] rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-caption-12 text-foreground shadow-lg"
        >
          {UNAVAILABLE_MESSAGE}
          <Popover.Arrow className="fill-surface-2" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

const PROVIDERS = [
  { name: 'Google', icon: '/icons/google.svg' },
  { name: 'Facebook', icon: '/icons/facebook.svg' },
] as const

export function SocialButtons({ variant }: { variant: AuthVariant }) {
  return (
    <div className={cn('flex flex-col', variant === 'dialog' ? 'gap-3' : 'gap-4')}>
      {PROVIDERS.map(({ name, icon }) => (
        <UnavailablePopover key={name}>
          <button
            type="button"
            className={cn(
              'inline-flex w-full items-center justify-center gap-4 border border-border font-medium text-text-secondary transition-colors hover:border-primary hover:text-text-accent',
              variant === 'dialog' ? 'h-10 rounded-sm text-caption-13' : 'h-[52px] rounded-lg text-caption-13',
            )}
          >
            <img src={icon} alt="" width={20} height={20} className="size-5" />
            Continuar com {name}
          </button>
        </UnavailablePopover>
      ))}
    </div>
  )
}
