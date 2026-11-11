import { useState } from 'react'
import { ArtImage } from '@/features/catalog/components/ArtImage'
import { CouponForm } from '@/features/cart/components/CouponForm'
import { OrderSummary } from '@/features/cart/components/OrderSummary'
import { OrderSummarySkeleton } from '@/features/cart/components/OrderSummarySkeleton'
import { tokenLabel } from '@/features/cart/line-quantity'
import type { CartLine, Quote } from '@/shared/contracts'
import { formatEth } from '@/shared/lib/format'
import { Skeleton } from '@/shared/ui/Skeleton'

export interface CouponControl {
  code: string | undefined
  applied: Quote['coupon']
  error: string | undefined
  checking: boolean
  onApply: (code: string) => void
  onRemove: () => void
}

/**
 * Desktop right column: "Seus NFTs" (cart lines with the API line totals), the coupon and the summary.
 * Every value comes from the API quote; nothing is computed on the client.
 */
export function CheckoutSummary({
  lines,
  quote,
  updating,
  coupon,
}: {
  lines: CartLine[]
  quote: Quote | undefined
  updating: boolean
  coupon: CouponControl
}) {
  const [couponOpen, setCouponOpen] = useState(Boolean(coupon.code))
  const lineTotal = (lineId: string) => quote?.lines.find((line) => line.lineId === lineId)?.lineTotal

  return (
    <section aria-labelledby="seus-nfts-titulo" className="flex flex-col gap-4">
      <h2 id="seus-nfts-titulo" className="text-title-20 font-bold text-foreground">
        Seus NFTs
      </h2>
      <div
        aria-hidden
        className="flex justify-between border-b border-border-strong pb-3 text-body-lg-17 font-bold text-foreground"
      >
        <span>NFTs</span>
        <span>Subtotal</span>
      </div>
      <ul aria-label="Itens do pedido" className="flex flex-col gap-4">
        {lines.map((line) => {
          const total = lineTotal(line.lineId)
          return (
            <li key={line.lineId} className="flex items-center gap-3 rounded-xs bg-surface pr-4">
              <ArtImage art={line.nft.art} sizes="80px" alt="" className="size-20 shrink-0 rounded-l-xs object-cover" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-body-lg-17 font-bold text-foreground">{line.nft.name}</span>
                <span className="truncate text-body-15 text-text-accent">ID do token: {tokenLabel(line)}</span>
              </div>
              <span className="text-body-15 whitespace-nowrap text-text-secondary">
                <span className="sr-only">quantidade: </span>(x {line.quantity})
              </span>
              <span className="w-24 text-right text-body-lg-18 font-bold whitespace-nowrap text-text-accent">
                {total ? formatEth(total) : <Skeleton className="ml-auto h-5 w-20" />}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          aria-expanded={couponOpen}
          onClick={() => setCouponOpen((open) => !open)}
          className="self-center text-body-15 text-foreground underline-offset-4 hover:underline"
        >
          Tem um código promocional? Aplique aqui
        </button>
        {couponOpen && (
          <CouponForm
            key={coupon.code ?? ''}
            code={coupon.code}
            applied={coupon.applied}
            error={coupon.error}
            checking={coupon.checking}
            onApply={coupon.onApply}
            onRemove={coupon.onRemove}
            variant="desktop"
          />
        )}
      </div>

      {quote ? <OrderSummary quote={quote} updating={updating} testIdPrefix="checkout" /> : <OrderSummarySkeleton />}
    </section>
  )
}
