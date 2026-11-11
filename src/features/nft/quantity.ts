import type { Edition } from '@/shared/contracts'

export interface ClampedQuantity {
  value: number
  /** True when `value` sits at the ceiling (the user cannot add more). */
  limited: boolean
  max: number
}

/** Quantity bounded by stock (minus what is already in the cart) and the per-order cap; min 1, 0 when sold out. */
export function clampQuantity(requested: number, edition: Edition, alreadyInCart = 0): ClampedQuantity {
  const max = Math.max(0, Math.min(edition.available - alreadyInCart, edition.maxPerOrder))
  if (max === 0) return { value: 0, limited: true, max: 0 }
  const wanted = Number.isFinite(requested) ? Math.floor(requested) : 1
  const value = Math.min(Math.max(1, wanted), max)
  return { value, limited: value >= max, max }
}

/** First edition with stock; the first edition when all are sold out (the page then shows "Edição indisponível"). */
export function defaultEdition(editions: Edition[]): Edition | undefined {
  return editions.find((edition) => edition.available > 0) ?? editions[0]
}

/** The edition requested in the URL when it exists and has stock, otherwise the default edition. */
export function resolveEdition(editions: Edition[], requestedId: string | undefined): Edition | undefined {
  const requested = editions.find((edition) => edition.id === requestedId)
  return requested && requested.available > 0 ? requested : defaultEdition(editions)
}
