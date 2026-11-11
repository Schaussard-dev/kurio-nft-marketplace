import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import {
  nftUpdatedDataSchema,
  type Cart,
  type CatalogResponse,
  type EventEnvelope,
  type FavoritesResponse,
  type NftDetail,
  type NftSummary,
  type NftUpdatedData,
} from '@/shared/contracts'

export interface CartPriceChange {
  name: string
  /** Price the cart showed before the event. */
  from: string
  to: string
  /** Every cart line of this NFT is now at 0 available. */
  soldOut: boolean
}

export interface NftUpdateResult {
  cartChange: CartPriceChange | null
}

export const isCartQueryKey = (key: QueryKey) => key[0] === 'guest-cart' || (key[0] === 'user' && key[2] === 'cart')
const isFavoritesKey = (key: QueryKey) => key[0] === 'user' && key[2] === 'favorites'

/**
 * Applies a `nft.updated` event to every cached view of the NFT (detail, catalog pages, carts,
 * favorites) and marks quotes stale so the summary is recomputed by the API. Each cached copy is only
 * patched when it is older than the event, so a late event never regresses fresher REST data.
 */
export function applyNftUpdate(qc: QueryClient, envelope: EventEnvelope): NftUpdateResult {
  const parsed = nftUpdatedDataSchema.safeParse(envelope.data)
  if (!parsed.success) return { cartChange: null }
  const data = parsed.data
  const nftId = envelope.resource.id
  const { version } = envelope
  const isTarget = (nft: NftSummary) => nft.id === nftId && nft.version < version
  const patchSummary = <T extends NftSummary>(nft: T): T =>
    isTarget(nft) ? { ...nft, price: data.price, previousPrice: data.previousPrice, version } : nft

  qc.setQueryData<NftDetail>(queryKeys.nft(nftId), (detail) =>
    detail && isTarget(detail) ? { ...patchSummary(detail), editions: patchEditions(detail.editions, data) } : detail,
  )

  qc.setQueriesData<CatalogResponse>({ queryKey: ['nfts'] }, (page) =>
    page?.items.some(isTarget) ? { ...page, items: page.items.map(patchSummary) } : page,
  )

  qc.setQueriesData<FavoritesResponse>({ predicate: (query) => isFavoritesKey(query.queryKey) }, (favorites) =>
    favorites?.items.some(isTarget) ? { ...favorites, items: favorites.items.map(patchSummary) } : favorites,
  )

  let cartChange: CartPriceChange | null = null
  qc.setQueriesData<Cart>({ predicate: (query) => isCartQueryKey(query.queryKey) }, (cart) => {
    const lines = cart?.lines.filter((line) => isTarget(line.nft))
    if (!cart || !lines?.length) return cart
    const next = {
      ...cart,
      lines: cart.lines.map((line) =>
        isTarget(line.nft)
          ? { ...line, nft: patchSummary(line.nft), edition: patchEditions([line.edition], data)[0]! }
          : line,
      ),
    }
    const patched = next.lines.filter((line) => line.nftId === nftId)
    cartChange ??= {
      name: lines[0]!.nft.name,
      from: lines[0]!.nft.price,
      to: data.price,
      soldOut: patched.every((line) => line.edition.available === 0),
    }
    return next
  })

  void qc.invalidateQueries({ queryKey: ['quote'] })
  return { cartChange }
}

function patchEditions<T extends { id: string; available: number }>(editions: T[], data: NftUpdatedData): T[] {
  return editions.map((edition) => {
    const update = data.editions.find((e) => e.id === edition.id)
    return update ? { ...edition, available: update.available } : edition
  })
}
