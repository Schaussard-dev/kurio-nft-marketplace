import { useId, useRef, type KeyboardEvent } from 'react'
import type { Edition } from '@/shared/contracts'
import { cn } from '@/shared/lib/utils'

interface EditionPickerProps {
  editions: Edition[]
  selectedId: string | undefined
  onSelect: (editionId: string) => void
  className?: string
}

const NEXT_KEYS = ['ArrowRight', 'ArrowDown']
const PREV_KEYS = ['ArrowLeft', 'ArrowUp']

/**
 * Edition chips as an ARIA radio group (roving tabindex, arrow keys skip sold-out editions).
 * Sold-out chips stay focusable but `aria-disabled` and say "Esgotada" (never color alone).
 */
export function EditionPicker({ editions, selectedId, onSelect, className }: EditionPickerProps) {
  const labelId = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const available = (edition: Edition) => edition.available > 0
  const focusIndex = Math.max(
    0,
    editions.findIndex((edition) => edition.id === selectedId),
  )

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = NEXT_KEYS.includes(event.key) ? 1 : PREV_KEYS.includes(event.key) ? -1 : 0
    if (!step) return
    event.preventDefault()
    for (let offset = 1; offset <= editions.length; offset++) {
      const next = (index + step * offset + editions.length) % editions.length
      const edition = editions[next]!
      if (available(edition)) {
        onSelect(edition.id)
        refs.current[next]?.focus()
        return
      }
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p id={labelId} className="text-body-15 font-bold text-foreground">
        Edição:
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {editions.map((edition, index) => {
          const soldOut = !available(edition)
          const checked = edition.id === selectedId
          return (
            <button
              key={edition.id}
              ref={(node) => {
                refs.current[index] = node
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={soldOut || undefined}
              tabIndex={index === focusIndex ? 0 : -1}
              onClick={() => !soldOut && onSelect(edition.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-caption-13 transition-colors md:h-7 md:px-2.5 md:text-caption-12',
                checked
                  ? 'border-text-accent font-bold text-text-accent'
                  : 'border-border-strong text-text-secondary hover:border-text-accent',
                soldOut && 'cursor-not-allowed text-muted hover:border-border-strong',
              )}
            >
              {edition.label}
              {soldOut && (
                <span className="text-tiny-10 font-medium">
                  <span aria-hidden>· </span>Esgotada
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
