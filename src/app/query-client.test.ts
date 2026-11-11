import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'
import { createQueryClient, queryKeys } from './query-client'

function httpError(status: number): AxiosError {
  const config = { headers: {} } as InternalAxiosRequestConfig
  const response = { status, data: null, statusText: '', headers: {}, config } as AxiosResponse
  return new AxiosError('x', 'ERR_BAD_RESPONSE', config, null, response)
}

describe('createQueryClient', () => {
  const defaults = createQueryClient().getDefaultOptions()
  const retry = defaults.queries!.retry as (count: number, err: unknown) => boolean

  it('does not retry 404', () => expect(retry(0, httpError(404))).toBe(false))
  it('retries 503 at count 0 and 1, not 2', () => {
    expect(retry(0, httpError(503))).toBe(true)
    expect(retry(1, httpError(503))).toBe(true)
    expect(retry(2, httpError(503))).toBe(false)
  })
  it('has the configured defaults', () => {
    const delay = defaults.queries!.retryDelay as (attempt: number) => number
    expect(delay(0)).toBe(500)
    expect(delay(5)).toBe(4000)
    expect(defaults.queries!.staleTime).toBe(30_000)
    expect(defaults.queries!.gcTime).toBe(300_000)
    expect(defaults.queries!.refetchOnWindowFocus).toBe(false)
    expect(defaults.mutations!.retry).toBe(0)
  })
})

describe('queryKeys', () => {
  it('builds user keys that share the ["user", id] prefix', () => {
    expect(queryKeys.user('u1').cart()).toEqual(['user', 'u1', 'cart'])
    expect(queryKeys.user('u1').order('o1')).toEqual(['user', 'u1', 'order', 'o1'])
    expect(queryKeys.user('u1').all).toEqual(['user', 'u1'])
    expect(queryKeys.users).toEqual(['user'])
  })
  it('builds other keys', () => {
    expect(queryKeys.nft('n1')).toEqual(['nft', 'n1'])
    expect(queryKeys.session()).toEqual(['session'])
    expect(queryKeys.guestCart('g')).toEqual(['guest-cart', 'g'])
    expect(queryKeys.quote('s', { a: 1 })).toEqual(['quote', 's', { a: 1 }])
  })
})
