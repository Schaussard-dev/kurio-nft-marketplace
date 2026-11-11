import type { CartLine } from '@/shared/contracts'
import { outOfStockMessage } from './cache'
import { updateErrorMessage, useUpdateCartLine } from './queries'

/**
 * Stepper props of a cart line (optimistic, reverted on 409) and its stock message: the API refusal
 * ("Apenas N disponíveis") or, without one, a quantity above the stock left.
 */
export function useLineQuantity(line: CartLine) {
  const update = useUpdateCartLine(line.lineId)
  const limit = Math.min(line.edition.available, line.edition.maxPerOrder)
  let message = ''
  if (update.isError) message = updateErrorMessage(update.error)
  else if (line.quantity > line.edition.available) message = outOfStockMessage(line.edition.available)
  return {
    stepper: {
      value: line.quantity,
      max: Math.max(limit, 1),
      itemName: line.nft.name,
      onChange: (quantity: number) => update.mutate({ lineId: line.lineId, quantity }),
    },
    message,
  }
}

export const tokenLabel = (line: CartLine) => `#${String(line.nft.tokenNumber).padStart(4, '0')}`
