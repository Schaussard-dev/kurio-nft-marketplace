import { z } from 'zod'
import {
  ethStringSchema,
  orderSchema,
  type EventEnvelope,
  type EventType,
  type NftUpdatedData,
  type OrderUpdatedData,
} from '@/shared/contracts'
import { bumpVersion, getDb, mutate } from '../db/store'
import { emitToAll, emitToUser, rememberForReplay, replayEnvelope } from './server'

/**
 * Commit pipeline: every stateful mock change that has a realtime event goes through here,
 * so the DB (read by REST handlers) and the socket never diverge (spec §6).
 */

/** Bound for the persisted eventId log (full envelopes for replay live in server.ts, in memory). */
export const MAX_EVENT_LOG = 500

export const nftPatchSchema = z
  .object({
    price: ethStringSchema.optional(),
    editions: z.array(z.object({ id: z.string(), available: z.number().int().min(0) })).optional(),
  })
  .refine((patch) => patch.price !== undefined || (patch.editions?.length ?? 0) > 0, {
    message: 'Empty NFT patch: provide price and/or editions',
  })
export type NftPatch = z.infer<typeof nftPatchSchema>

export const orderPatchSchema = orderSchema.pick({ status: true, resolvedAt: true, declineReason: true }).partial()
export type OrderPatch = z.infer<typeof orderPatchSchema>

function buildEnvelope(
  type: EventType,
  resource: EventEnvelope['resource'],
  version: number,
  userId: string | null,
  data: unknown,
): EventEnvelope {
  return { eventId: crypto.randomUUID(), type, resource, version, occurredAt: new Date().toISOString(), userId, data }
}

function record(envelope: EventEnvelope): void {
  mutate((db) => {
    db.eventLog.push(envelope.eventId)
    if (db.eventLog.length > MAX_EVENT_LOG) db.eventLog.splice(0, db.eventLog.length - MAX_EVENT_LOG)
  })
  rememberForReplay(envelope)
}

/** Updates price and/or edition availability, bumps the NFT version and broadcasts `nft.updated`. */
export function commitNftUpdate(nftId: string, patch: NftPatch): EventEnvelope {
  const parsed = nftPatchSchema.parse(patch)
  const nft = getDb().nfts.find((n) => n.id === nftId)
  if (!nft) throw new Error(`Unknown NFT ${nftId}`)
  for (const edition of parsed.editions ?? []) {
    if (!nft.editions.some((e) => e.id === edition.id)) throw new Error(`Unknown edition ${edition.id} on ${nftId}`)
  }

  mutate(() => {
    if (parsed.price !== undefined && parsed.price !== nft.price) {
      nft.previousPrice = nft.price
      nft.price = parsed.price
    }
    for (const change of parsed.editions ?? []) {
      nft.editions.find((e) => e.id === change.id)!.available = change.available
    }
  })
  const version = bumpVersion(`nft:${nftId}`)

  const data: NftUpdatedData = {
    price: nft.price,
    previousPrice: nft.previousPrice,
    editions: nft.editions.map(({ id, available }) => ({ id, available })),
  }
  const envelope = buildEnvelope('nft.updated', { type: 'nft', id: nftId }, version, null, data)
  record(envelope)
  emitToAll(envelope)
  return envelope
}

/** Applies a status change to an order and emits `order.updated` to its owner only. */
export function commitOrderUpdate(orderId: string, patch: OrderPatch): EventEnvelope {
  const parsed = orderPatchSchema.parse(patch)
  const order = getDb().orders.find((o) => o.id === orderId)
  if (!order) throw new Error(`Unknown order ${orderId}`)

  const version = mutate((db) => {
    Object.assign(order, parsed)
    const key = `order:${orderId}`
    const next = Math.max(db.resourceVersions[key] ?? 0, order.version) + 1
    db.resourceVersions[key] = next
    order.version = next
    return next
  })

  // orderSchema strips the mock-only fields (userId, idempotencyKey, plannedOutcome…).
  const publicOrder = orderSchema.parse(order)
  const data: OrderUpdatedData = { status: publicOrder.status, order: publicOrder }
  const envelope = buildEnvelope('order.updated', { type: 'order', id: orderId }, version, order.userId, data)
  record(envelope)
  emitToUser(order.userId, envelope)
  return envelope
}

/** Tells the user's sessions that the wallet connection was lost (no DB state: connection is client-side). */
export function commitWalletDisconnect(userId: string): EventEnvelope {
  const version = bumpVersion(`wallet:${userId}`)
  const envelope = buildEnvelope('wallet.disconnected', { type: 'wallet', id: userId }, version, userId, {})
  record(envelope)
  emitToUser(userId, envelope)
  return envelope
}

/** Re-sends a past envelope unchanged (duplicate/out-of-order delivery tests). Returns false when unknown. */
export function replayEvent(eventId: string): boolean {
  return replayEnvelope(eventId)
}
