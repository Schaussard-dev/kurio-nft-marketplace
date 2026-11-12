import { describe, expect, it } from 'vitest'
import { priceLabel } from './price-label'

describe('priceLabel', () => {
  it('shows the slider draft while the range has room to move', () => {
    expect(priceLabel({ bounds: [2, 1230], draft: [50, 1150], applied: {} })).toBe('Preço: 0,50 - 11,50 ETH')
  })

  it('shows the applied filter, not 0,00 - 0,00, when no NFT is left to give a range', () => {
    expect(priceLabel({ bounds: [0, 0], draft: [0, 0], applied: { maxPrice: '11.50' } })).toBe('Preço: até 11,50 ETH')
    expect(priceLabel({ bounds: [0, 0], draft: [0, 0], applied: { minPrice: '0.5', maxPrice: '3' } })).toBe(
      'Preço: 0,50 - 3,00 ETH',
    )
    expect(priceLabel({ bounds: [0, 0], draft: [0, 0], applied: { minPrice: '2' } })).toBe('Preço: a partir de 2,00 ETH')
  })

  it('without results and without a price filter, says there is no range', () => {
    expect(priceLabel({ bounds: [0, 0], draft: [0, 0], applied: {} })).toBe('Preço: sem faixa disponível')
  })
})
