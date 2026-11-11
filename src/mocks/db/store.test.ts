import { beforeEach, describe, expect, it } from 'vitest'
import { nftDetailSchema, walletSchema } from '@/shared/contracts'
import { createRng } from './prng'
import { createSeed } from './seed'
import { bumpVersion, getDb, initDb, memoryStorage, mutate, resetDb, setStorage } from './store'

const STORAGE_KEY = 'kurio-mock-db:v1'

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
})
