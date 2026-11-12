import { z } from 'zod'
import {
  artKeySchema,
  emailSchema,
  ethStringSchema,
  isoDateTimeSchema,
  networkSchema,
  requiredStringSchema,
} from './common'

export const payerSchema = z.object({
  displayName: requiredStringSchema,
  username: requiredStringSchema,
  profileName: requiredStringSchema,
  email: emailSchema,
  ensName: z.string().optional(),
  referralCode: requiredStringSchema,
  walletAddress: requiredStringSchema,
  secondaryAddress: z.string().optional(),
})
export type Payer = z.infer<typeof payerSchema>

/** Wallet app that approved the payment (the receipt shows it under "Carteira"). */
export const connectorSchema = z.enum(['metamask', 'walletconnect', 'coinbase'])
export type ConnectorId = z.infer<typeof connectorSchema>

export const createOrderInputSchema = z.object({
  quoteId: z.string(),
  connector: connectorSchema,
  walletId: z.string().nullable(),
  network: networkSchema,
  payer: payerSchema,
  note: z.string().optional(),
})
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>

export const orderStatusSchema = z.enum(['pending', 'confirmed', 'declined'])
export type OrderStatus = z.infer<typeof orderStatusSchema>

export const orderSchema = z.object({
  id: z.string(),
  status: orderStatusSchema,
  version: z.number().int(),
  createdAt: isoDateTimeSchema,
  resolvedAt: isoDateTimeSchema.nullable(),
  declineReason: z.string().nullable(),
  txHash: z.string(),
  /** Rendered as a link: only http(s) (never javascript:/data:). */
  explorerUrl: z.url({ protocol: /^https?$/ }),
  /** The Idempotency-Key that created it (owner only): lets the client match an unresolved attempt. */
  idempotencyKey: z.string(),
  snapshot: z.object({
    lines: z.array(
      z.object({
        nftId: z.string(),
        name: z.string(),
        art: artKeySchema,
        tokenNumber: z.number().int(),
        editionId: z.string(),
        editionLabel: z.string(),
        unitPrice: ethStringSchema,
        quantity: z.number().int().min(1),
        lineTotal: ethStringSchema,
      }),
    ),
    subtotal: ethStringSchema,
    discount: ethStringSchema,
    networkFee: ethStringSchema,
    total: ethStringSchema,
    walletLabel: z.string(),
    connector: connectorSchema,
    network: networkSchema,
  }),
})
export type Order = z.infer<typeof orderSchema>
