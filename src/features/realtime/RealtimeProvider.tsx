import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import { onSessionEnded } from '@/features/auth/session-events'
import { dismissPriceNotices, priceNoticeText, pushPriceNotice } from '@/features/cart/price-notices'
import { sessionStore } from '@/shared/api/session-storage'
import { eventTypeSchema } from '@/shared/contracts'
import { compare } from '@/shared/lib/money'
import { useAnnounce } from '@/shared/ui/LiveRegion'
import { applyNftUpdate, isCartQueryKey } from './apply-nft-update'
import { createRealtimeHub, RealtimeContext, useRealtimeEvent, type RealtimeHub } from './realtime-hub'

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/** After a reconnect the REST API is the source of truth: refetch whatever events may have missed. */
function reconcile(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['nfts'] })
  void queryClient.invalidateQueries({ queryKey: ['nft'] })
  void queryClient.invalidateQueries({ queryKey: ['quote'] })
  void queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      isCartQueryKey(queryKey) || (queryKey[0] === 'user' && (queryKey[2] === 'pending-orders' || queryKey[2] === 'order')),
  })
}

/**
 * Keeps one Socket.IO connection for the current session (guests connect with an empty token and get
 * the public `nft.updated` events). A session change tears the socket down (all listeners removed)
 * and connects again with the new token, so the server puts it in the right room.
 */
function connectRealtime(hub: RealtimeHub, queryClient: QueryClient): () => void {
  // socket.io-client is loaded after the app starts: it stays out of the entry chunk, and its
  // transport reads the global WebSocket only once that environment is fully set up.
  const socketModule = import('./socket')
  let socket: Socket | null = null
  /** Token of the current (or pending) connection; null = none. */
  let token: string | null = null
  let generation = 0
  let disposed = false
  const currentUserId = () => sessionStore.get()?.user.id ?? null
  const markDown = () => hub.setStatus(isOffline() ? 'offline' : 'reconnecting')

  function teardown() {
    generation += 1
    token = null
    if (!socket) return
    socket.removeAllListeners()
    socket.io.removeAllListeners()
    socket.disconnect()
    socket = null
  }

  function open(createSocket: (token: string) => Socket, next: string) {
    const created = createSocket(next)
    socket = created
    for (const type of eventTypeSchema.options) {
      created.on(type, (payload: unknown) => hub.dispatch(type, payload, currentUserId()))
    }
    created.on('connect', () => hub.setStatus('connected'))
    created.on('disconnect', markDown)
    created.on('connect_error', markDown)
    created.io.on('reconnect', () => reconcile(queryClient))
    created.connect()
  }

  function sync() {
    const next = sessionStore.get()?.token ?? ''
    if (token === next) return
    teardown()
    token = next
    hub.setStatus('reconnecting')
    const ticket = generation
    socketModule.then(
      ({ createSocket }) => {
        if (!disposed && ticket === generation) open(createSocket, next)
      },
      () => hub.setStatus('offline'),
    )
  }

  const onNetworkChange = () => {
    if (!socket?.connected) markDown()
  }

  sync()
  const unsubscribeStore = sessionStore.subscribe(sync)
  const unsubscribeEnded = onSessionEnded(() => {
    dismissPriceNotices()
    sync()
  })
  window.addEventListener('online', onNetworkChange)
  window.addEventListener('offline', onNetworkChange)
  return () => {
    unsubscribeStore()
    unsubscribeEnded()
    window.removeEventListener('online', onNetworkChange)
    window.removeEventListener('offline', onNetworkChange)
    disposed = true
    teardown()
  }
}

/** Patches cached NFT views on `nft.updated`; a price change of a cart NFT is announced and noticed. */
function NftUpdateSync() {
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  useRealtimeEvent('nft.updated', (envelope) => {
    const { cartChange } = applyNftUpdate(queryClient, envelope)
    if (!cartChange || compare(cartChange.from, cartChange.to) === 0) return
    const notice = { nftId: envelope.resource.id, name: cartChange.name, from: cartChange.from, to: cartChange.to }
    pushPriceNotice(notice)
    announce(priceNoticeText(notice))
  })
  return null
}

/**
 * Realtime sync (spec §7): socket lifecycle, guarded event dispatch (`useRealtimeEvent`), reconnect
 * reconciliation and the connection status (`useSocketStatus`). `order.updated` and
 * `wallet.disconnected` reach handlers registered with `useRealtimeEvent` by the checkout features.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [hub] = useState(createRealtimeHub)
  useEffect(() => connectRealtime(hub, queryClient), [hub, queryClient])
  return (
    <RealtimeContext.Provider value={hub}>
      <NftUpdateSync />
      {children}
    </RealtimeContext.Provider>
  )
}
