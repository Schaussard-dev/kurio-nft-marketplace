import { ArtImage } from '@/features/catalog/components/ArtImage'
import { QuantityStepper } from '@/features/nft/components/QuantityStepper'
import { formatEth } from '@/shared/lib/format'
import { tokenLabel, useLineQuantity } from '../line-quantity'
import { LineMessage, LineName, LineTotal, RemoveLineButton, type CartLineProps } from './CartLineParts'

const CELL = 'bg-surface align-middle'
/** Price, quantity and total cells keep a gap from their neighbours (large values never touch). */
const NUM = 'px-3'

/** Desktop/Carrinho table row: art + name + token id, unit price, − qty +, line total, trash. */
export function CartLineRow({ line, lineTotal, onRemove, removing }: CartLineProps) {
  const { stepper, message } = useLineQuantity(line)
  return (
    <tr data-testid="cart-line">
      {/* max-w-0: the name column gives way (names truncate) instead of pushing the numbers together. */}
      <td className={`${CELL} max-w-0 rounded-l-sm`}>
        <div className="flex items-center gap-5">
          <ArtImage art={line.nft.art} sizes="80px" alt="" className="size-20 shrink-0 rounded-l-sm object-cover" />
          <div className="flex min-w-0 flex-col gap-0.5 py-2">
            <LineName line={line} className="truncate text-body-lg-16" />
            <span className="truncate text-body-14 text-muted">ID do token: {tokenLabel(line)}</span>
            <span className="truncate text-caption-13 text-text-secondary">Edição: {line.edition.label}</span>
            <LineMessage message={message} />
          </div>
        </div>
      </td>
      <td className={`${CELL} ${NUM} text-body-lg-16 font-bold whitespace-nowrap text-foreground`}>{formatEth(line.nft.price)}</td>
      <td className={`${CELL} ${NUM}`}>
        <QuantityStepper {...stepper} variant="pill-sm" className="gap-2" />
      </td>
      <td className={`${CELL} ${NUM} text-body-lg-16 font-bold whitespace-nowrap text-text-accent`}>
        <LineTotal value={lineTotal} />
      </td>
      <td className={`${CELL} rounded-r-sm pr-4 text-right`}>
        <RemoveLineButton line={line} onRemove={onRemove} removing={removing} />
      </td>
    </tr>
  )
}
