import { SCENARIOS, type ScenarioName } from '../scenarios'
import type { MockDb } from './schema'
import { createSeed } from './seed'

export const STORAGE_KEY = 'kurio-mock-db:v1'

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function memoryStorage(): StorageAdapter {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
}

let storage: StorageAdapter | null = null
let db: MockDb | null = null

function resolveStorage(): StorageAdapter {
  storage ??= 'localStorage' in globalThis ? globalThis.localStorage : memoryStorage()
  return storage
}

export function setStorage(adapter: StorageAdapter): void {
  storage = adapter
  db = null
}

function persist(): void {
  if (!db) return
  try {
    resolveStorage().setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // Quota or privacy-mode failures must not break the mock; state stays in memory.
  }
}

function load(): MockDb | null {
  try {
    const raw = resolveStorage().getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<MockDb>
    const arrays = ['users', 'sessions', 'nfts', 'carts', 'favorites', 'wallets', 'orders', 'idempotency', 'coupons', 'eventLog'] as const
    const valid =
      parsed.version === 1 &&
      arrays.every((key) => Array.isArray(parsed[key])) &&
      typeof parsed.resourceVersions === 'object' &&
      parsed.resourceVersions !== null
    return valid ? (parsed as MockDb) : null
  } catch {
    return null
  }
}

/** Loads the persisted database, or seeds a fresh one. Call before any getDb(). */
export async function initDb(): Promise<void> {
  db = load()
  if (!db) {
    db = await createSeed()
    persist()
  }
}

export function getDb(): MockDb {
  if (!db) throw new Error('Mock database not initialized: await initDb() first')
  return db
}

export function mutate<T>(fn: (db: MockDb) => T): T {
  const result = fn(getDb())
  persist()
  return result
}

export async function resetDb(scenario: ScenarioName = 'default'): Promise<void> {
  db = await createSeed()
  db.scenario = scenario
  SCENARIOS[scenario].seedPatch?.(db)
  persist()
}

/** Increments the version counter of a resource ("nft:nft_042") and mirrors it on the NFT record. */
export function bumpVersion(resourceKey: string): number {
  return mutate((state) => {
    const next = (state.resourceVersions[resourceKey] ?? 1) + 1
    state.resourceVersions[resourceKey] = next
    if (resourceKey.startsWith('nft:')) {
      const nft = state.nfts.find((n) => n.id === resourceKey.slice(4))
      if (nft) nft.version = next
    }
    return next
  })
}
