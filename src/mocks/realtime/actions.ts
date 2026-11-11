import { HttpResponse } from 'msw'
import { getDb } from '../db/store'
import { registerMockAction } from '../handlers/mock-control'
import { apiError } from '../network'
import { commitNftUpdate, commitWalletDisconnect, nftPatchSchema, replayEvent } from './commit'
import { resolveOrder } from './order-scheduler'
import { connectedUserIds, dropAll, emitWhoAmI, restore } from './server'

/** Wires the realtime `/__mock/emit` actions to the commit pipeline and the mock socket server. */
export function registerRealtimeMockActions(): void {
  registerMockAction('nft:update', ({ nftId, price, editions }) => {
    const nft = getDb().nfts.find((n) => n.id === nftId)
    if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado')
    const editionPatch =
      typeof editions === 'number' ? nft.editions.map(({ id }) => ({ id, available: editions })) : editions
    const patch = nftPatchSchema.safeParse({ price, editions: editionPatch })
    const unknownEdition = editionPatch?.some((change) => !nft.editions.some((e) => e.id === change.id))
    if (!patch.success || unknownEdition) return apiError(422, 'VALIDATION_ERROR', 'Alteração de NFT inválida')
    // The eventId lets tests (and the demo panel) replay exactly this event later.
    const { eventId, version } = commitNftUpdate(nftId, patch.data)
    return HttpResponse.json({ ok: true, eventId, version })
  })

  registerMockAction('event:replay', ({ eventId }) => {
    if (!replayEvent(eventId)) return apiError(404, 'NOT_FOUND', 'Evento não encontrado')
  })

  // Simulated loss of the wallet connection (checkout goes back to the connect step).
  registerMockAction('wallet:disconnect', ({ userId }) => {
    const users = userId ? [userId] : connectedUserIds()
    users.forEach((id) => commitWalletDisconnect(id))
    return HttpResponse.json({ ok: true, users: users.length })
  })

  // Resolves a pending order now, to its planned outcome (demo panel / tests); terminal orders are left alone.
  registerMockAction('order:resolve', ({ orderId }) => {
    const order = getDb().orders.find((o) => o.id === orderId)
    if (!order) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado')
    resolveOrder(orderId)
    return HttpResponse.json({ ok: true, status: order.status })
  })

  registerMockAction('socket:drop', ({ seconds }) => dropAll(seconds))
  registerMockAction('socket:restore', () => restore())
  registerMockAction('whoami', () => emitWhoAmI())
}
