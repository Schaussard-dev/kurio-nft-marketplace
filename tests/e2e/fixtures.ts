import { test as base, expect, type Page, type Request } from '@playwright/test'

/** Kept in sync with src/mocks/scenarios.ts (tests never import app code). */
export type ScenarioName =
  | 'default'
  | 'empty'
  | 'slow'
  | 'jitter'
  | 'offline'
  | 'server-error'
  | 'favorite-fail'
  | 'session-expired'
  | 'signup-conflict'
  | 'price-change'
  | 'sold-out'
  | 'order-timeout'
  | 'payment-declined'
  | 'wallet-reject'

export interface MockControl {
  /** Reseeds the mock DB (applying the scenario seed patch) and activates the scenario. */
  reset(scenario?: ScenarioName): Promise<void>
  /** Switches the active scenario (faults/latency) without reseeding. */
  scenario(scenario: ScenarioName, options?: { latencyOverride?: number | null }): Promise<void>
  /** Triggers a mock action (`/api/__mock/emit`); returns the HTTP status. */
  emit(body: Record<string, unknown> & { action: string }): Promise<number>
}

export interface GotoOptions {
  scenario?: ScenarioName
}

export type DemoUser = 'ana' | 'bruno'

/** Seeded fictional accounts (src/mocks/fixtures/users.ts). */
export const DEMO_USERS: Record<DemoUser, { email: string; password: string; displayName: string }> = {
  ana: { email: 'ana@kurio.dev', password: 'Kurio@2026', displayName: 'Ana Souza' },
  bruno: { email: 'bruno@kurio.dev', password: 'Kurio@2026', displayName: 'Bruno Lima' },
}

interface Fixtures {
  mock: MockControl
  /** Signs in through the real /entrar form and waits for the header account menu. */
  login: (user: DemoUser) => Promise<void>
  /** Navigates with `?scenario=…&reset=1` (fresh seed) and waits until MSW controls the page. */
  gotoFresh: (path: string, options?: GotoOptions) => Promise<void>
}

/** The page load event can fire before the MSW worker takes control of the page. */
export async function waitForMocks(page: Page): Promise<void> {
  await page.waitForFunction('navigator.serviceWorker.controller !== null')
}

/**
 * Resolves once no app API request (/api/*, except /api/__mock/*) has started or finished for quietMs.
 * waitForLoadState('networkidle') returns at once when the page already reached that state, so it
 * cannot wait for a request started afterwards. Requests in flight before the call reset the timer when they end.
 */
export async function waitForApiIdle(page: Page, { quietMs = 1000, timeout = 15_000 } = {}): Promise<void> {
  const pending = new Set<Request>()
  let lastEvent = Date.now()
  const isApi = (request: Request) => {
    const { pathname } = new URL(request.url())
    return pathname.startsWith('/api/') && !pathname.startsWith('/api/__mock/')
  }
  const started = (request: Request) => {
    if (!isApi(request)) return
    pending.add(request)
    lastEvent = Date.now()
  }
  const ended = (request: Request) => {
    if (!isApi(request)) return
    pending.delete(request)
    lastEvent = Date.now()
  }
  page.on('request', started)
  page.on('requestfinished', ended)
  page.on('requestfailed', ended)
  try {
    const deadline = Date.now() + timeout
    while (pending.size > 0 || Date.now() - lastEvent < quietMs) {
      if (Date.now() > deadline) throw new Error('The app API never went idle')
      await page.waitForTimeout(50)
    }
  } finally {
    page.off('request', started)
    page.off('requestfinished', ended)
    page.off('requestfailed', ended)
  }
}

/**
 * Calls a mock control route from inside the page: `page.request` bypasses the
 * service worker, so it would never reach MSW.
 */
async function callMock(page: Page, path: string, body: unknown): Promise<number> {
  await waitForMocks(page)
  return page.evaluate(
    async ({ path, body }) => {
      const res = await fetch(`/api/__mock/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      return res.status
    },
    { path, body },
  )
}

export const test = base.extend<Fixtures>({
  mock: async ({ page }, provide) => {
    await provide({
      async reset(scenario) {
        expect(await callMock(page, 'reset', scenario ? { scenario } : {})).toBe(200)
      },
      async scenario(scenario, { latencyOverride } = {}) {
        const body = latencyOverride === undefined ? { scenario } : { scenario, latencyOverride }
        expect(await callMock(page, 'scenario', body)).toBe(200)
      },
      emit: (body) => callMock(page, 'emit', body),
    })
  },

  login: async ({ page }, provide) => {
    await provide(async (user) => {
      const { email, password, displayName } = DEMO_USERS[user]
      await page.goto('/entrar')
      await waitForMocks(page)
      const form = page.getByRole('form', { name: 'Entrar' })
      await form.getByRole('textbox', { name: /^E-mail/ }).fill(email)
      await form.getByLabel(/^Senha/).fill(password)
      await form.getByRole('button', { name: 'Entrar', exact: true }).click()
      await expect(page.getByRole('button', { name: `Menu de ${displayName}` })).toBeVisible()
    })
  },

  gotoFresh: async ({ page }, provide) => {
    await provide(async (path, { scenario = 'default' } = {}) => {
      const url = new URL(path, 'http://placeholder')
      url.searchParams.set('scenario', scenario)
      url.searchParams.set('reset', '1')
      await page.goto(`${url.pathname}${url.search}${url.hash}`)
      await waitForMocks(page)
    })
  },
})

export { expect }
