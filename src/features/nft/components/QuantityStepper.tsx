import { Minus, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface QuantityStepperProps {
  value: number
  max: number
  onChange: (value: number) => void
  className?: string
  /** Names the item in the labels when several steppers share a page (cart lines). */
  itemName?: string
  /** `pill`: detail page; `pill-sm`: desktop cart rows; `round`: mobile cart cards. */
  variant?: 'pill' | 'pill-sm' | 'round'
}

const STEP_BASE =
  'inline-flex items-center justify-center rounded-full transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-45'
const STEP: Record<NonNullable<QuantityStepperProps['variant']>, string> = {
  pill: 'h-10 w-7 bg-primary text-ink hover:bg-primary-light aria-disabled:hover:bg-primary',
  'pill-sm': 'h-7 w-5 bg-primary text-ink hover:bg-primary-light aria-disabled:hover:bg-primary',
  round: 'size-9 border border-border-strong bg-ink/40 text-foreground hover:bg-surface-2 aria-disabled:hover:bg-ink/40',
}

const VALUE: Record<NonNullable<QuantityStepperProps['variant']>, string> = {
  pill: 'text-title-20',
  'pill-sm': 'text-body-lg-17',
  round: 'text-body-lg-16',
}

/**
 * − value + (Figma pills). Buttons at a bound stay focusable with `aria-disabled` so keyboard focus is
 * never lost; the limit message lives next to the purchase actions (aria-live).
 */
export function QuantityStepper({ value, max, onChange, className, itemName, variant = 'pill' }: QuantityStepperProps) {
  const canDecrease = value > 1
  const canIncrease = value < max
  const of = itemName ? ` de ${itemName}` : ''
  const icon = variant === 'pill-sm' ? 'size-3' : 'size-4'
  return (
    <div role="group" aria-label={`Quantidade${of}`} className={cn('flex items-center gap-3', className)}>
      <button
        type="button"
        aria-label={`Diminuir quantidade${of}`}
        aria-disabled={!canDecrease || undefined}
        onClick={() => canDecrease && onChange(value - 1)}
        className={cn(STEP_BASE, STEP[variant])}
      >
        <Minus aria-hidden className={icon} strokeWidth={3} />
      </button>
      <output data-testid="quantity-value" aria-live="polite" className={cn('min-w-5 text-center text-foreground', VALUE[variant])}>
        {value}
      </output>
      <button
        type="button"
        aria-label={`Aumentar quantidade${of}`}
        aria-disabled={!canIncrease || undefined}
        onClick={() => canIncrease && onChange(value + 1)}
        className={cn(STEP_BASE, STEP[variant])}
      >
        <Plus aria-hidden className={icon} strokeWidth={3} />
      </button>
    </div>
  )
}
