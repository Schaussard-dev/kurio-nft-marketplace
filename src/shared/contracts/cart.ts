import { z } from 'zod'
import { editionSchema, nftSummarySchema } from './nft'

export const cartLineSchema = z.object({
  lineId: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  quantity: z.number().int().min(1),
  nft: nftSummarySchema,
  edition: editionSchema,
})
export type CartLine = z.infer<typeof cartLineSchema>

export const cartSchema = z.object({
  id: z.string(),
  owner: z.object({ type: z.enum(['guest', 'user']), id: z.string() }),
  lines: z.array(cartLineSchema),
  version: z.number().int(),
})
export type Cart = z.infer<typeof cartSchema>

export const addCartItemInputSchema = z.object({
  nftId: z.string(),
  editionId: z.string(),
  quantity: z.number().int().min(1),
})
export type AddCartItemInput = z.infer<typeof addCartItemInputSchema>

export const updateCartItemInputSchema = z.object({
  quantity: z.number().int().min(1),
})
export type UpdateCartItemInput = z.infer<typeof updateCartItemInputSchema>

export const mergeCartResultSchema = z.object({
  cart: cartSchema,
  adjustments: z.array(
    z.object({
      lineId: z.string(),
      requested: z.number().int(),
      applied: z.number().int(),
      reason: z.literal('stock'),
    }),
  ),
})
export type MergeCartResult = z.infer<typeof mergeCartResultSchema>
