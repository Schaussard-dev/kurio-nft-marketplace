import { TriangleAlert, X } from 'lucide-react'

interface ChangeNoticeProps {
  id?: string
  title: string
  items: string[]
  /** Adds a close button (accessible name `dismissLabel`). */
  onDismiss?: () => void
  dismissLabel?: string
  testId?: string
  /** false when the caller already announces the change (the banner then is not a live region). */
  live?: boolean
}

/**
 * Inline banner for cart changes the collector must see before checkout (stock below the quantity,
 * realtime price changes). Icon + text, never colour alone; announced politely.
 */
export function ChangeNotice({
  id,
  title,
  items,
  onDismiss,
  dismissLabel = 'Dispensar aviso',
  testId,
  live = true,
}: ChangeNoticeProps) {
  return (
    <div
      id={id}
      role={live ? 'status' : undefined}
      data-testid={testId}
      className="flex gap-3 rounded-sm border border-primary/60 bg-primary/10 px-4 py-3 text-body-14 text-foreground"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-text-accent" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-bold">{title}</p>
        <ul className="flex flex-col gap-0.5 text-text-secondary">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={onDismiss}
          className="-mt-1 -mr-2 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-primary/20 hover:text-foreground"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  )
}
