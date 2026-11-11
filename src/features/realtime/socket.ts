import { io, type Socket } from 'socket.io-client'

/** Empty VITE_SOCKET_URL (e.g. static deploys) means "same origin as the app". */
export function resolveSocketUrl(): string {
  return import.meta.env.VITE_SOCKET_URL || window.location.origin
}

/**
 * Creates a lazy Socket.IO client. The session token travels both in the CONNECT `auth`
 * payload (what a real Socket.IO server reads) and in the handshake query string
 * (what the mock server can read, see spec §6 "Spike results"). Guests pass an empty token.
 */
export function createSocket(token: string): Socket {
  return io(resolveSocketUrl(), {
    transports: ['websocket'],
    auth: { token },
    query: { token },
    autoConnect: false,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  })
}
