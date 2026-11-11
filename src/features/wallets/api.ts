import { request } from '@/shared/api/http'
import {
  walletConnectionSchema,
  walletSchema,
  walletsResponseSchema,
  type SameAsPrimaryInput,
  type Wallet,
  type WalletConnection,
  type WalletInput,
  type WalletsResponse,
} from '@/shared/contracts'

export type WalletSlot = Wallet['slot']

export function fetchWallets(signal?: AbortSignal): Promise<WalletsResponse> {
  return request({ url: '/wallets', signal }, walletsResponseSchema)
}

/** Upsert: creates the slot when empty (201), updates it otherwise (200). */
export function saveWallet(slot: WalletSlot, input: WalletInput | SameAsPrimaryInput): Promise<Wallet> {
  return request({ method: 'PUT', url: `/wallets/${slot}`, data: input }, walletSchema)
}

/** Asks the (simulated) wallet to approve the connection; rejects with `WALLET_REJECTED` (409) when refused. */
export function connectWallet(walletId: string): Promise<WalletConnection> {
  return request({ method: 'POST', url: `/wallets/${encodeURIComponent(walletId)}/connect` }, walletConnectionSchema)
}
