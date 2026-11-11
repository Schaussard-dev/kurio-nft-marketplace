/**
 * Id of the order waiting for its outcome (spec §7), per user in localStorage, so a reload, a
 * reconnection or a later visit finds it again with GET /orders/:id instead of buying twice.
 * Subscribers (the global pending-order banner) hear every change made in this tab.
 */
const pendingKey = (userId: string) => `kurio-pending-order:${userId}`

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export function rememberPendingOrder(userId: string, orderId: string): void {
  try {
    localStorage.setItem(pendingKey(userId), orderId)
  } catch {
    // Storage unavailable: the order page still has the id in its URL.
  }
  notify()
}

export function getPendingOrder(userId: string): string | null {
  try {
    return localStorage.getItem(pendingKey(userId))
  } catch {
    return null
  }
}

/** Forgets the user's pending order; with `orderId`, only if it is that one (another may have replaced it). */
export function forgetPendingOrder(userId: string, orderId?: string): void {
  if (orderId !== undefined && getPendingOrder(userId) !== orderId) return
  try {
    localStorage.removeItem(pendingKey(userId))
  } catch {
    // nothing to clear
  }
  notify()
}

export function subscribePendingOrder(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
