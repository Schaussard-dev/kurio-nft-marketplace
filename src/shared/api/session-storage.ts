import { sessionSchema, type Session } from '@/shared/contracts'

const SESSION_KEY = 'kurio-session'
const GUEST_CART_KEY = 'kurio-guest-cart-id'

// In-memory fallbacks keep the app working when localStorage is unavailable.
const memory = new Map<string, string>()

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return memory.get(key) ?? null
  }
}

function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    memory.set(key, value)
  }
}

function removeRaw(key: string): void {
  memory.delete(key)
  try {
    localStorage.removeItem(key)
  } catch {
    // nothing else to clear
  }
}

type Listener = (session: Session | null) => void
const listeners = new Set<Listener>()

function notify(session: Session | null): void {
  listeners.forEach((fn) => fn(session))
}

export const sessionStore = {
  get(): Session | null {
    const raw = readRaw(SESSION_KEY)
    if (raw === null) return null
    try {
      const parsed = sessionSchema.safeParse(JSON.parse(raw))
      if (parsed.success) return parsed.data
    } catch {
      // fall through to clear
    }
    removeRaw(SESSION_KEY)
    return null
  },
  set(session: Session): void {
    writeRaw(SESSION_KEY, JSON.stringify(session))
    notify(session)
  },
  clear(): void {
    removeRaw(SESSION_KEY)
    notify(null)
  },
  subscribe(fn: Listener): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}

export function getGuestCartId(): string {
  const existing = readRaw(GUEST_CART_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  writeRaw(GUEST_CART_KEY, id)
  return id
}

export function resetGuestCartId(): void {
  removeRaw(GUEST_CART_KEY)
}
