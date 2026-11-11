import { getDb, mutate } from '../db/store'
import type { OrderRecord } from '../db/schema'
import { commitNftUpdate, commitOrderUpdate } from './commit'

/**
 * Mock "network confirmation" of orders (spec §5): a pending order resolves to its planned outcome
 * once its persisted `resolveAt` arrives. Resolution is lazy (every GET /orders/:id, and at boot) and
 * scheduled (a timer per pending order), and idempotent: only `pending` orders are ever resolved, so
 * stock and cart change once. All state lives in the mock; the app only sees REST and `order.updated`.
 */

export const DECLINE_REASON = 'A carteira recusou o pagamento. Nenhum valor foi cobrado.'

/** A timer that fires while the order is not due yet (page clock frozen in tests) checks again this late. */
const RECHECK_MS = 1000

const timers = new Map<string, ReturnType<typeof setTimeout>>()

/** Confirmed: the bought editions lose stock (nft.updated) and the owner's cart loses the bought quantities. */
function settleConfirmed(order: OrderRecord): void {
  const db = getDb()
  const byNft = new Map<string, Map<string, number>>()
  for (const line of order.snapshot.lines) {
    const editions = byNft.get(line.nftId) ?? new Map<string, number>()
    editions.set(line.editionId, (editions.get(line.editionId) ?? 0) + line.quantity)
    byNft.set(line.nftId, editions)
  }
  for (const [nftId, bought] of byNft) {
    const nft = db.nfts.find((n) => n.id === nftId)
    if (!nft) continue
    const editions = [...bought]
      .map(([id, quantity]) => {
        const edition = nft.editions.find((e) => e.id === id)
        return edition && { id, available: Math.max(0, edition.available - quantity) }
      })
      .filter((change) => change !== undefined)
    if (editions.length > 0) commitNftUpdate(nftId, { editions })
  }

  mutate((state) => {
    const cart = state.carts.find((c) => c.owner.type === 'user' && c.owner.id === order.userId)
    if (!cart) return
    let changed = false
    for (const line of order.snapshot.lines) {
      const cartLine = cart.lines.find((l) => l.nftId === line.nftId && l.editionId === line.editionId)
      if (!cartLine) continue
      cartLine.quantity -= line.quantity
      changed = true
    }
    if (!changed) return
    cart.lines = cart.lines.filter((l) => l.quantity > 0)
    cart.version += 1
  })
}

/** Resolves one pending order now (whatever its resolveAt). Returns the new status, or null if not pending. */
export function resolveOrder(orderId: string, now = Date.now()): OrderRecord['status'] | null {
  const order = getDb().orders.find((o) => o.id === orderId)
  if (!order || order.status !== 'pending') return null
  clearTimeout(timers.get(orderId))
  timers.delete(orderId)
  const confirmed = order.plannedOutcome === 'confirmed'
  // Stock and cart first: by the time the owner hears `order.updated`, REST already reflects them.
  if (confirmed) settleConfirmed(order)
  commitOrderUpdate(orderId, {
    status: order.plannedOutcome,
    resolvedAt: new Date(now).toISOString(),
    declineReason: confirmed ? null : DECLINE_REASON,
  })
  return order.plannedOutcome
}

/** Resolves every pending order whose resolveAt is due; returns their ids. */
export function resolveDueOrders(now = Date.now()): string[] {
  const due = getDb()
    .orders.filter((o) => o.status === 'pending' && Date.parse(o.resolveAt) <= now)
    .map((o) => o.id)
  return due.filter((id) => resolveOrder(id, now) !== null)
}

/** Arms a timer for the order's resolveAt (replacing an earlier one). */
export function scheduleOrder(order: Pick<OrderRecord, 'id' | 'resolveAt'>): void {
  clearTimeout(timers.get(order.id))
  const delay = Math.max(0, Date.parse(order.resolveAt) - Date.now())
  timers.set(
    order.id,
    setTimeout(() => {
      timers.delete(order.id)
      resolveDueOrders()
      // Still pending (e.g. not due yet on this clock): look again later; gone or terminal: done.
      const current = getDb().orders.find((o) => o.id === order.id && o.status === 'pending')
      if (current) {
        clearTimeout(timers.get(order.id))
        timers.set(order.id, setTimeout(() => scheduleOrder(current), RECHECK_MS))
      }
    }, delay),
  )
}

/** At mock start: resolves what came due while the page was closed and re-arms the pending rest. */
export function bootScheduler(): void {
  resolveDueOrders()
  getDb()
    .orders.filter((o) => o.status === 'pending')
    .forEach(scheduleOrder)
}

/** Tests: drops every timer. */
export function resetOrderScheduler(): void {
  timers.forEach((timer) => clearTimeout(timer))
  timers.clear()
}
