import { cn } from '@/shared/lib/utils'

/** "dialog" = desktop sign-in dialog over Início; "page" = mobile full page (Figma frames differ in scale). */
export type AuthVariant = 'dialog' | 'page'

export const INPUT_BASE =
  'w-full min-w-0 border border-border bg-transparent px-4 text-foreground transition-colors placeholder:text-text-secondary focus-visible:border-primary aria-invalid:border-danger'

/** Input classes per variant (dialog fields are 40px/13px, mobile page fields 50px/15px as in Figma). */
export const AUTH_INPUT_CLASS: Record<AuthVariant, string> = {
  dialog: cn(INPUT_BASE, 'h-10 rounded-sm text-caption-13'),
  page: cn(INPUT_BASE, 'h-[50px] rounded-xl text-body-15'),
}
