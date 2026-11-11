import { z } from 'zod'
import { nftSummarySchema } from './nft'

export const favoritesResponseSchema = z.object({
  items: z.array(nftSummarySchema),
})
export type FavoritesResponse = z.infer<typeof favoritesResponseSchema>

export const toggleFavoriteInputSchema = z.object({
  nftId: z.string(),
})
export type ToggleFavoriteInput = z.infer<typeof toggleFavoriteInputSchema>
