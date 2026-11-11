import { describe, expect, it } from 'vitest'
import { isPrivatePath } from './private-paths'

describe('isPrivatePath', () => {
  it.each([
    ['/perfil', true],
    ['/perfil/carteiras?x=1', true],
    ['/pagamento', true],
    ['/pedidos/ord_1', true],
    ['/', false],
    ['/nft/nft_001', false],
    ['/perfilx', false],
    ['/carrinho?redirect=/perfil', false],
  ])('%s → %s', (path, expected) => {
    expect(isPrivatePath(path)).toBe(expected)
  })
})
