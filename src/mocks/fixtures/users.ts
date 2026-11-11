import type { CartRecord, CouponRecord, FavoriteRecord, WalletRecord } from '../db/schema'

/** Fictional demo password; hashed at seed time and never stored in the database. */
export const SEED_PASSWORD = 'Kurio@2026'

export interface UserSeed {
  id: string
  username: string
  email: string
  displayName: string
  walletNickname: string
  ensName: string
  createdAt: string
}

export const USER_SEEDS: UserSeed[] = [
  {
    id: 'usr_ana',
    username: 'ana',
    email: 'ana@kurio.dev',
    displayName: 'Ana Souza',
    walletNickname: 'Principal',
    ensName: 'ana.kurio.eth',
    createdAt: '2026-03-12T10:00:00.000Z',
  },
  {
    id: 'usr_bruno',
    username: 'bruno',
    email: 'bruno@kurio.dev',
    displayName: 'Bruno Lima',
    walletNickname: '',
    ensName: '',
    createdAt: '2026-05-02T14:30:00.000Z',
  },
]

export const WALLET_SEEDS: WalletRecord[] = [
  {
    id: 'wlt_ana_primary',
    userId: 'usr_ana',
    slot: 'primary',
    displayName: 'Ana Souza',
    nickname: 'Principal',
    network: 'ethereum',
    profileName: 'ana',
    address: '0xA91F3c2d4E5f60718293a4b5C6d7E8f90123E82C',
    walletType: 'metamask',
    referralCode: 'KURIO-ANA',
    email: 'ana@kurio.dev',
    ensName: 'ana.kurio.eth',
    sameAsPrimary: false,
  },
  {
    id: 'wlt_ana_secondary',
    userId: 'usr_ana',
    slot: 'secondary',
    displayName: 'Ana Souza',
    nickname: 'Reserva',
    network: 'polygon',
    profileName: 'ana',
    address: '0x5B7e2C1d9A0f4E3b6C8d7A1e2F3b4C5d6E7f8A90',
    walletType: 'walletconnect',
    referralCode: 'KURIO-ANA',
    email: 'ana@kurio.dev',
    ensName: 'nova.kurio.eth',
    sameAsPrimary: false,
  },
]

export const FAVORITE_SEEDS: FavoriteRecord[] = [{ userId: 'usr_ana', nftId: 'nft_042' }]

/** ana starts with 1× Sage Nomad #009, edition 1/50 (Mobile Carrinho frame); bruno has no cart. */
export const CART_SEEDS: CartRecord[] = [
  {
    id: 'crt_usr_ana',
    owner: { type: 'user', id: 'usr_ana' },
    lines: [{ lineId: 'ln_ana_sage', nftId: 'nft_009', editionId: 'nft_009_e3', quantity: 1 }],
    version: 1,
  },
]

export const COUPON_SEEDS: CouponRecord[] = [
  { code: 'KURIO10', percent: 10, expiresAt: '2027-12-31T23:59:59.000Z' },
  { code: 'GENESIS5', percent: 5, expiresAt: '2027-12-31T23:59:59.000Z' },
  { code: 'LANCAMENTO24', percent: 15, expiresAt: '2025-01-31T23:59:59.000Z' },
]
