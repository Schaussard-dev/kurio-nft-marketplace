import { useSyncExternalStore } from 'react'
import { useRealtimeHub, type SocketStatus } from './realtime-hub'

export type { SocketStatus }

/** Live connection state of the realtime socket: 'connected' | 'reconnecting' | 'offline'. */
export function useSocketStatus(): SocketStatus {
  const hub = useRealtimeHub()
  return useSyncExternalStore(hub.subscribeStatus, hub.getStatus, hub.getStatus)
}
