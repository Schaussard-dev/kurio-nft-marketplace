import { ArtImage } from '@/features/catalog/components/ArtImage'
import { QuantityStepper } from '@/features/nft/components/QuantityStepper'
import { formatEth } from '@/shared/lib/format'
import { tokenLabel, useLineQuantity } from '../line-quantity'
import { LineMessage, LineName, LineTotal, RemoveLineButton, type CartLineProps } from './CartLineParts'

const CELL = 'bg-surface align-middle'

/** Desktop/Carrinho table row: art + name + token id, unit price, − qty +, line total, trash. */
export function CartLineRow({ line, lineTotal, onRemove, removing }: CartLineProps) {
  const { stepper, message } = useLineQuantity(line)
  return (
    <tr data-testid="cart-line">
      <td className={`${CELL} rounded-l-sm`}>
        <div className="flex items-center gap-5">
          <ArtImage art={line.nft.art} sizes="80px" alt="" className="size-20 shrink-0 rounded-l-sm object-cover" />
          <div className="flex min-w-0 flex-col gap-0.5 py-2">
            <LineName line={line} className="truncate text-body-lg-16" />
            <span className="text-body-14 whitespace-nowrap text-muted">ID do token: {tokenLabel(line)}</span>
            <span className="text-caption-13 whitespace-nowrap text-text-secondary">Edição: {line.edition.label}</span>
            <LineMessage message={message} />
          </div>
        </div>
      </td>
      <td className={`${CELL} text-body-lg-16 font-bold whitespace-nowrap text-foreground`}>{formatEth(line.nft.price)}</td>
      <td className={CELL}>
        <QuantityStepper {...stepper} variant="pill-sm" className="gap-2" />
      </td>
      <td className={`${CELL} text-body-lg-16 font-bold whitespace-nowrap text-text-accent`}>
        <LineTotal value={lineTotal} />
      </td>
      <td className={`${CELL} rounded-r-sm pr-4 text-right`}>
        <RemoveLineButton line={line} onRemove={onRemove} removing={removing} />
      </td>
    </tr>
  )
}
