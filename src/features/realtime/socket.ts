import { io, type Socket } from 'socket.io-client'

/** Empty VITE_SOCKET_URL (e.g. static deploys) means "same origin as the app". */
export function resolveSocketUrl(): string {
  return import.meta.env.VITE_SOCKET_URL || window.location.origin
}

/**
 * Creates a lazy Socket.IO client. The session token travels only in the CONNECT `auth`
 * payload, never in the URL (keeps it out of logs and history). Guests pass an empty token.
 */
export function createSocket(token: string): Socket {
  return io(resolveSocketUrl(), {
    transports: ['websocket'],
    auth: { token },
    autoConnect: false,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  })
}
