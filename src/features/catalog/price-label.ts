import { fromCents, toCents } from '@/shared/lib/money'

const br = (cents: number) => fromCents(cents).replace('.', ',')

interface PriceLabelInput {
  /** Slider bounds in cents (from the API price range of the other filters). */
  bounds: [number, number]
  /** Current slider values in cents. */
  draft: [number, number]
  /** Price filter applied in the URL. */
  applied: { minPrice?: string; maxPrice?: string }
}

/**
 * "Preço: 0,50 - 11,50 ETH" (Figma). With no NFT left the API range collapses to 0–0: show the price
 * filter still applied instead of a misleading "0,00 - 0,00".
 */
export function priceLabel({ bounds, draft, applied }: PriceLabelInput): string {
  const empty = bounds[0] === 0 && bounds[1] === 0
  if (!empty) return `Preço: ${br(draft[0])} - ${br(draft[1])} ETH`
  const min = applied.minPrice ? br(toCents(applied.minPrice)) : undefined
  const max = applied.maxPrice ? br(toCents(applied.maxPrice, 'ceil')) : undefined
  if (min && max) return `Preço: ${min} - ${max} ETH`
  if (max) return `Preço: até ${max} ETH`
  if (min) return `Preço: a partir de ${min} ETH`
  return 'Preço: sem faixa disponível'
}
