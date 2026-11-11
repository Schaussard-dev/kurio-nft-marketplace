import { ArtImage } from '@/features/catalog/components/ArtImage'
import { QuantityStepper } from '@/features/nft/components/QuantityStepper'
import { useLineQuantity } from '../line-quantity'
import { LineMessage, LineName, LineTotal, RemoveLineButton, type CartLineProps } from './CartLineParts'

/** Mobile/Carrinho card: art, name, edition, line total, round − qty + and a remove button. */
export function CartLineCard({ line, lineTotal, onRemove, removing }: CartLineProps) {
  const { stepper, message } = useLineQuantity(line)
  return (
    <li data-testid="cart-line" className="flex min-h-[120px] overflow-hidden rounded-[20px] bg-surface">
      <div className="w-[100px] shrink-0 [&_picture]:block [&_picture]:h-full">
        <ArtImage art={line.nft.art} sizes="110px" alt="" className="h-full w-full object-cover" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-3 pr-3 pl-4">
        <div className="flex items-start justify-between gap-1">
          <LineName line={line} className="text-body-lg-17 leading-6" />
          <RemoveLineButton line={line} onRemove={onRemove} removing={removing} className="-mt-1.5 -mr-1 size-9 shrink-0" />
        </div>
        <span className="text-body-15 text-text-secondary">Edição: {line.edition.label}</span>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <LineTotal value={lineTotal} className="text-title-20 font-bold text-text-accent" />
          <QuantityStepper {...stepper} variant="round" className="gap-2" />
        </div>
        <LineMessage message={message} />
      </div>
    </li>
  )
}
