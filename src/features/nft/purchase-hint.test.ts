import { describe, expect, it } from 'vitest'
import { purchaseHint } from './purchase-hint'

describe('purchaseHint', () => {
  it('is empty below the limit', () => {
    expect(purchaseHint({ value: 1, limited: false, max: 4 }, 0)).toBe('')
  })

  it('states the per-order maximum without cart items', () => {
    expect(purchaseHint({ value: 4, limited: true, max: 4 }, 0)).toBe('Máximo de 4 por pedido')
  })

  it('accounts for what is already in the cart', () => {
    expect(purchaseHint({ value: 1, limited: true, max: 1 }, 3)).toBe('Você já tem 3 no carrinho; máximo de 4 por pedido')
    expect(purchaseHint({ value: 0, limited: true, max: 0 }, 4)).toBe('Você já tem 4 no carrinho; máximo de 4 por pedido')
  })

  it('says the edition is unavailable when sold out and not in the cart', () => {
    expect(purchaseHint({ value: 0, limited: true, max: 0 }, 0)).toBe('Edição indisponível')
  })
})
