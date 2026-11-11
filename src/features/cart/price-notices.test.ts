import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dismissPriceNotices, getPriceNotices, priceNoticeText, pushPriceNotice, subscribePriceNotices } from './price-notices'

describe('price notices store', () => {
  beforeEach(() => dismissPriceNotices())

  it('keeps one notice per NFT (the latest change) and notifies subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = subscribePriceNotices(listener)
    pushPriceNotice({ nftId: 'nft_042', name: 'Emerald Ape #042', from: '1.19', to: '1.29' })
    pushPriceNotice({ nftId: 'nft_314', name: 'Violet Nomad #314', from: '1.39', to: '1.2' })
    pushPriceNotice({ nftId: 'nft_042', name: 'Emerald Ape #042', from: '1.29', to: '1.39' })
    expect(getPriceNotices().map(priceNoticeText)).toEqual([
      'O preço de Violet Nomad #314 mudou de 1.39 para 1.2 ETH',
      'O preço de Emerald Ape #042 mudou de 1.29 para 1.39 ETH',
    ])
    expect(listener).toHaveBeenCalledTimes(3)
    unsubscribe()
    dismissPriceNotices()
    expect(getPriceNotices()).toEqual([])
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
