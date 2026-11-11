import { z } from 'zod'
import { emailSchema, networkSchema, requiredStringSchema, type Network } from './common'

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export const WALLET_ADDRESS_ERROR = 'Endereço de carteira inválido para a rede selecionada'

export function isValidWalletAddress(network: Network, address: string): boolean {
  return (network === 'solana' ? BASE58_ADDRESS : EVM_ADDRESS).test(address)
}

const walletFieldsSchema = z.object({
  displayName: requiredStringSchema,
  nickname: z.string(),
  network: networkSchema,
  profileName: requiredStringSchema,
  address: requiredStringSchema,
  secondaryAddress: z.string().optional(),
  walletType: z.enum(['metamask', 'walletconnect', 'coinbase']),
  referralCode: z.string(),
  email: emailSchema,
  ensName: z.string(),
  sameAsPrimary: z.boolean(),
})

function refineAddresses(
  value: {
    network: Network
    address: string
    secondaryAddress?: string | undefined
  },
  ctx: z.RefinementCtx,
) {
  if (value.address && !isValidWalletAddress(value.network, value.address)) {
    ctx.addIssue({
      code: 'custom',
      path: ['address'],
      message: WALLET_ADDRESS_ERROR,
    })
  }
  if (value.secondaryAddress && !isValidWalletAddress(value.network, value.secondaryAddress)) {
    ctx.addIssue({
      code: 'custom',
      path: ['secondaryAddress'],
      message: WALLET_ADDRESS_ERROR,
    })
  }
}

export const walletSchema = walletFieldsSchema
  .extend({ id: z.string(), slot: z.enum(['primary', 'secondary']) })
  .superRefine(refineAddresses)
export type Wallet = z.infer<typeof walletSchema>

export const walletInputSchema = walletFieldsSchema.superRefine(refineAddresses)
export type WalletInput = z.infer<typeof walletInputSchema>

export const walletsResponseSchema = z.object({
  primary: walletSchema.nullable(),
  secondary: walletSchema.nullable(),
})
export type WalletsResponse = z.infer<typeof walletsResponseSchema>

/** Secondary-slot shortcut: the server copies the primary wallet, so nothing else is sent. */
export const sameAsPrimaryInputSchema = z.object({
  sameAsPrimary: z.literal(true),
})
export type SameAsPrimaryInput = z.infer<typeof sameAsPrimaryInputSchema>

export const walletConnectionSchema = z.object({
  connected: z.literal(true),
  sessionId: z.string(),
})
export type WalletConnection = z.infer<typeof walletConnectionSchema>
