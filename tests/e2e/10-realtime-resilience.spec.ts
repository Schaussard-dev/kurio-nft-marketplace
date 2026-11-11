import type { Page } from '@playwright/test'
import { expect, test, waitForRealtime } from './fixtures'

// Duplicated / out-of-order events and connection loss. Everything is triggered through the mock
// server (`/api/__mock/emit`), which talks to the app over its real Socket.IO client.

const cartLine = (page: Page, name: string) => page.getByTestId('cart-line').filter({ hasText: name })
const priceNotice = (page: Page) => page.getByTestId('price-notice')
const socketStatus = (page: Page) => page.getByTestId('socket-status')

async function buyEmeraldApe(page: Page, isMobile: boolean) {
  await page.goto('/nft/nft_042')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
  await expect(page).toHaveURL('/carrinho')
  await expect(cartLine(page, 'Emerald Ape #042').getByTestId('line-total')).toHaveText('1.19 ETH')
}

/** Total of the quote the API gives now for the visitor's cart (fetched inside the page). */
async function apiTotal(page: Page): Promise<string> {
  const total = await page.evaluate(async () => {
    const res = await fetch('/api/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Cart-Id': localStorage.getItem('kurio-guest-cart-id') ?? '' },
      body: JSON.stringify({ network: 'ethereum' }),
    })
    return ((await res.json()) as { total: string }).total
  })
  return `${total} ETH`
}

/** Records every polite announcement from now on (the live region text is replaced each time). */
async function recordAnnouncements(page: Page): Promise<() => Promise<string[]>> {
  // A string script: the e2e tsconfig has no DOM types.
  await page.evaluate(`(() => {
    const region = document.querySelector('[data-testid="live-polite"]')
    const log = []
    window.__announcements = log
    new MutationObserver(() => {
      if (region.textContent) log.push(region.textContent)
    }).observe(region, { childList: true, characterData: true, subtree: true })
  })()`)
  return () => page.evaluate<string[]>('window.__announcements')
}

test.describe('realtime resilience', () => {
  test.describe.configure({ timeout: 60_000 })

  test('a replayed older event changes nothing and is not announced again', async ({ page, gotoFresh, mock, isMobile }) => {
    await gotoFresh('/')
    await buyEmeraldApe(page, isMobile)
    await waitForRealtime(page)
    const announcements = await recordAnnouncements(page)
    const ape = cartLine(page, 'Emerald Ape #042')

    const first = await mock.emitJson<{ eventId: string }>({ action: 'nft:update', nftId: 'nft_042', price: '1.29' })
    expect(first.status).toBe(200)
    expect(typeof first.body.eventId).toBe('string')
    await expect(priceNotice(page)).toContainText('mudou de 1.19 para 1.29 ETH')

    expect(await mock.emit({ action: 'nft:update', nftId: 'nft_042', price: '1.39' })).toBe(200)
    await expect(priceNotice(page)).toContainText('mudou de 1.29 para 1.39 ETH')
    await expect(ape.getByTestId('line-total')).toHaveText('1.39 ETH')

    // The server re-sends the identical (older) 1.29 envelope.
    expect(await mock.emit({ action: 'event:replay', eventId: first.body.eventId })).toBe(200)
    // Events arrive in order on one socket: once this newer one shows, the replay was already handled.
    expect(await mock.emit({ action: 'nft:update', nftId: 'nft_042', price: '1.49' })).toBe(200)
    await expect(priceNotice(page)).toContainText('mudou de 1.39 para 1.49 ETH')
    await expect(ape.getByTestId('line-total')).toHaveText('1.49 ETH')

    await expect(priceNotice(page).getByRole('listitem')).toHaveCount(1)
    expect((await announcements()).filter((text) => text.includes('mudou de'))).toEqual([
      'O preço de Emerald Ape #042 mudou de 1.19 para 1.29 ETH',
      'O preço de Emerald Ape #042 mudou de 1.29 para 1.39 ETH',
      'O preço de Emerald Ape #042 mudou de 1.39 para 1.49 ETH',
    ])
  })

  test('a dropped connection shows "Reconectando…" and reconciles missed changes through REST on reconnect', async ({
    page,
    gotoFresh,
    mock,
    isMobile,
  }) => {
    await gotoFresh('/')
    await buyEmeraldApe(page, isMobile)
    await waitForRealtime(page)
    const ape = cartLine(page, 'Emerald Ape #042')

    expect(await mock.emit({ action: 'socket:drop' })).toBe(200)
    await expect(socketStatus(page)).toHaveText('Reconectando…')
    await expect(socketStatus(page)).toHaveAttribute('data-status', 'reconnecting')

    // Happens while the app is offline: no socket hears it.
    expect(await mock.emit({ action: 'nft:update', nftId: 'nft_042', price: '1.49' })).toBe(200)
    await expect(ape.getByTestId('line-total')).toHaveText('1.19 ETH')

    expect(await mock.emit({ action: 'socket:restore' })).toBe(200)
    await waitForRealtime(page)
    await expect(ape.getByTestId('line-total')).toHaveText('1.49 ETH')
    await expect(page.getByTestId('summary-total')).toHaveText(await apiTotal(page))
    await expect(socketStatus(page)).not.toContainText('Reconectando…')
    // Reconciliation reads the current state; it does not invent a change notice.
    await expect(priceNotice(page)).toHaveCount(0)
  })
})
