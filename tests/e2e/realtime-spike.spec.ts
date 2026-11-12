import { expect, test, type Page } from '@playwright/test'

/**
 * Spike: validates @mswjs/socket.io-binding against the real socket.io-client module.
 * Runs only in the `spike` project (Vite dev server), which can import source modules directly.
 */

const SOCKET_MODULE = '/src/features/realtime/socket.ts'
const SPIKE_TOKEN = 'spike-token-ana'

interface SpikeLog {
  events: Array<{ name: string; payload?: unknown }>
}

async function waitForMocks(page: Page) {
  await page.waitForFunction("navigator.serviceWorker.controller !== null && document.documentElement.dataset.mocks === 'ready'")
}

/** Seeds a session for ana straight into the persisted mock DB (no auth endpoint exists yet). */
async function bootWithSession(page: Page) {
  await page.goto('/?reset=1')
  await waitForMocks(page)
  await page.evaluate((token) => {
    const key = 'kurio-mock-db:v1'
    const db = JSON.parse(localStorage.getItem(key)!)
    db.sessions.push({ token, userId: 'usr_ana', expiresAt: new Date(Date.now() + 86_400_000).toISOString() })
    localStorage.setItem(key, JSON.stringify(db))
  }, SPIKE_TOKEN)
  await page.reload()
  await waitForMocks(page)
}

/** Creates a socket through the real client module and records every lifecycle/app event. */
async function openSocket(page: Page, name: string, token: string) {
  await page.evaluate(
    async ({ modulePath, name, token }) => {
      const { createSocket } = await import(/* @vite-ignore */ modulePath)
      const log: SpikeLog = { events: [] }
      const socket = createSocket(token)
      for (const event of ['connect', 'disconnect', 'connect_error']) {
        socket.on(event, (payload: unknown) => log.events.push({ name: event, payload: String(payload ?? '') }))
      }
      for (const event of ['nft.updated', 'mock.whoami']) {
        socket.on(event, (payload: unknown) => log.events.push({ name: event, payload }))
      }
      const registry = ((globalThis as Record<string, unknown>).__spike ??= {}) as Record<string, unknown>
      registry[name] = { socket, log }
      socket.connect()
    },
    { modulePath: SOCKET_MODULE, name, token },
  )
}

function eventsOf(page: Page, name: string) {
  return page.evaluate((name) => {
    const registry = (globalThis as Record<string, unknown>).__spike as Record<string, { log: SpikeLog }>
    return registry[name].log.events
  }, name)
}

function isConnected(page: Page, name: string) {
  return page.evaluate((name) => {
    const registry = (globalThis as Record<string, unknown>).__spike as Record<string, { socket: { connected: boolean } }>
    return registry[name].socket.connected
  }, name)
}

async function emit(page: Page, body: Record<string, unknown>) {
  const status = await page.evaluate(async (body) => {
    const res = await fetch('/api/__mock/emit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.status
  }, body)
  expect(status).toBe(200)
}

const names = (events: SpikeLog['events']) => events.map((e) => e.name)

test.describe('realtime spike', () => {
  test('(a) nft.updated emitted through /__mock/emit reaches users and guests', async ({ page }) => {
    await bootWithSession(page)
    await openSocket(page, 'ana', SPIKE_TOKEN)
    await openSocket(page, 'guest', '')
    await expect.poll(() => isConnected(page, 'ana')).toBe(true)
    await expect.poll(() => isConnected(page, 'guest')).toBe(true)

    await emit(page, { action: 'nft:update', nftId: 'nft_042', price: '1.29' })

    for (const who of ['ana', 'guest']) {
      await expect.poll(async () => names(await eventsOf(page, who))).toContain('nft.updated')
      const envelope = (await eventsOf(page, who)).find((e) => e.name === 'nft.updated')!.payload as Record<string, unknown>
      expect(envelope).toMatchObject({
        type: 'nft.updated',
        resource: { type: 'nft', id: 'nft_042' },
        userId: null,
        data: { price: '1.29', previousPrice: '1.19' },
      })
      expect(typeof envelope.eventId).toBe('string')
      expect(envelope.version).toBeGreaterThan(1)
    }

    // An empty patch (no price, no editions) is rejected and emits nothing.
    const emptyStatus = await page.evaluate(async () => {
      const res = await fetch('/api/__mock/emit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'nft:update', nftId: 'nft_042' }),
      })
      return res.status
    })
    expect(emptyStatus).toBe(422)

    // event:replay re-sends the exact same envelope.
    const first = (await eventsOf(page, 'ana')).find((e) => e.name === 'nft.updated')!.payload as { eventId: string }
    await emit(page, { action: 'event:replay', eventId: first.eventId })
    await expect
      .poll(async () => (await eventsOf(page, 'ana')).filter((e) => e.name === 'nft.updated').length)
      .toBe(2)
    const replayed = (await eventsOf(page, 'ana')).filter((e) => e.name === 'nft.updated')[1].payload
    expect(replayed).toEqual(first)
  })

  test('(b) the server resolves the session token to the user', async ({ page }) => {
    const socketUrls: string[] = []
    page.on('websocket', (socket) => socketUrls.push(socket.url()))
    await bootWithSession(page)
    await openSocket(page, 'ana', SPIKE_TOKEN)
    await openSocket(page, 'guest', '')
    await expect.poll(() => isConnected(page, 'ana')).toBe(true)
    await expect.poll(() => isConnected(page, 'guest')).toBe(true)

    // The token travels only in the CONNECT auth payload, never in the WebSocket URL.
    const transportQuery = await page.evaluate(() => {
      const registry = (globalThis as Record<string, unknown>).__spike as Record<
        string,
        { socket: { io: { engine: { transport: { query: Record<string, string> } } } } }
      >
      return registry.ana.socket.io.engine.transport.query
    })
    expect(Object.keys(transportQuery)).not.toContain('token')
    expect(JSON.stringify(transportQuery)).not.toContain(SPIKE_TOKEN)
    // Mocked sockets never reach the network (page "websocket" events stay empty), so also read
    // the URL of the WebSocket instance the transport actually opened.
    const openedUrl = await page.evaluate(() => {
      const registry = (globalThis as Record<string, unknown>).__spike as Record<
        string,
        { socket: { io: { engine: { transport: { ws: { url: string } } } } } }
      >
      return registry.ana.socket.io.engine.transport.ws.url
    })
    expect(openedUrl).toContain('/socket.io/')
    // Filter on /socket.io/: Vite's own HMR socket legitimately carries a ?token= of its own.
    for (const url of [openedUrl, ...socketUrls.filter((u) => u.includes('/socket.io/'))]) {
      expect(url).not.toContain(SPIKE_TOKEN)
      expect(new URL(url).searchParams.has('token')).toBe(false)
    }

    await emit(page, { action: 'whoami' })

    await expect
      .poll(async () => (await eventsOf(page, 'ana')).find((e) => e.name === 'mock.whoami')?.payload)
      .toEqual({ userId: 'usr_ana' })
    await expect
      .poll(async () => (await eventsOf(page, 'guest')).find((e) => e.name === 'mock.whoami')?.payload)
      .toEqual({ userId: null })
  })

  test('(c) socket:drop disconnects, refuses reconnection, and socket:restore lets the client back in', async ({ page }) => {
    await bootWithSession(page)
    await openSocket(page, 'ana', SPIKE_TOKEN)
    await expect.poll(() => isConnected(page, 'ana')).toBe(true)

    await emit(page, { action: 'socket:drop' })
    await expect.poll(async () => names(await eventsOf(page, 'ana'))).toContain('disconnect')
    // The client keeps retrying and is refused while the drop lasts.
    await expect.poll(async () => names(await eventsOf(page, 'ana'))).toContain('connect_error')
    expect(await isConnected(page, 'ana')).toBe(false)

    await emit(page, { action: 'socket:restore' })
    await expect.poll(() => isConnected(page, 'ana'), { timeout: 10_000 }).toBe(true)
    expect(names(await eventsOf(page, 'ana')).filter((n) => n === 'connect')).toHaveLength(2)

    // Timed drop restores by itself.
    await emit(page, { action: 'socket:drop', seconds: 1 })
    await expect.poll(async () => names(await eventsOf(page, 'ana')).filter((n) => n === 'disconnect').length).toBe(2)
    await expect.poll(() => isConnected(page, 'ana'), { timeout: 10_000 }).toBe(true)
  })

  test('(d) the connection survives 60s of idle time (ping/pong)', async ({ page }) => {
    await page.clock.install()
    await bootWithSession(page)
    await openSocket(page, 'ana', SPIKE_TOKEN)
    await expect.poll(() => isConnected(page, 'ana')).toBe(true)

    await page.clock.runFor(60_000)

    expect(await isConnected(page, 'ana')).toBe(true)
    expect(names(await eventsOf(page, 'ana'))).not.toContain('disconnect')
  })
})
