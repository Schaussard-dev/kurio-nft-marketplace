import { z } from 'zod'
import { ethStringSchema, isoDateTimeSchema, networkSchema } from './common'

export const quoteInputSchema = z.object({
  coupon: z.string().optional(),
  network: networkSchema,
})
export type QuoteInput = z.infer<typeof quoteInputSchema>

export const quoteSchema = z.object({
  quoteId: z.string(),
  lines: z.array(
    z.object({
      lineId: z.string(),
      nftId: z.string(),
      editionId: z.string(),
      unitPrice: ethStringSchema,
      quantity: z.number().int().min(1),
      lineTotal: ethStringSchema,
      available: z.number().int().min(0),
    }),
  ),
  subtotal: ethStringSchema,
  discount: ethStringSchema,
  networkFee: ethStringSchema,
  total: ethStringSchema,
  coupon: z.object({ code: z.string(), percent: z.number() }).nullable(),
  network: networkSchema,
  expiresAt: isoDateTimeSchema,
  fingerprint: z.string(),
})
export type Quote = z.infer<typeof quoteSchema>
