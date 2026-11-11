/**
 * Idempotency attempt of a purchase (spec §5): one `Idempotency-Key` per payload, kept in sessionStorage
 * so a timeout retry, "Verificar pedido" or a reload resend the same key and never create a second order.
 */
export interface OrderAttempt {
  key: string
  payloadHash: string
}

const attemptKey = (userId: string) => `kurio-order-attempt:${userId}`

function read(userId: string): OrderAttempt | null {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(attemptKey(userId)) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return null
    const key: unknown = Reflect.get(parsed, 'key')
    const payloadHash: unknown = Reflect.get(parsed, 'payloadHash')
    return typeof key === 'string' && typeof payloadHash === 'string' ? { key, payloadHash } : null
  } catch {
    return null
  }
}

/** The stored attempt when the payload is unchanged; otherwise a new attempt with a fresh UUID key. */
export function getAttempt(userId: string, payloadHash: string): OrderAttempt {
  const stored = read(userId)
  if (stored?.payloadHash === payloadHash) return stored
  const attempt: OrderAttempt = { key: crypto.randomUUID(), payloadHash }
  try {
    sessionStorage.setItem(attemptKey(userId), JSON.stringify(attempt))
  } catch {
    // Storage unavailable: the key still covers the retries of this page.
  }
  return attempt
}

/** Forgets the attempt once the order exists (the next purchase gets a new key). */
export function clearAttempt(userId: string): void {
  try {
    sessionStorage.removeItem(attemptKey(userId))
  } catch {
    // nothing to clear
  }
}
