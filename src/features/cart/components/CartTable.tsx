import type { CartLine, Quote } from '@/shared/contracts'
import { Skeleton } from '@/shared/ui/Skeleton'
import { CartLineCard } from './CartLineCard'
import { CartLineRow } from './CartLineRow'

interface CartTableProps {
  lines: CartLine[] | undefined
  /** Line totals come from the quote, never computed here. */
  quote: Quote | undefined
  layout: 'table' | 'cards'
  onRemove: (line: CartLine) => void
  removingId: string | undefined
}

const TH = 'border-b border-border-strong pb-3 text-left text-body-lg-17 font-bold text-foreground'

/** Cart lines: a real table on desktop (NFTs, Preço, Edições, Total), cards on mobile. */
export function CartTable({ lines, quote, layout, onRemove, removingId }: CartTableProps) {
  // A quote for an older quantity (new one loading) must not show a stale total next to the new quantity.
  const totalOf = (line: CartLine) => {
    const priced = quote?.lines.find((q) => q.lineId === line.lineId)
    return priced?.quantity === line.quantity ? priced.lineTotal : undefined
  }

  if (layout === 'cards') {
    return (
      <ul aria-label="Itens do carrinho" aria-busy={!lines} className="flex flex-col gap-4">
        {lines
          ? lines.map((line) => (
              <CartLineCard
                key={line.lineId}
                line={line}
                lineTotal={totalOf(line)}
                onRemove={onRemove}
                removing={removingId === line.lineId}
              />
            ))
          : Array.from({ length: 3 }, (_, index) => (
              <li key={index}>
                <Skeleton className="h-[120px] rounded-[20px]" />
              </li>
            ))}
      </ul>
    )
  }

  return (
    <table aria-busy={!lines} className="w-full border-separate border-spacing-y-3">
      <caption className="sr-only">Itens do carrinho</caption>
      <thead>
        <tr>
          <th scope="col" className={`${TH} w-[46%]`}>
            NFTs
          </th>
          <th scope="col" className={TH}>
            Preço
          </th>
          <th scope="col" className={TH}>
            Edições
          </th>
          <th scope="col" className={TH}>
            Total
          </th>
          <th scope="col" className={TH}>
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {lines
          ? lines.map((line) => (
              <CartLineRow
                key={line.lineId}
                line={line}
                lineTotal={totalOf(line)}
                onRemove={onRemove}
                removing={removingId === line.lineId}
              />
            ))
          : Array.from({ length: 3 }, (_, index) => (
              <tr key={index}>
                <td colSpan={5}>
                  <Skeleton className="h-20 rounded-sm" />
                </td>
              </tr>
            ))}
      </tbody>
    </table>
  )
}
