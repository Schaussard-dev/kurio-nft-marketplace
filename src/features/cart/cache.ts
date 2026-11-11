import type { Cart } from '@/shared/contracts'

/** Optimistic quantity change of one line (immutable). */
export function setLineQuantity(cart: Cart | undefined, lineId: string, quantity: number): Cart | undefined {
  if (!cart) return cart
  return { ...cart, lines: cart.lines.map((line) => (line.lineId === lineId ? { ...line, quantity } : line)) }
}

/** Header/tab bar badge: number of NFTs in the cart (sum of quantities). */
export function cartItemCount(cart: Cart | undefined): number {
  return cart?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0
}

export function outOfStockMessage(available: number): string {
  if (available <= 0) return 'Esgotado'
  return `Apenas ${available} ${available === 1 ? 'disponível' : 'disponíveis'}`
}

export interface StockIssue {
  lineId: string
  name: string
  available: number
}

/** Lines asking for more than the stock left: checkout stays blocked until they are adjusted. */
export function stockIssues(cart: Cart | undefined): StockIssue[] {
  return (cart?.lines ?? [])
    .filter((line) => line.quantity > line.edition.available)
    .map((line) => ({ lineId: line.lineId, name: line.nft.name, available: line.edition.available }))
}
