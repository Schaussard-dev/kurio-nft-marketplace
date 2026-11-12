import type { ClampedQuantity } from './quantity'

/**
 * Message next to the buy actions (aria-live): the per-order limit, counting what the cart already
 * holds of this edition, or "Edição indisponível" when there is nothing left to buy (no stock at all,
 * even when the cart still holds units of it).
 */
export function purchaseHint(quantity: ClampedQuantity, inCart: number, available: number): string {
  if (available === 0) return 'Edição indisponível'
  if (inCart > 0 && quantity.limited) return `Você já tem ${inCart} no carrinho; máximo de ${inCart + quantity.max} por pedido`
  if (quantity.max === 0) return 'Edição indisponível'
  return quantity.limited ? `Máximo de ${quantity.max} por pedido` : ''
}
