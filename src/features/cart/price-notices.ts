import { useSyncExternalStore } from 'react'
import { formatEth } from '@/shared/lib/format'

/** A realtime price change of an NFT in the cart, shown until the collector dismisses it. */
export interface PriceNotice {
  nftId: string
  name: string
  from: string
  to: string
}

let notices: readonly PriceNotice[] = []
const listeners = new Set<() => void>()

function publish(next: readonly PriceNotice[]): void {
  notices = next
  listeners.forEach((listener) => listener())
}

/** Same formatting as every price on screen ("1.50 ETH", not the raw "1.5"). */
export const priceNoticeText = (notice: PriceNotice) =>
  `O preço de ${notice.name} mudou de ${formatEth(notice.from).replace(' ETH', '')} para ${formatEth(notice.to)}`

/** Adds a notice; a newer change of the same NFT replaces the previous one. */
export function pushPriceNotice(notice: PriceNotice): void {
  publish([...notices.filter((n) => n.nftId !== notice.nftId), notice])
}

export function dismissPriceNotices(): void {
  if (notices.length > 0) publish([])
}

export function getPriceNotices(): readonly PriceNotice[] {
  return notices
}

export function subscribePriceNotices(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Cart/payment banner state: realtime price changes of cart NFTs, cleared on dismiss or session end. */
export function useCartNotices() {
  const current = useSyncExternalStore(subscribePriceNotices, getPriceNotices, getPriceNotices)
  return { notices: current, dismiss: dismissPriceNotices }
}
