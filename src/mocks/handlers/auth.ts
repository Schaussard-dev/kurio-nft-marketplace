import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { loginInputSchema, registerInputSchema, type Session } from '@/shared/contracts'
import { getMockConfig } from '../config'
import { getDb, mutate } from '../db/store'
import { hashPassword, verifyPassword } from '../db/password'
import type { SessionRecord, UserRecord } from '../db/schema'
import { apiError, withNetwork } from '../network'
import { disconnectUser } from '../realtime/server'
import { SCENARIOS } from '../scenarios'
import { registerMockAction } from './mock-control'

export const SESSION_TTL_MS = 30 * 60_000

function randomHex(bytes: number): string {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
}

function toSession(record: SessionRecord, user: UserRecord): Session {
  return {
    token: record.token,
    expiresAt: record.expiresAt,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
  }
}

function createSession(user: UserRecord): Session {
  const record: SessionRecord = {
    token: randomHex(32),
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    requestCount: 0,
  }
  mutate((db) => {
    db.sessions.push(record)
  })
  return toSession(record, user)
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization')
  const match = header?.match(/^Bearer (.+)$/)
  return match ? match[1] : null
}

const isExpired = (record: SessionRecord) => Date.parse(record.expiresAt) <= Date.now()

/**
 * Resolves the session of an authenticated request. Missing token → 401 UNAUTHENTICATED;
 * unknown, expired or invalidated token → 401 SESSION_EXPIRED. Valid requests slide the TTL
 * and count towards the scenario's `sessionTtlRequests` limit.
 */
export function requireSession(request: Request): { user: UserRecord; session: SessionRecord } | Response {
  const token = bearerToken(request)
  if (!token) return apiError(401, 'UNAUTHENTICATED', 'Entre para continuar')
  const expired = () => apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou')
  const db = getDb()
  const session = db.sessions.find((s) => s.token === token)
  const user = session && db.users.find((u) => u.id === session.userId)
  if (!session || !user || isExpired(session)) return expired()

  const limit = SCENARIOS[getMockConfig().scenario].flags?.sessionTtlRequests
  const count = (session.requestCount ?? 0) + 1
  if (limit !== undefined && count > limit) {
    expireSessions((s) => s.token === token)
    return expired()
  }
  mutate(() => {
    session.requestCount = count
    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  })
  return { user, session }
}

/** Shorthand used by every authenticated handler: the user, or the 401 response to return. */
export function requireUser(request: Request): UserRecord | Response {
  const result = requireSession(request)
  return result instanceof Response ? result : result.user
}

/** Marks matching sessions as expired (kept so the token answers SESSION_EXPIRED) and closes their sockets. */
function expireSessions(match: (session: SessionRecord) => boolean): void {
  const userIds = new Set<string>()
  mutate((db) => {
    for (const session of db.sessions) {
      if (!match(session) || isExpired(session)) continue
      session.expiresAt = new Date(0).toISOString()
      userIds.add(session.userId)
    }
  })
  userIds.forEach(disconnectUser)
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

function validationError(error: z.ZodError) {
  const { fieldErrors } = z.flattenError(error)
  return apiError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados', fieldErrors as Record<string, string[]>)
}

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const authHandlers = [
  http.post(
    '/api/auth/register',
    withNetwork(async ({ request }) => {
      const parsed = registerInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return validationError(parsed.error)
      const { username, email, password } = parsed.data

      const db = getDb()
      const fieldErrors: Record<string, string[]> = {}
      if (db.users.some((u) => sameEmail(u.email, email))) fieldErrors.email = ['E-mail já cadastrado']
      if (db.users.some((u) => u.username === username)) fieldErrors.username = ['Nome de usuário indisponível']
      if (fieldErrors.email || fieldErrors.username) {
        const code = fieldErrors.email ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN'
        return apiError(409, code, 'Já existe uma conta com esses dados', fieldErrors)
      }

      const user: UserRecord = {
        id: `usr_${randomHex(8)}`,
        username,
        email: email.trim().toLowerCase(),
        displayName: username,
        avatarUrl: null,
        walletNickname: '',
        ensName: '',
        // Random salt per account (only the seed uses deterministic salts).
        passwordRecord: await hashPassword(password),
        createdAt: new Date().toISOString(),
      }
      mutate((state) => {
        state.users.push(user)
      })
      return HttpResponse.json(createSession(user), { status: 201 })
    }),
  ),

  http.post(
    '/api/auth/login',
    withNetwork(async ({ request }) => {
      const parsed = loginInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return validationError(parsed.error)
      const user = getDb().users.find((u) => sameEmail(u.email, parsed.data.email))
      // Same answer for unknown e-mail and wrong password (no account enumeration).
      const valid = user ? await verifyPassword(parsed.data.password, user.passwordRecord) : false
      if (!user || !valid) return apiError(401, 'UNAUTHENTICATED', 'E-mail ou senha inválidos')
      return HttpResponse.json(createSession(user))
    }),
  ),

  http.get(
    '/api/auth/session',
    withNetwork(({ request }) => {
      const result = requireSession(request)
      if (result instanceof Response) return result
      return HttpResponse.json(toSession(result.session, result.user))
    }),
  ),

  http.post(
    '/api/auth/logout',
    withNetwork(({ request }) => {
      const token = bearerToken(request)
      const session = token ? getDb().sessions.find((s) => s.token === token) : undefined
      if (session) {
        mutate((db) => {
          db.sessions = db.sessions.filter((s) => s.token !== token)
        })
        disconnectUser(session.userId)
      }
      // Idempotent: ending an unknown or expired session is still a successful logout.
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]

/** `session:expire` (mock panel / tests): every active session in this tab's mock API expires now. */
export function registerAuthMockActions(): void {
  registerMockAction('session:expire', () => expireSessions(() => true))
}
