import { z } from 'zod'
import { ethStringSchema, isoDateTimeSchema } from './common'
import { orderSchema, orderStatusSchema } from './orders'

export const eventTypeSchema = z.enum(['nft.updated', 'order.updated', 'wallet.disconnected'])
export type EventType = z.infer<typeof eventTypeSchema>

export const eventEnvelopeSchema = z.object({
  eventId: z.string(),
  type: eventTypeSchema,
  resource: z.object({ type: z.string(), id: z.string() }),
  version: z.number().int(),
  occurredAt: isoDateTimeSchema,
  userId: z.string().nullable(),
  data: z.unknown(),
})
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>

export const nftUpdatedDataSchema = z.object({
  price: ethStringSchema,
  previousPrice: ethStringSchema.nullable(),
  editions: z.array(z.object({ id: z.string(), available: z.number().int().min(0) })),
})
export type NftUpdatedData = z.infer<typeof nftUpdatedDataSchema>

export const orderUpdatedDataSchema = z.object({
  status: orderStatusSchema,
  order: orderSchema,
})
export type OrderUpdatedData = z.infer<typeof orderUpdatedDataSchema>
