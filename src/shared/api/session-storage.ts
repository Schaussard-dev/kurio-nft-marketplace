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

// crypto.randomUUID only exists in secure contexts (https/localhost).
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes)
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function getGuestCartId(): string {
  const existing = readRaw(GUEST_CART_KEY)
  if (existing) return existing
  const id = generateId()
  writeRaw(GUEST_CART_KEY, id)
  return id
}

export function resetGuestCartId(): void {
  removeRaw(GUEST_CART_KEY)
}
