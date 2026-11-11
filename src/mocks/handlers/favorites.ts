import { http, HttpResponse } from 'msw'
import type { FavoritesResponse } from '@/shared/contracts'
import { getDb, mutate } from '../db/store'
import type { MockDb } from '../db/schema'
import { apiError, withNetwork } from '../network'
import { requireUser } from './auth'
import { toSummary } from './nfts'

/** The user's favorites, most recently added first; NFTs that no longer exist are skipped. */
export function listFavorites(db: Pick<MockDb, 'nfts' | 'favorites'>, userId: string): FavoritesResponse {
  const items = db.favorites
    .filter((favorite) => favorite.userId === userId)
    .reverse()
    .flatMap(({ nftId }) => {
      const nft = db.nfts.find((item) => item.id === nftId)
      return nft ? [toSummary(nft)] : []
    })
  return { nftIds: items.map((item) => item.id), items }
}

export const favoriteHandlers = [
  http.get(
    '/api/favorites',
    withNetwork(({ request }) => {
      const user = requireUser(request)
      if (user instanceof Response) return user
      return HttpResponse.json(listFavorites(getDb(), user.id))
    }),
  ),

  // Idempotent: favoriting twice keeps a single record.
  http.put(
    '/api/favorites/:nftId',
    withNetwork(({ request, params }) => {
      const user = requireUser(request)
      if (user instanceof Response) return user
      const nftId = String(params.nftId)
      if (!getDb().nfts.some((nft) => nft.id === nftId)) return apiError(404, 'NOT_FOUND', 'NFT não encontrado')
      mutate((db) => {
        const exists = db.favorites.some((f) => f.userId === user.id && f.nftId === nftId)
        if (!exists) db.favorites.push({ userId: user.id, nftId })
      })
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  // Idempotent: removing a missing favorite is still 204.
  http.delete(
    '/api/favorites/:nftId',
    withNetwork(({ request, params }) => {
      const user = requireUser(request)
      if (user instanceof Response) return user
      const nftId = String(params.nftId)
      mutate((db) => {
        db.favorites = db.favorites.filter((f) => !(f.userId === user.id && f.nftId === nftId))
      })
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
