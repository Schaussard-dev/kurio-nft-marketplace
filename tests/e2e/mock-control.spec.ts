import { expect, test, type Page } from '@playwright/test'

/** The page load event can fire before the MSW worker takes control of the page. */
async function waitForMocks(page: Page) {
  await page.waitForFunction('navigator.serviceWorker.controller !== null')
}

test.describe('mock control endpoints', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop project only')

  test('boot params are stripped and scenario faults apply until reset', async ({ page }) => {
    await page.goto('/?keep=1&scenario=offline&reset=1')
    await waitForMocks(page)
    await expect.poll(() => new URL(page.url()).search).toBe('?keep=1')

    const faulted = await page.evaluate(() =>
      fetch('/api/__mock/ping').then(
        () => 'ok',
        () => 'network-error',
      ),
    )
    expect(faulted).toBe('network-error')

    const reset = await page.evaluate(async () => {
      const res = await fetch('/api/__mock/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenario: 'default' }),
      })
      return res.json()
    })
    expect(reset).toEqual({ ok: true })

    const healthy = await page.evaluate(async () => (await fetch('/api/__mock/ping')).json())
    expect(healthy).toEqual({ ok: true })
  })

  test('emit actions without a registered handler answer 501', async ({ page }) => {
    await page.goto('/')
    await waitForMocks(page)
    const status = await page.evaluate(async () => {
      const res = await fetch('/api/__mock/emit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // order:resolve gets its handler with the orders feature (Task 18); pick another unregistered action then.
        body: JSON.stringify({ action: 'order:resolve', orderId: 'ord_x' }),
      })
      return res.status
    })
    expect(status).toBe(501)
  })
})
