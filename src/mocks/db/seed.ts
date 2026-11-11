import { buildNfts } from '../fixtures/nfts'
import {
  CART_SEEDS,
  COUPON_SEEDS,
  FAVORITE_SEEDS,
  SEED_PASSWORD,
  USER_SEEDS,
  WALLET_SEEDS,
} from '../fixtures/users'
import { hashPassword } from './password'
import type { MockDb, UserRecord } from './schema'

/** Builds a fresh, deterministic database. Passwords are hashed here and never stored plain. */
export async function createSeed(): Promise<MockDb> {
  const nfts = buildNfts()
  const users: UserRecord[] = await Promise.all(
    USER_SEEDS.map(async (user) => ({
      ...user,
      avatarUrl: null,
      // Deterministic salt keeps the seed reproducible (demo-only credentials).
      passwordRecord: await hashPassword(SEED_PASSWORD, `kurio-seed-${user.id}`),
    })),
  )

  return {
    version: 1,
    scenario: 'default',
    users,
    sessions: [],
    nfts,
    carts: CART_SEEDS.map((c) => ({ ...c, owner: { ...c.owner }, lines: c.lines.map((l) => ({ ...l })) })),
    favorites: FAVORITE_SEEDS.map((f) => ({ ...f })),
    wallets: WALLET_SEEDS.map((w) => ({ ...w })),
    orders: [],
    idempotency: [],
    coupons: COUPON_SEEDS.map((c) => ({ ...c })),
    quotes: [],
    resourceVersions: Object.fromEntries(nfts.map((n) => [`nft:${n.id}`, 1])),
    eventLog: [],
  }
}
