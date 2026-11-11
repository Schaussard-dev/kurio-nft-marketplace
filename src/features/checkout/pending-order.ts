/**
 * Id of the order waiting for its outcome (spec §7), per user in localStorage, so a reload or a
 * reconnect finds it again with GET /orders/:id instead of buying twice.
 */
const pendingKey = (userId: string) => `kurio-pending-order:${userId}`

export function savePendingOrderId(userId: string, orderId: string): void {
  try {
    localStorage.setItem(pendingKey(userId), orderId)
  } catch {
    // Storage unavailable: the order page still has the id in its URL.
  }
}

export function loadPendingOrderId(userId: string): string | null {
  try {
    return localStorage.getItem(pendingKey(userId))
  } catch {
    return null
  }
}

export function clearPendingOrderId(userId: string): void {
  try {
    localStorage.removeItem(pendingKey(userId))
  } catch {
    // nothing to clear
  }
}
