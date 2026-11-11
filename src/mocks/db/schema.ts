import type { NftDetail, Order, Quote, Wallet } from '@/shared/contracts'
import type { PasswordRecord } from './password'

import type { ScenarioName } from '../scenarios'

export type { ScenarioName }

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
  /** Authenticated requests served with this token (drives the `sessionTtlRequests` scenario flag). */
  requestCount?: number
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

/** A quote handed out by POST /quote; orders (later task) look it up by quoteId and compare fingerprints. */
export interface QuoteRecord {
  cartId: string
  quote: Quote
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
  quotes: QuoteRecord[]
  resourceVersions: Record<string, number>
  eventLog: string[]
}
