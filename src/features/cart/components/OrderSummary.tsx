import type { ReactNode } from 'react'
import type { Quote } from '@/shared/contracts'
import { formatDiscount, formatEth } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

type Row = 'subtotal' | 'discount' | 'fee' | 'total'

/** One summary row; the value slot is shared with the skeleton so both have the same height. */
export function SummaryRow({ row, label, children, note }: { row: Row; label: string; children: ReactNode; note?: ReactNode }) {
  const total = row === 'total'
  return (
    <div className={cn('flex items-start justify-between gap-3', total && 'mt-4')}>
      <dt className={cn('text-body-lg-17 leading-7 whitespace-nowrap text-foreground', total && 'font-bold')}>{label}</dt>
      <dd className="flex flex-col items-end gap-1 text-right">
        <span
          data-testid={`summary-${row}`}
          className={cn(
            'flex h-7 items-center whitespace-nowrap',
            total ? 'text-title-22 font-bold text-text-accent' : 'text-body-lg-18 text-foreground',
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
  return <span className="text-caption-13 text-text-accent">Taxa estimada</span>
}

/**
 * "Resumo" values exactly as the API quote returns them (never computed on the client).
 * `updating`: a newer quote is loading (cart or coupon changed), so the values are marked stale.
 */
export function OrderSummary({ quote, updating }: { quote: Quote; updating: boolean }) {
  return (
    <dl aria-busy={updating} className={cn('flex flex-col gap-3 transition-opacity', updating && 'opacity-60')}>
      <SummaryRow row="subtotal" label="Subtotal">
        {formatEth(quote.subtotal)}
      </SummaryRow>
      <SummaryRow row="discount" label="Desconto do lançamento">
        {formatDiscount(quote.discount)}
      </SummaryRow>
      <SummaryRow row="fee" label="Taxa de rede" note={<FeeNote />}>
        {formatEth(quote.networkFee)}
      </SummaryRow>
      <SummaryRow row="total" label="Total">
        {formatEth(quote.total)}
      </SummaryRow>
    </dl>
  )
}
