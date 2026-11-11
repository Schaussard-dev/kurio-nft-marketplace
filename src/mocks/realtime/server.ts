import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { EventEnvelope } from '@/shared/contracts'
import { getDb } from '../db/store'

/**
 * Mock Socket.IO server (one per browser tab: interception runs on the main thread).
 * The binding has no rooms, so connections are tracked here: every connection is in the
 * public broadcast set, authenticated ones also in their user's room.
 */

export type SocketIoDuplex = ReturnType<typeof toSocketIo>

/** The binding hardcodes the Engine.IO handshake to pingInterval 25s / pingTimeout 5s but never pings. */
export const PING_INTERVAL_MS = 25_000
/** Engine.IO v4 "ping" packet (the client answers "3", which the binding ignores). */
const ENGINE_IO_PING = '2'

interface ConnectionEntry {
  io: SocketIoDuplex
  userId: string | null
  pingTimer: ReturnType<typeof setInterval>
}

const connections = new Set<ConnectionEntry>()
const rooms = new Map<string, Set<ConnectionEntry>>()
let dropped = false
let restoreTimer: ReturnType<typeof setTimeout> | null = null

/** Same rule as the client's `createSocket`: empty VITE_SOCKET_URL means the app origin. */
function resolveSocketUrl(): string {
  return import.meta.env.VITE_SOCKET_URL || globalThis.location.origin
}

/**
 * Reads `auth.token` from a raw Socket.IO CONNECT frame on the default namespace
 * (Engine.IO "4" message + Socket.IO "0" connect: `40{"token":"…"}`).
 * The binding never surfaces CONNECT packets, so the server inspects raw client frames.
 * Returns undefined for any other frame, null for a CONNECT without a usable token.
 */
export function readConnectToken(frame: unknown): string | null | undefined {
  if (typeof frame !== 'string' || !frame.startsWith('40')) return undefined
  const payload = frame.slice(2)
  if (!payload.startsWith('{')) return null
  try {
    const auth: unknown = JSON.parse(payload)
    const token = typeof auth === 'object' && auth !== null ? Reflect.get(auth, 'token') : undefined
    return typeof token === 'string' && token !== '' ? token : null
  } catch {
    return null
  }
}

/** Unknown, missing or expired tokens connect as guests (public events only). */
export function resolveUserId(token: string | null): string | null {
  if (!token) return null
  const session = getDb().sessions.find((s) => s.token === token)
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return null
  return session.userId
}

function unregister(entry: ConnectionEntry): void {
  clearInterval(entry.pingTimer)
  connections.delete(entry)
  if (entry.userId) {
    const room = rooms.get(entry.userId)
    room?.delete(entry)
    if (room?.size === 0) rooms.delete(entry.userId)
  }
}

/** Tracks a connection, keeps it alive with server pings and forgets it when it closes. */
export function registerConnection(userId: string | null, io: SocketIoDuplex): () => void {
  const entry: ConnectionEntry = {
    io,
    userId,
    pingTimer: setInterval(() => io.rawClient.send(ENGINE_IO_PING), PING_INTERVAL_MS),
  }
  connections.add(entry)
  if (userId) {
    const room = rooms.get(userId) ?? new Set()
    room.add(entry)
    rooms.set(userId, room)
  }
  io.rawClient.addEventListener('close', () => unregister(entry))
  return () => unregister(entry)
}

export function emitToUser(userId: string, envelope: EventEnvelope): void {
  for (const entry of rooms.get(userId) ?? []) entry.io.client.emit(envelope.type, envelope)
}

export function emitToAll(envelope: EventEnvelope): void {
  for (const entry of connections) entry.io.client.emit(envelope.type, envelope)
}

/** Users with at least one authenticated connection in this tab. */
export function connectedUserIds(): string[] {
  return [...rooms.keys()]
}

/** Closes and forgets every connection of a user (session expiry/logout isolation). */
export function disconnectUser(userId: string): void {
  for (const entry of [...(rooms.get(userId) ?? [])]) {
    unregister(entry)
    entry.io.rawClient.close()
  }
}

/** Recent envelopes kept in memory so `event:replay` can re-send one unchanged. */
const MAX_REPLAYABLE = 200
const replayable = new Map<string, EventEnvelope>()

export function rememberForReplay(envelope: EventEnvelope): void {
  replayable.set(envelope.eventId, envelope)
  if (replayable.size > MAX_REPLAYABLE) replayable.delete(replayable.keys().next().value!)
}

/** Re-sends a past envelope unchanged to its original audience. Returns false when unknown. */
export function replayEnvelope(eventId: string): boolean {
  const envelope = replayable.get(eventId)
  if (!envelope) return false
  if (envelope.userId) emitToUser(envelope.userId, envelope)
  else emitToAll(envelope)
  return true
}

/** Mock-only probe (spike/e2e): tells each connection which user the server resolved. */
export function emitWhoAmI(): void {
  for (const entry of connections) entry.io.client.emit('mock.whoami', { userId: entry.userId })
}

function clearRestoreTimer(): void {
  if (restoreTimer !== null) clearTimeout(restoreTimer)
  restoreTimer = null
}

/** Closes every connection server-side and refuses new ones until `restore()` or `seconds` elapse. */
export function dropAll(seconds?: number): void {
  dropped = true
  clearRestoreTimer()
  if (seconds !== undefined) restoreTimer = setTimeout(restore, seconds * 1000)
  for (const entry of [...connections]) {
    unregister(entry)
    entry.io.rawClient.close()
  }
}

export function restore(): void {
  dropped = false
  clearRestoreTimer()
}

export function isDropped(): boolean {
  return dropped
}

/** Test helper: forgets all connections, replayable envelopes and drop state. */
export function resetRealtimeServer(): void {
  for (const entry of [...connections]) unregister(entry)
  replayable.clear()
  restore()
}

/** Built lazily: the link URL depends on `location`, which only exists in the browser. */
export function createSocketHandler() {
  return ws.link(resolveSocketUrl()).addEventListener('connection', (connection) => {
    if (dropped) {
      // Behave like a refused WebSocket: "error" then "close" before the handshake.
      // socket.io-client reports `connect_error` and keeps retrying with backoff.
      // msw types the client as the abstract protocol; at runtime it exposes the intercepted WebSocket.
      const socket = Reflect.get(connection.client, 'socket') as WebSocket | undefined
      socket?.dispatchEvent(new Event('error'))
      connection.client.close(1006, 'Mock socket dropped')
      return
    }
    // Starts as a guest (public broadcast set); joins the user room once the CONNECT
    // frame carrying `auth.token` arrives (sent right after the Engine.IO handshake).
    const io = toSocketIo(connection)
    let unregisterConnection = registerConnection(null, io)
    let authenticated = false
    connection.client.addEventListener('message', (event) => {
      if (authenticated) return
      const token = readConnectToken(event.data)
      if (token === undefined) return
      authenticated = true
      unregisterConnection()
      unregisterConnection = registerConnection(resolveUserId(token), io)
    })
  })
}
