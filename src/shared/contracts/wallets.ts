import { z } from 'zod'
import { emailSchema, networkSchema, type Network } from './common'
import { ENS_NAME_PATTERN } from './profile'

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export const WALLET_ADDRESS_ERROR = 'Endereço de carteira inválido para a rede selecionada'

export function isValidWalletAddress(network: Network, address: string): boolean {
  return (network === 'solana' ? BASE58_ADDRESS : EVM_ADDRESS).test(address)
}

export const WALLET_SECONDARY_ERROR = 'Informe um endereço válido para a rede ou um nome ENS (.eth)'
export const WALLET_ENS_REQUIRED_ERROR = 'Campo obrigatório'
export const WALLET_ENS_ERROR = 'Nome ENS inválido: use letras, números ou hífen'

/** The optional secondary field takes either an address valid for the network or a full ENS name. */
export function isValidSecondaryWallet(network: Network, value: string): boolean {
  return isValidWalletAddress(network, value) || (value.length > 0 && ENS_NAME_PATTERN.test(value))
}

const requiredText = (message = 'Campo obrigatório') => z.string().trim().min(1, message)

const walletFieldsSchema = z.object({
  displayName: requiredText(),
  nickname: z.string().trim(),
  network: networkSchema,
  profileName: requiredText(),
  address: requiredText(),
  secondaryAddress: z.string().trim().optional(),
  walletType: z.enum(['metamask', 'walletconnect', 'coinbase']),
  referralCode: z.string().trim(),
  email: emailSchema,
  ensName: z.string().trim(),
  sameAsPrimary: z.boolean(),
})

function refineWallet(
  value: {
    network: Network
    address: string
    secondaryAddress?: string | undefined
    ensName: string
  },
  ctx: z.RefinementCtx,
) {
  if (value.address && !isValidWalletAddress(value.network, value.address)) {
    ctx.addIssue({ code: 'custom', path: ['address'], message: WALLET_ADDRESS_ERROR })
  }
  if (value.secondaryAddress && !isValidSecondaryWallet(value.network, value.secondaryAddress)) {
    ctx.addIssue({ code: 'custom', path: ['secondaryAddress'], message: WALLET_SECONDARY_ERROR })
  }
  // Spec: the ENS (.eth) name is optional outside Ethereum.
  if (!value.ensName) {
    if (value.network === 'ethereum') {
      ctx.addIssue({ code: 'custom', path: ['ensName'], message: WALLET_ENS_REQUIRED_ERROR })
    }
  } else if (!ENS_NAME_PATTERN.test(value.ensName)) {
    ctx.addIssue({ code: 'custom', path: ['ensName'], message: WALLET_ENS_ERROR })
  }
}

export const walletSchema = walletFieldsSchema
  .extend({ id: z.string(), slot: z.enum(['primary', 'secondary']) })
  .superRefine(refineWallet)
export type Wallet = z.infer<typeof walletSchema>

export const walletInputSchema = walletFieldsSchema.superRefine(refineWallet)
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
