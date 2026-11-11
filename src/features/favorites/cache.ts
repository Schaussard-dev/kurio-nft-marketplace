import type { FavoritesResponse, NftSummary } from '@/shared/contracts'

export interface FavoriteChange {
  nftId: string
  favorite: boolean
  /** When known (catalog card, detail page), the list page can show the item before the refetch. */
  summary?: NftSummary
}

/** Pure optimistic update of the favorites cache. Never mutates `data`. */
export function applyFavorite(data: FavoritesResponse | undefined, change: FavoriteChange): FavoritesResponse {
  const current = data ?? { nftIds: [], items: [] }
  const nftIds = current.nftIds.filter((id) => id !== change.nftId)
  const items = current.items.filter((item) => item.id !== change.nftId)
  if (!change.favorite) return { nftIds, items }
  if (current.nftIds.includes(change.nftId)) return current
  return {
    nftIds: [change.nftId, ...nftIds],
    items: change.summary ? [change.summary, ...items] : items,
  }
}

/**
 * Rolls back one failed change on top of the current cache (not the whole snapshot), so toggles of
 * other NFTs made meanwhile are kept. A failed removal gets its summary back from the snapshot.
 */
export function revertFavorite(
  current: FavoritesResponse | undefined,
  failed: FavoriteChange,
  snapshot: FavoritesResponse | undefined,
): FavoritesResponse {
  const summary = snapshot?.items.find((item) => item.id === failed.nftId) ?? failed.summary
  return applyFavorite(current, { nftId: failed.nftId, favorite: !failed.favorite, summary })
}
