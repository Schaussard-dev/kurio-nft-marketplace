import {
  AxiosError,
  CanceledError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { Session } from '@/shared/contracts'

const SESSION: Session = {
  token: 'tok',
  expiresAt: '2030-01-01T00:00:00.000Z',
  user: { id: 'u1', username: 'ana', email: 'ana@kurio.dev', displayName: 'Ana', avatarUrl: null },
}

function reply(config: InternalAxiosRequestConfig, status: number, data: unknown): Promise<AxiosResponse> {
  const response = { status, data, statusText: '', headers: {}, config } as AxiosResponse
  if (status >= 200 && status < 300) return Promise.resolve(response)
  return Promise.reject(new AxiosError('fail', 'ERR_BAD_REQUEST', config, null, response))
}

async function load(adapter: AxiosAdapter, session: Session | null) {
  vi.resetModules()
  const store = new Map<string, string>()
  if (session) store.set('kurio-session', JSON.stringify(session))
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  const mod = await import('./http')
  mod.http.defaults.adapter = adapter
  return mod
}

describe('http', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('adds Authorization and X-Cart-Id headers', async () => {
    let seen: InternalAxiosRequestConfig | undefined
    const { request } = await load((c) => {
      seen = c
      return reply(c, 200, { ok: true })
    }, SESSION)
    await request({ url: '/x' }, z.object({ ok: z.boolean() }))
    expect(seen!.headers.get('Authorization')).toBe('Bearer tok')
    expect(seen!.headers.get('X-Cart-Id')).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('omits Authorization without a session', async () => {
    let seen: InternalAxiosRequestConfig | undefined
    const { request } = await load((c) => {
      seen = c
      return reply(c, 200, {})
    }, null)
    await request({ url: '/x' }, z.object({}))
    expect(seen!.headers.get('Authorization')).toBeFalsy()
  })

  it('rejects with ApiError and fires the handler on 401 SESSION_EXPIRED with a token', async () => {
    const { request, setSessionExpiredHandler } = await load(
      (c) => reply(c, 401, { error: { code: 'SESSION_EXPIRED', message: 'x' } }),
      SESSION,
    )
    const { ApiError } = await import('./api-error')
    const handler = vi.fn()
    setSessionExpiredHandler(handler)
    await expect(request({ url: '/x' }, z.unknown())).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledWith('expired')
  })

  it('does not fire the handler when no token was sent', async () => {
    const { request, setSessionExpiredHandler } = await load(
      (c) => reply(c, 401, { error: { code: 'UNAUTHENTICATED', message: 'x' } }),
      null,
    )
    const handler = vi.fn()
    setSessionExpiredHandler(handler)
    await expect(request({ url: '/x' }, z.unknown())).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not fire the handler when the request opts out with skipSessionExpiry', async () => {
    const { request, setSessionExpiredHandler } = await load(
      (c) => reply(c, 401, { error: { code: 'SESSION_EXPIRED', message: 'x' } }),
      SESSION,
    )
    const handler = vi.fn()
    setSessionExpiredHandler(handler)
    await expect(request({ url: '/x', skipSessionExpiry: true }, z.unknown())).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    })
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not fire the handler for other 401 codes', async () => {
    const { request, setSessionExpiredHandler } = await load(
      (c) => reply(c, 401, { error: { code: 'INVALID_PASSWORD', message: 'x' } }),
      SESSION,
    )
    const handler = vi.fn()
    setSessionExpiredHandler(handler)
    await expect(request({ url: '/x' }, z.unknown())).rejects.toMatchObject({ code: 'INVALID_PASSWORD' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('turns a schema mismatch into INVALID_RESPONSE', async () => {
    const { request } = await load((c) => reply(c, 200, { ok: 'nope' }), null)
    await expect(request({ url: '/x' }, z.object({ ok: z.boolean() }))).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      isTransient: false,
    })
  })

  it('passes cancellations through unchanged', async () => {
    const { request } = await load((c) => Promise.reject(new CanceledError(undefined, c)), null)
    await expect(request({ url: '/x' }, z.unknown())).rejects.toBeInstanceOf(CanceledError)
  })
})
