import { z } from 'zod'
import { nftSummarySchema } from './nft'

/** `GET /favorites`: ids for quick "is favorite?" checks plus the summaries for the list page (newest first). */
export const favoritesResponseSchema = z.object({
  nftIds: z.array(z.string()),
  items: z.array(nftSummarySchema),
})
export type FavoritesResponse = z.infer<typeof favoritesResponseSchema>
