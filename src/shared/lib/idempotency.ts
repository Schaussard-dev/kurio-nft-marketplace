/**
 * Idempotency attempt of a purchase (spec §5). An attempt is stored (sessionStorage, per user) with its
 * EXACT payload before the request goes out, and stays until the server gives a definitive answer.
 * While it exists, every send (timeout retry, "Verificar pedido", a new "Enviar pedido" after closing
 * the dialog or a reload) replays that payload with the same key, so an order whose outcome is unknown
 * can never be bought a second time under a new key.
 */
export interface OrderAttempt<T = unknown> {
  key: string
  payloadHash: string
  /** The body sent with this key (no secrets: order payload only). */
  payload: T
}

const attemptKey = (userId: string) => `kurio-order-attempt:${userId}`

/** The unresolved attempt of this user, if any. */
export function peekAttempt(userId: string): OrderAttempt | null {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(attemptKey(userId)) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return null
    const key: unknown = Reflect.get(parsed, 'key')
    const payloadHash: unknown = Reflect.get(parsed, 'payloadHash')
    if (typeof key !== 'string' || typeof payloadHash !== 'string' || !Reflect.has(parsed, 'payload')) return null
    return { key, payloadHash, payload: Reflect.get(parsed, 'payload') }
  } catch {
    return null
  }
}

/**
 * The unresolved attempt when one exists (whatever payload is asked now), otherwise a new attempt with
 * a fresh UUID key for this payload, stored before it is sent.
 */
export function getAttempt<T>(userId: string, payloadHash: string, payload: T): OrderAttempt<T> & { reused: boolean } {
  const stored = peekAttempt(userId)
  if (stored) return { ...(stored as OrderAttempt<T>), reused: true }
  const attempt: OrderAttempt<T> = { key: crypto.randomUUID(), payloadHash, payload }
  try {
    sessionStorage.setItem(attemptKey(userId), JSON.stringify(attempt))
  } catch {
    // Storage unavailable: the key still covers the retries of this page.
  }
  return { ...attempt, reused: false }
}

/** Forgets the attempt after a definitive answer (order created, or a definitive refusal). */
export function clearAttempt(userId: string): void {
  try {
    sessionStorage.removeItem(attemptKey(userId))
  } catch {
    // nothing to clear
  }
}
