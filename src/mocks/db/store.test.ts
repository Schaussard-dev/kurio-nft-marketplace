import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nftDetailSchema, walletSchema } from '@/shared/contracts'
import { createRng } from './prng'
import type { OrderRecord } from './schema'
import { createSeed } from './seed'
import { STORAGE_KEY, bumpVersion, getDb, initDb, memoryStorage, mutate, resetDb, setStorage } from './store'


describe('createRng', () => {
  it('is deterministic and within [0, 1)', () => {
    const a = createRng(2026)
    const b = createRng(2026)
    const seq = Array.from({ length: 20 }, () => a())
    expect(seq).toEqual(Array.from({ length: 20 }, () => b()))
    expect(seq.every((n) => n >= 0 && n < 1)).toBe(true)
  })
})

describe('seed', () => {
  it('has 60 NFTs that all satisfy nftDetailSchema', async () => {
    const db = await createSeed()
    expect(db.nfts).toHaveLength(60)
    for (const nft of db.nfts) expect(nftDetailSchema.safeParse(nft).success).toBe(true)
    expect(new Set(db.nfts.map((n) => n.id)).size).toBe(60)
  })

  it('is deterministic', async () => {
    const [a, b] = [await createSeed(), await createSeed()]
    expect(a.nfts).toEqual(b.nfts)
  })

  it('has at least 2 users and never stores a plain password', async () => {
    const db = await createSeed()
    expect(db.users.length).toBeGreaterThanOrEqual(2)
    expect(JSON.stringify(db.users)).not.toContain('Kurio@2026')
  })

  it('exposes the Figma facts later tasks rely on', async () => {
    const db = await createSeed()
    const ape = db.nfts.find((n) => n.id === 'nft_042')!
    expect(ape.name).toBe('Emerald Ape #042')
    expect(ape.price).toBe('1.19')
    expect(ape.reviewCount).toBe(19)
    expect(ape.editions.find((e) => e.label === '1/1')!.available).toBe(0)
    for (const nft of db.nfts.slice(0, 9)) {
      for (const label of ['1/50', 'ABERTA']) {
        expect(nft.editions.find((e) => e.label === label)!.available).toBeGreaterThanOrEqual(3)
      }
    }
    const ana = db.users.find((u) => u.id === 'usr_ana')!
    const wallets = db.wallets.filter((w) => w.userId === ana.id)
    expect(wallets.map((w) => w.slot).sort()).toEqual(['primary', 'secondary'])
    for (const w of wallets) expect(walletSchema.safeParse(w).success).toBe(true)
    expect(db.favorites).toEqual([{ userId: 'usr_ana', nftId: 'nft_042' }])
    expect(db.wallets.some((w) => w.userId === 'usr_bruno')).toBe(false)
  })

  it('seeds ana with 1× Sage Nomad (a valid edition) and bruno with no cart', async () => {
    const db = await createSeed()
    const anaCart = db.carts.find((c) => c.owner.type === 'user' && c.owner.id === 'usr_ana')!
    expect(anaCart.lines).toHaveLength(1)
    const [line] = anaCart.lines
    const nft = db.nfts.find((n) => n.id === line!.nftId)!
    expect(nft.name).toBe('Sage Nomad #009')
    expect(line!.quantity).toBe(1)
    expect(nft.editions.find((e) => e.id === line!.editionId)!.available).toBeGreaterThanOrEqual(1)
    expect(db.carts.some((c) => c.owner.id === 'usr_bruno')).toBe(false)
    expect(db.quotes).toEqual([])
  })
})

describe('store', () => {
  beforeEach(async () => {
    setStorage(memoryStorage())
    await initDb()
  })

  it('persists mutations across initDb with the same storage', async () => {
    const storage = memoryStorage()
    setStorage(storage)
    await initDb()
    mutate((db) => {
      db.eventLog.push('hello')
    })
    expect(storage.getItem(STORAGE_KEY)).toContain('hello')
    await initDb()
    expect(getDb().eventLog).toContain('hello')
  })

  it('resetDb restores the seed', async () => {
    mutate((db) => {
      db.nfts[0]!.price = '9.99'
      db.eventLog.push('x')
    })
    await resetDb()
    expect(getDb().nfts[0]!.price).toBe('1.19')
    expect(getDb().eventLog).toEqual([])
  })

  it('bumpVersion increments per resource key', () => {
    expect(bumpVersion('nft:nft_042')).toBe(2)
    expect(bumpVersion('nft:nft_042')).toBe(3)
    expect(getDb().nfts.find((n) => n.id === 'nft_042')!.version).toBe(3)
  })

  it('resetDb never moves resource versions backwards', async () => {
    bumpVersion('nft:nft_042')
    bumpVersion('nft:nft_042')
    bumpVersion('wallet:usr_ana')
    await resetDb()
    expect(getDb().resourceVersions['nft:nft_042']).toBe(3)
    expect(getDb().nfts.find((n) => n.id === 'nft_042')!.version).toBe(3)
    expect(getDb().resourceVersions['wallet:usr_ana']).toBe(2)
    expect(getDb().resourceVersions[`nft:${getDb().nfts.at(-1)!.id}`]).toBe(1)
    // The next event is newer than anything a client saw before the reset.
    expect(bumpVersion('nft:nft_042')).toBe(4)
  })
})

describe('store shared between tabs', () => {
  // Two module instances over one storage stand in for two tabs over one localStorage.
  async function twoTabs() {
    const shared = memoryStorage()
    vi.resetModules()
    const tabA = await import('./store')
    vi.resetModules()
    const tabB = await import('./store')
    tabA.setStorage(shared)
    tabB.setStorage(shared)
    await tabA.initDb()
    await tabB.initDb()
    return { shared, tabA, tabB }
  }

  it('a mutation never overwrites what another tab wrote', async () => {
    const { shared, tabA, tabB } = await twoTabs()
    tabA.mutate((db) => void db.eventLog.push('from-a'))
    tabB.mutate((db) => void db.eventLog.push('from-b'))
    tabA.mutate((db) => void db.eventLog.push('from-a-again'))

    const stored = JSON.parse(shared.getItem(STORAGE_KEY)!) as { eventLog: string[] }
    expect(stored.eventLog).toEqual(['from-a', 'from-b', 'from-a-again'])
    // Reads are fresh too: tab B sees tab A's latest write without mutating.
    expect(tabB.getDb().eventLog).toEqual(['from-a', 'from-b', 'from-a-again'])
  })

  it('a session created in one tab is known to the other tab', async () => {
    const { tabA, tabB } = await twoTabs()
    tabA.mutate((db) => {
      db.sessions.push({ token: 'tok-from-a', userId: 'usr_ana', expiresAt: '2030-01-01T00:00:00.000Z' })
    })
    expect(tabB.getDb().sessions.some((s) => s.token === 'tok-from-a')).toBe(true)
  })
})

describe('seed variety', () => {
  const countBy = <T>(items: T[], key: (item: T) => string) => {
    const map = new Map<string, number>()
    for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1)
    return map
  }

  it('spreads categories and networks deterministically', async () => {
    const { nfts } = await createSeed()
    const perCategory = countBy(nfts, (n) => n.category)
    expect(perCategory.size).toBe(9)
    for (const count of perCategory.values()) expect(count).toBeGreaterThanOrEqual(5)
    expect([...perCategory.values()].filter((c) => c >= 10).length).toBeGreaterThanOrEqual(3)
    const perPair = countBy(nfts, (n) => `${n.category}|${n.network}`)
    for (const [category, count] of perPair) {
      const total = perCategory.get(category.split('|')[0]!)!
      expect(count).toBeGreaterThanOrEqual(total >= 10 ? 2 : 1)
    }
    for (const [category, total] of perCategory) {
      for (const network of ['ethereum', 'polygon', 'solana']) {
        expect(perPair.get(`${category}|${network}`) ?? 0, `${category} ${network} of ${total}`).toBeGreaterThanOrEqual(1)
      }
    }
    expect(perPair.get('musica|polygon')).toBeGreaterThanOrEqual(2)
  })

  it('spreads prices over the slider range', async () => {
    const { nfts } = await createSeed()
    const prices = nfts.map((n) => Number(n.price))
    expect(Math.min(...prices)).toBe(0.02)
    expect(Math.max(...prices)).toBe(12.3)
    expect(prices.filter((p) => p > 3).length).toBeGreaterThanOrEqual(8)
  })

  it('keeps recent NFTs for the "new" tab and the coupons deterministic', async () => {
    const db = await createSeed()
    const limit = Date.parse('2026-11-01T12:00:00.000Z') - 30 * 86_400_000
    expect(db.nfts.filter((n) => Date.parse(n.createdAt) > limit).length).toBeGreaterThanOrEqual(8)
    const coupon = (code: string) => db.coupons.find((c) => c.code === code)!
    expect(coupon('KURIO10').percent).toBe(10)
    expect(coupon('GENESIS5').percent).toBe(5)
    expect(Date.parse(coupon('LANCAMENTO24').expiresAt!)).toBeLessThan(Date.parse('2026-11-01T12:00:00.000Z'))
  })
})

describe('store isolation', () => {
  beforeEach(async () => {
    setStorage(memoryStorage())
    await initDb()
  })

  it('resetDb restores nested data mutated in place', async () => {
    mutate((db) => {
      const nft = db.nfts.find((n) => n.id === 'nft_042')!
      nft.editions[2]!.available = 0
      nft.reviews.pop()
      db.wallets[0]!.nickname = 'Mudada'
      db.orders.push({ id: 'ord_x' } as unknown as OrderRecord)
    })
    await resetDb()
    const fresh = await createSeed()
    expect(getDb()).toEqual(fresh)
    expect(getDb().orders).toEqual([])
  })

  it('createSeed shares no references between calls or with the live db', async () => {
    const before = await createSeed()
    mutate((db) => {
      db.nfts[0]!.editions[0]!.available = 77
      db.wallets[0]!.nickname = 'Mudada'
      db.coupons[0]!.percent = 99
      db.favorites.push({ userId: 'usr_bruno', nftId: 'nft_009' })
    })
    expect(await createSeed()).toEqual(before)
  })

  it('a persisted reload still parses every NFT', async () => {
    const storage = memoryStorage()
    setStorage(storage)
    await initDb()
    mutate((db) => {
      db.eventLog.push('persisted')
    })
    await initDb()
    expect(getDb().nfts).toHaveLength(60)
    for (const nft of getDb().nfts) expect(nftDetailSchema.safeParse(nft).success).toBe(true)
  })

  it('falls back to the seed when the persisted blob is structurally invalid', async () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, users: [] }))
    setStorage(storage)
    await initDb()
    expect(getDb().nfts).toHaveLength(60)
  })

  it('reseeds a persisted blob from before carts were seeded (no quotes table)', async () => {
    const storage = memoryStorage()
    const legacy: Record<string, unknown> = { ...(await createSeed()), carts: [] }
    delete legacy.quotes
    storage.setItem(STORAGE_KEY, JSON.stringify(legacy))
    setStorage(storage)
    await initDb()
    expect(getDb().quotes).toEqual([])
    expect(getDb().carts.some((c) => c.owner.id === 'usr_ana')).toBe(true)
  })
})
