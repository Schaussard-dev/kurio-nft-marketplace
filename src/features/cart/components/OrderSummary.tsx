import type { ReactNode } from 'react'
import type { Quote } from '@/shared/contracts'
import { formatDiscount, formatEth } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

type Row = 'subtotal' | 'discount' | 'fee' | 'total'

/** One summary row; the value slot is shared with the skeleton so both have the same height. */
export function SummaryRow({
  row,
  label,
  children,
  note,
  testIdPrefix = 'summary',
}: {
  row: Row
  label: string
  children: ReactNode
  note?: ReactNode
  testIdPrefix?: string
}) {
  const total = row === 'total'
  return (
    <div className={cn('flex items-start justify-between gap-2', total && 'mt-4')}>
      {/* The label wraps on narrow phones; the amount never shrinks or wraps. */}
      <dt className={cn('min-w-0 leading-7 text-foreground', total ? 'text-body-lg-16 font-bold' : 'text-body-15')}>{label}</dt>
      <dd className="flex shrink-0 flex-col items-end gap-1 text-right">
        <span
          data-testid={`${testIdPrefix}-${row}`}
          className={cn(
            'flex h-7 items-center whitespace-nowrap',
            total ? 'text-title-22 font-bold text-text-accent' : 'text-body-lg-16 text-foreground md:text-body-15',
          )}
        >
          {children}
        </span>
        {note}
      </dd>
    </div>
  )
}

export function FeeNote() {
  return <span className="text-caption-12 text-text-accent">Taxa estimada</span>
}

/**
 * "Resumo" values exactly as the API quote returns them (never computed on the client).
 * `updating`: a newer quote is loading (cart or coupon changed), so the values are marked stale.
 */
export function OrderSummary({
  quote,
  updating,
  testIdPrefix,
}: {
  quote: Quote
  updating: boolean
  /** Test ids `<prefix>-subtotal|discount|fee|total` (default "summary"). */
  testIdPrefix?: string
}) {
  return (
    <dl aria-busy={updating} className={cn('flex flex-col gap-3 transition-opacity', updating && 'opacity-60')}>
      <SummaryRow row="subtotal" label="Subtotal" testIdPrefix={testIdPrefix}>
        {formatEth(quote.subtotal)}
      </SummaryRow>
      <SummaryRow row="discount" label="Desconto do lançamento" testIdPrefix={testIdPrefix}>
        {formatDiscount(quote.discount)}
      </SummaryRow>
      <SummaryRow row="fee" label="Taxa de rede" note={<FeeNote />} testIdPrefix={testIdPrefix}>
        {formatEth(quote.networkFee)}
      </SummaryRow>
      <SummaryRow row="total" label="Total" testIdPrefix={testIdPrefix}>
        {formatEth(quote.total)}
      </SummaryRow>
    </dl>
  )
}
