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
/** The serialized DB this tab last read or wrote: any other stored value was written by another tab. */
let lastRaw: string | null = null

function resolveStorage(): StorageAdapter {
  storage ??= 'localStorage' in globalThis ? globalThis.localStorage : memoryStorage()
  return storage
}

export function setStorage(adapter: StorageAdapter): void {
  storage = adapter
  db = null
  lastRaw = null
}

function persist(): void {
  if (!db) return
  try {
    const raw = JSON.stringify(db)
    resolveStorage().setItem(STORAGE_KEY, raw)
    lastRaw = raw
  } catch {
    // Quota or privacy-mode failures must not break the mock; state stays in memory.
  }
}

function readRaw(): string | null {
  try {
    return resolveStorage().getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function parse(raw: string | null): MockDb | null {
  try {
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<MockDb>
    const arrays = ['users', 'sessions', 'nfts', 'carts', 'favorites', 'wallets', 'orders', 'idempotency', 'coupons', 'quotes', 'eventLog'] as const
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

/**
 * Adopts the stored DB when another tab (same origin, same localStorage) wrote a newer one, so this
 * tab never serves or overwrites stale state. An unreadable or invalid stored value is ignored.
 * Another tab's write only lands between tasks, so references taken from getDb() stay valid for the
 * rest of the synchronous handler code that mutates them.
 */
function syncFromStorage(): void {
  const raw = readRaw()
  if (raw === null || raw === lastRaw) return
  const next = parse(raw)
  if (!next) return
  db = next
  lastRaw = raw
}

/** Loads the persisted database, or seeds a fresh one. Call before any getDb(). */
export async function initDb(): Promise<void> {
  const raw = readRaw()
  db = parse(raw)
  if (db) {
    lastRaw = raw
  } else {
    db = await createSeed()
    persist()
  }
}

/** The current DB, refreshed first if another tab wrote since this tab last read or wrote it. */
export function getDb(): MockDb {
  if (!db) throw new Error('Mock database not initialized: await initDb() first')
  syncFromStorage()
  return db
}

export function mutate<T>(fn: (db: MockDb) => T): T {
  // Read-modify-write on the latest stored state: another tab's write is never overwritten.
  const result = fn(getDb())
  persist()
  return result
}

/**
 * Reseeds the database. Resource versions never go backwards (clients drop events whose version is
 * not newer than the one they hold), so each keeps the max of its previous and seeded value.
 */
export async function resetDb(scenario: ScenarioName = 'default'): Promise<void> {
  if (db) syncFromStorage()
  const previous = db?.resourceVersions ?? {}
  const next = await createSeed()
  next.scenario = scenario
  SCENARIOS[scenario].seedPatch?.(next)
  for (const [key, version] of Object.entries(previous)) {
    next.resourceVersions[key] = Math.max(version, next.resourceVersions[key] ?? 0)
  }
  for (const nft of next.nfts) nft.version = next.resourceVersions[`nft:${nft.id}`] ?? nft.version
  db = next
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
