import { priceNoticeText, useCartNotices } from '../price-notices'
import { ChangeNotice } from './ChangeNotice'

/**
 * Realtime price changes of NFTs still in the cart (cart and payment pages). The summary already shows
 * the new API quote; this tells the collector why it changed until they dismiss it.
 */
export function PriceChangeNotice({ nftIds }: { nftIds: readonly string[] }) {
  const { notices, dismiss } = useCartNotices()
  const shown = notices.filter((notice) => nftIds.includes(notice.nftId))
  if (shown.length === 0) return null
  return (
    <ChangeNotice
      testId="price-notice"
      live={false}
      title={shown.length === 1 ? 'Preço atualizado' : 'Preços atualizados'}
      items={shown.map(priceNoticeText)}
      onDismiss={dismiss}
      dismissLabel="Dispensar aviso de preços"
    />
  )
}
