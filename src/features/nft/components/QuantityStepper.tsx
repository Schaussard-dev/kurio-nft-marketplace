import { Minus, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface QuantityStepperProps {
  value: number
  max: number
  onChange: (value: number) => void
  className?: string
}

const STEP =
  'inline-flex h-10 w-7 items-center justify-center rounded-full bg-primary text-ink transition-colors hover:bg-primary-light aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:hover:bg-primary'

/**
 * − value + (Figma pills). Buttons at a bound stay focusable with `aria-disabled` so keyboard focus is
 * never lost; the limit message lives next to the purchase actions (aria-live).
 */
export function QuantityStepper({ value, max, onChange, className }: QuantityStepperProps) {
  const canDecrease = value > 1
  const canIncrease = value < max
  return (
    <div role="group" aria-label="Quantidade" className={cn('flex items-center gap-3', className)}>
      <button
        type="button"
        aria-label="Diminuir quantidade"
        aria-disabled={!canDecrease || undefined}
        onClick={() => canDecrease && onChange(value - 1)}
        className={STEP}
      >
        <Minus aria-hidden className="size-4" strokeWidth={3} />
      </button>
      <output data-testid="quantity-value" aria-live="polite" className="min-w-5 text-center text-body-lg-18 text-foreground">
        {value}
      </output>
      <button
        type="button"
        aria-label="Aumentar quantidade"
        aria-disabled={!canIncrease || undefined}
        onClick={() => canIncrease && onChange(value + 1)}
        className={STEP}
      >
        <Plus aria-hidden className="size-4" strokeWidth={3} />
      </button>
    </div>
  )
}
