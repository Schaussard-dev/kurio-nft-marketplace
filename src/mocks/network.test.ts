import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SCENARIOS } from './scenarios'
import { apiErrorBodySchema } from '@/shared/contracts'
import { getMockConfig, resetMockConfig, setMockConfig } from './config'
import { initDb, memoryStorage, resetDb, setStorage, getDb } from './db/store'
import { apiError, nextLatency, resetLatencyRng, withNetwork } from './network'

const URL = 'http://localhost/api/dummy'
const server = setupServer(http.get(URL, withNetwork(() => HttpResponse.json({ ok: true }))))

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  resetMockConfig()
  resetLatencyRng()
})
afterEach(() => server.resetHandlers())

describe('withNetwork', () => {
  it('rejects with a TypeError in the offline scenario', async () => {
    setMockConfig({ scenario: 'offline', latencyOverride: 0 })
    await expect(fetch(URL)).rejects.toBeInstanceOf(TypeError)
  })

  it('rejects when the panel offline toggle is on', async () => {
    setMockConfig({ offline: true, latencyOverride: 0 })
    await expect(fetch(URL)).rejects.toBeInstanceOf(TypeError)
  })

  it('answers 503 TRANSIENT in the server-error scenario', async () => {
    setMockConfig({ scenario: 'server-error', latencyOverride: 0 })
    const res = await fetch(URL)
    expect(res.status).toBe(503)
    const body = apiErrorBodySchema.parse(await res.json())
    expect(body.error.code).toBe('TRANSIENT')
  })

  it('passes through in the default scenario', async () => {
    setMockConfig({ latencyOverride: 0 })
    expect(await (await fetch(URL)).json()).toEqual({ ok: true })
  })

  it('produces a reproducible jitter latency sequence', () => {
    setMockConfig({ scenario: 'jitter' })
    const first = Array.from({ length: 6 }, () => nextLatency())
    resetLatencyRng()
    const second = Array.from({ length: 6 }, () => nextLatency())
    expect(second).toEqual(first)
    expect(first.every((ms) => ms >= 50 && ms <= 1500)).toBe(true)
    expect(new Set(first).size).toBeGreaterThan(1)
  })

  it('uses the exact slow latency', () => {
    setMockConfig({ scenario: 'slow' })
    expect(nextLatency()).toBe(2500)
  })

  it('skips the delay when latencyOverride is 0', async () => {
    setMockConfig({ scenario: 'slow', latencyOverride: 0 })
    const start = performance.now()
    await fetch(URL)
    expect(performance.now() - start).toBeLessThan(50)
  })

  it('ends a timeout fault when the client aborts', async () => {
    setMockConfig({ latencyOverride: 0 })
    const original = SCENARIOS.default.routeFaults
    SCENARIOS.default.routeFaults = [{ method: 'GET', pathPattern: '/api/dummy', error: 'timeout' }]
    try {
      const controller = new AbortController()
      const pending = fetch(URL, { signal: controller.signal })
      setTimeout(() => controller.abort(), 30)
      await expect(pending).rejects.toBeDefined()
    } finally {
      SCENARIOS.default.routeFaults = original
    }
  })
})

describe('apiError', () => {
  it('builds a contract-shaped error body', async () => {
    const res = apiError(422, 'VALIDATION_ERROR', 'Dados inválidos', { email: ['Inválido'] })
    expect(res.status).toBe(422)
    const body = apiErrorBodySchema.parse(await res.json())
    expect(body.error.fieldErrors).toEqual({ email: ['Inválido'] })
  })
})

describe('config', () => {
  it('persists partial updates and rejects unknown scenarios', () => {
    setMockConfig({ scenario: 'slow' })
    setMockConfig({ latencyOverride: 10 })
    expect(getMockConfig()).toEqual({ scenario: 'slow', latencyOverride: 10, offline: false })
    // @ts-expect-error invalid scenario
    setMockConfig({ scenario: 'nope' })
    expect(getMockConfig().scenario).toBe('slow')
  })
})

describe('resetDb with scenario', () => {
  it('applies the seedPatch of the empty scenario', async () => {
    setStorage(memoryStorage())
    await initDb()
    await resetDb('empty')
    expect(getDb().nfts).toHaveLength(0)
    expect(getDb().scenario).toBe('empty')
    await resetDb('default')
    expect(getDb().nfts).toHaveLength(60)
  })
})
