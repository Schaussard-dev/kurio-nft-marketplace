import type { NftDetail, Order, Wallet } from '@/shared/contracts'
import type { PasswordRecord } from './password'

export type ScenarioName =
  | 'default'
  | 'empty'
  | 'slow'
  | 'jitter'
  | 'offline'
  | 'server-error'
  | 'favorite-fail'
  | 'session-expired'
  | 'signup-conflict'
  | 'price-change'
  | 'sold-out'
  | 'order-timeout'
  | 'payment-declined'
  | 'wallet-reject'

export interface UserRecord {
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl: string | null
  walletNickname: string
  ensName: string
  passwordRecord: PasswordRecord
  createdAt: string
}

export interface SessionRecord {
  token: string
  userId: string
  expiresAt: string
}

/** Same fields as the NftDetail contract (incl. reviews, editions, version). */
export type NftRecord = NftDetail

export interface CartLineRecord {
  lineId: string
  nftId: string
  editionId: string
  quantity: number
}

export interface CartRecord {
  id: string
  owner: { type: 'guest' | 'user'; id: string }
  lines: CartLineRecord[]
  version: number
}

export interface FavoriteRecord {
  userId: string
  nftId: string
}

export type WalletRecord = Wallet & { userId: string }

export type OrderRecord = Order & {
  userId: string
  idempotencyKey: string
  payloadHash: string
  resolveAt: string
  plannedOutcome: 'confirmed' | 'declined'
}

export interface IdempotencyRecord {
  key: string
  userId: string
  payloadHash: string
  orderId: string
}

export interface CouponRecord {
  code: string
  percent: number
  /** null = never expires. */
  expiresAt: string | null
}

export interface MockDb {
  version: 1
  scenario: ScenarioName
  users: UserRecord[]
  sessions: SessionRecord[]
  nfts: NftRecord[]
  carts: CartRecord[]
  favorites: FavoriteRecord[]
  wallets: WalletRecord[]
  orders: OrderRecord[]
  idempotency: IdempotencyRecord[]
  coupons: CouponRecord[]
  resourceVersions: Record<string, number>
  eventLog: string[]
}
