import { createContext, useContext, useEffect, useRef } from 'react'
import { eventEnvelopeSchema, type EventEnvelope, type EventType } from '@/shared/contracts'
import { createEventGuard, type EventGuard } from './event-guard'

export type SocketStatus = 'connected' | 'reconnecting' | 'offline'
export type RealtimeHandler = (envelope: EventEnvelope) => void

/**
 * In-app side of the socket: event handlers by type (behind the dedupe/version/user guard) and the
 * connection status. The RealtimeProvider feeds it from socket.io-client; features subscribe.
 */
export interface RealtimeHub {
  subscribe(type: EventType, handler: RealtimeHandler): () => void
  /** Validates a raw socket payload, runs the guard, then calls the handlers of `type`. */
  dispatch(type: EventType, payload: unknown, currentUserId: string | null): void
  getStatus(): SocketStatus
  setStatus(status: SocketStatus): void
  subscribeStatus(listener: () => void): () => void
}

export function createRealtimeHub(guard: EventGuard = createEventGuard()): RealtimeHub {
  const handlers = new Map<EventType, Set<RealtimeHandler>>()
  const statusListeners = new Set<() => void>()
  // Until the first CONNECT the app is not receiving events yet.
  let status: SocketStatus = 'reconnecting'

  return {
    subscribe(type, handler) {
      const set = handlers.get(type) ?? new Set()
      handlers.set(type, set)
      set.add(handler)
      return () => {
        set.delete(handler)
      }
    },
    dispatch(type, payload, currentUserId) {
      const parsed = eventEnvelopeSchema.safeParse(payload)
      if (!parsed.success || parsed.data.type !== type) return
      if (!guard.shouldApply(parsed.data, currentUserId)) return
      handlers.get(type)?.forEach((handler) => {
        // One failing feature handler must not keep the others from seeing the event.
        try {
          handler(parsed.data)
        } catch (error) {
          console.error(`[realtime] ${type} handler failed`, error)
        }
      })
    },
    getStatus: () => status,
    setStatus(next) {
      if (next === status) return
      status = next
      statusListeners.forEach((listener) => listener())
    },
    subscribeStatus(listener) {
      statusListeners.add(listener)
      return () => {
        statusListeners.delete(listener)
      }
    },
  }
}

export const RealtimeContext = createContext<RealtimeHub | null>(null)

export function useRealtimeHub(): RealtimeHub {
  const hub = useContext(RealtimeContext)
  if (!hub) throw new Error('useRealtimeHub must be used inside RealtimeProvider')
  return hub
}

/**
 * Runs `handler` for every applicable socket event of `type` (already deduped, versioned and scoped
 * to the current user). The latest handler is always used; the subscription lives while mounted.
 */
export function useRealtimeEvent(type: EventType, handler: RealtimeHandler): void {
  const hub = useRealtimeHub()
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => hub.subscribe(type, (envelope) => latest.current(envelope)), [hub, type])
}
