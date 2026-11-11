import { z } from 'zod'
import { request } from '@/shared/api/http'
import { sessionSchema, type LoginInput, type RegisterInput, type Session } from '@/shared/contracts'

// Auth calls handle their own 401s (wrong password, stale token): the global expiry redirect stays out.

export function fetchSession(signal?: AbortSignal): Promise<Session> {
  return request({ url: '/auth/session', signal, skipSessionExpiry: true }, sessionSchema)
}

export function loginRequest(input: LoginInput): Promise<Session> {
  return request({ method: 'POST', url: '/auth/login', data: input, skipSessionExpiry: true }, sessionSchema)
}

export function registerRequest(input: RegisterInput): Promise<Session> {
  return request({ method: 'POST', url: '/auth/register', data: input, skipSessionExpiry: true }, sessionSchema)
}

export async function logoutRequest(): Promise<void> {
  await request({ method: 'POST', url: '/auth/logout', skipSessionExpiry: true }, z.unknown())
}
