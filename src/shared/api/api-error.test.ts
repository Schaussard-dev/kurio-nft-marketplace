import { AxiosError, CanceledError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'
import { ApiError, toApiError } from './api-error'

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const config = { headers: {} } as InternalAxiosRequestConfig
  const response = { status, data, statusText: '', headers: {}, config } as AxiosResponse
  return new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, response)
}

describe('toApiError', () => {
  it('maps a 409 body to QUOTE_STALE', () => {
    const err = toApiError(
      axiosErrorWith(409, { error: { code: 'QUOTE_STALE', message: 'Cotação expirada', details: { a: 1 } } }),
    )
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(409)
    expect(err.code).toBe('QUOTE_STALE')
    expect(err.message).toBe('Cotação expirada')
    expect(err.details).toEqual({ a: 1 })
    expect(err.isTransient).toBe(false)
  })

  it('keeps fieldErrors on 422 and is not transient', () => {
    const err = toApiError(
      axiosErrorWith(422, {
        error: { code: 'VALIDATION_ERROR', message: 'x', fieldErrors: { email: ['inválido'] } },
      }),
    )
    expect(err.fieldErrors).toEqual({ email: ['inválido'] })
    expect(err.isTransient).toBe(false)
  })

  it('maps a missing response to NETWORK and transient', () => {
    const err = toApiError(new AxiosError('Network Error', 'ERR_NETWORK'))
    expect(err.code).toBe('NETWORK')
    expect(err.status).toBe(0)
    expect(err.isTransient).toBe(true)
  })

  it('maps ECONNABORTED to TIMEOUT and transient', () => {
    const err = toApiError(new AxiosError('timeout', 'ECONNABORTED'))
    expect(err.code).toBe('TIMEOUT')
    expect(err.isTransient).toBe(true)
  })

  it('treats 5xx without a valid body as transient', () => {
    const err = toApiError(axiosErrorWith(503, '<html>'))
    expect(err.status).toBe(503)
    expect(err.isTransient).toBe(true)
  })

  it('treats TRANSIENT code as transient', () => {
    const err = toApiError(axiosErrorWith(429, { error: { code: 'TRANSIENT', message: 'retry' } }))
    expect(err.code).toBe('TRANSIENT')
    expect(err.isTransient).toBe(true)
  })

  it('treats 404 without a valid body as not transient', () => {
    expect(toApiError(axiosErrorWith(404, null)).isTransient).toBe(false)
  })

  it('returns an existing ApiError unchanged', () => {
    const original = new ApiError({ status: 400, code: 'FORBIDDEN', message: 'm' })
    expect(toApiError(original)).toBe(original)
  })

  it('wraps unknown values as a non-transient error', () => {
    const err = toApiError('boom')
    expect(err).toBeInstanceOf(ApiError)
    expect(err.isTransient).toBe(false)
  })

  it('maps a CanceledError to a non-transient CANCELED error', () => {
    const err = toApiError(new CanceledError())
    expect(err.code).toBe('CANCELED')
    expect(err.isTransient).toBe(false)
  })

  it('treats bodiless 408 and 429 as transient', () => {
    expect(toApiError(axiosErrorWith(408, null)).code).toBe('TRANSIENT')
    expect(toApiError(axiosErrorWith(429, '')).isTransient).toBe(true)
  })
})
