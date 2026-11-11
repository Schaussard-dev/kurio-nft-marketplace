import { z } from 'zod'
import { nftSummarySchema } from './nft'

export const favoritesResponseSchema = z.object({
  items: z.array(nftSummarySchema),
})
export type FavoritesResponse = z.infer<typeof favoritesResponseSchema>
