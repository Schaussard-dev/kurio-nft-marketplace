import { z } from 'zod'
import { request } from '@/shared/api/http'
import { favoritesResponseSchema, type FavoritesResponse } from '@/shared/contracts'

// PUT/DELETE answer 204 without a body.
const noContentSchema = z.unknown()

export function fetchFavorites(signal?: AbortSignal): Promise<FavoritesResponse> {
  return request({ url: '/favorites', method: 'GET', signal }, favoritesResponseSchema)
}

export async function setFavorite(nftId: string, favorite: boolean): Promise<void> {
  await request(
    { url: `/favorites/${encodeURIComponent(nftId)}`, method: favorite ? 'PUT' : 'DELETE' },
    noContentSchema,
  )
}
