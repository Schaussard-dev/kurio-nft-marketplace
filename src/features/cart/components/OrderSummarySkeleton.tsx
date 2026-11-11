import { Skeleton } from '@/shared/ui/Skeleton'
import { FeeNote, SummaryRow } from './OrderSummary'

/** Same rows and heights as OrderSummary, with shimmering values (no layout shift when the quote lands). */
export function OrderSummarySkeleton() {
  const value = (width: string) => <Skeleton className={`h-5 ${width}`} />
  return (
    <dl aria-busy="true" aria-label="Carregando resumo" className="flex flex-col gap-3">
      <SummaryRow row="subtotal" label="Subtotal">
        {value('w-24')}
      </SummaryRow>
      <SummaryRow row="discount" label="Desconto do lançamento">
        {value('w-16')}
      </SummaryRow>
      <SummaryRow row="fee" label="Taxa de rede" note={<FeeNote />}>
        {value('w-20')}
      </SummaryRow>
      <SummaryRow row="total" label="Total">
        {value('w-28')}
      </SummaryRow>
    </dl>
  )
}
