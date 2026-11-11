import type { Page } from '@playwright/test'
import { expect, test, waitForApiIdle, waitForRealtime } from './fixtures'
import { listOrders, openCheckout, openReview, recordOrderPosts, reviewDialog, sendButton } from './checkout-helpers'

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

// Pending orders: recovery after reload / connection loss, immutable receipt and per-user isolation.
test.describe('pending order resilience', () => {
  test.describe.configure({ timeout: 90_000 })

  const pendingStatus = (page: Page) => page.getByRole('status').filter({ hasText: 'Aguardando confirmação na rede…' })
  const receipt = (page: Page) => page.getByRole('region', { name: 'Seus NFTs agora estão na sua carteira' })
  const pendingBanner = (page: Page) => page.getByText('Você tem um pedido em processamento')

  /** Freezes the page's wall clock (timers keep running), so a pending order is not due until unfrozen. */
  async function freezeTime(page: Page): Promise<number> {
    const now = await page.evaluate(() => Date.now())
    await page.clock.setFixedTime(now)
    return now
  }

  async function placePendingOrder(page: Page): Promise<string> {
    await openCheckout(page)
    await waitForRealtime(page)
    await openReview(page)
    await sendButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_[0-9a-f]+$/)
    return page.url().split('/').pop()!
  }

  async function signOut(page: Page, displayName: string) {
    await page.getByRole('button', { name: `Menu de ${displayName}` }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
    await expect(page.getByRole('button', { name: `Menu de ${displayName}` })).toHaveCount(0)
  }

  test('a pending order survives a reload and a dropped connection, then shows the receipt from its snapshot', async ({
    page,
    gotoFresh,
    login,
    mock,
  }) => {
    await page.clock.install()
    await gotoFresh('/')
    await login('ana')
    const frozenAt = await freezeTime(page)
    const posts = recordOrderPosts(page)

    // Connection lost before the order is sent: the page must not depend on the socket.
    await openCheckout(page)
    await waitForRealtime(page)
    expect(await mock.emit({ action: 'socket:drop' })).toBe(200)
    await expect(socketStatus(page)).toHaveAttribute('data-status', 'reconnecting')
    await openReview(page)
    const reviewTotal = (await reviewDialog(page).getByTestId('review-total').textContent())!
    await sendButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_[0-9a-f]+$/)
    const orderId = page.url().split('/').pop()!
    await expect(pendingStatus(page)).toBeVisible()
    await expect(page.getByText('Você pode sair desta página com segurança')).toBeVisible()

    // Reload in the middle of the wait: same order, still pending, no second purchase.
    await page.reload()
    await expect(pendingStatus(page)).toBeVisible()
    expect(posts).toHaveLength(1)
    const orders = await listOrders(page)
    expect(orders.map((order) => [order.id, order.status])).toEqual([[orderId, 'pending']])

    // The order resolves while the socket is down: the event is lost, reconnection reconciles via REST.
    await waitForRealtime(page)
    expect(await mock.emit({ action: 'socket:drop' })).toBe(200)
    await expect(socketStatus(page)).toHaveAttribute('data-status', 'reconnecting')
    await page.clock.setSystemTime(frozenAt + 10_000)
    await expect.poll(async () => (await listOrders(page))[0].status).toBe('confirmed')
    expect(await mock.emit({ action: 'socket:restore' })).toBe(200)
    await waitForRealtime(page)

    await expect(receipt(page)).toBeVisible()
    await expect(pendingStatus(page)).toHaveCount(0)
    const totalCell = receipt(page).getByTestId('receipt-total')
    await expect(totalCell).toHaveText(reviewTotal)
    await expect(receipt(page)).toContainText('Sage Nomad #009')
    await expect(receipt(page).getByTestId('receipt-line-total')).toHaveText('1.69 ETH')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('kurio-pending-order:usr_ana'))).toBeNull()

    // A later price change never rewrites the receipt (immutable snapshot).
    expect(await mock.emit({ action: 'nft:update', nftId: 'nft_009', price: '9.99' })).toBe(200)
    await waitForApiIdle(page)
    await expect(totalCell).toHaveText(reviewTotal)
    await expect(receipt(page).getByTestId('receipt-line-total')).toHaveText('1.69 ETH')
    await expect(receipt(page)).not.toContainText('9.99')

    const link = receipt(page).getByRole('link', { name: /Ver no Etherscan/ })
    await expect(link).toHaveAccessibleName('Ver no Etherscan (simulação, abre em nova aba)')
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')

    // Another collector never sees it: 403 renders "Pedido não encontrado" without any order data.
    await signOut(page, 'Ana Souza')
    await login('bruno')
    await page.goto(`/pedidos/${orderId}`)
    await expect(page.getByRole('heading', { name: 'Pedido não encontrado' })).toBeVisible()
    await expect(page.getByRole('main')).not.toContainText('Sage Nomad')
    await expect(page.getByRole('main')).not.toContainText(reviewTotal)
  })

  test('another collector signed in on the same tab gets no trace of the previous user order resolving', async ({
    page,
    gotoFresh,
    login,
    mock,
  }) => {
    await page.clock.install()
    await gotoFresh('/')
    await login('ana')
    await freezeTime(page)
    const orderId = await placePendingOrder(page)
    await expect(pendingStatus(page)).toBeVisible()
    expect(await mock.emit({ action: 'socket:drop' })).toBe(200)

    await signOut(page, 'Ana Souza')
    await login('bruno')
    await expect(pendingBanner(page)).toHaveCount(0)
    expect(await mock.emit({ action: 'socket:restore' })).toBe(200)
    await waitForRealtime(page)
    const announcements = await recordAnnouncements(page)

    const resolved = await mock.emitJson<{ ok: boolean; status: string }>({ action: 'order:resolve', orderId })
    expect(resolved).toEqual({ status: 200, body: { ok: true, status: 'confirmed' } })
    // Any event for bruno would have arrived by the time this public one does (same socket, in order).
    expect(await mock.emit({ action: 'nft:update', nftId: 'nft_042', price: '3.33' })).toBe(200)
    await waitForApiIdle(page)
    expect((await announcements()).filter((text) => /pedido|pagamento/i.test(text))).toEqual([])
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0)
    await expect(pendingBanner(page)).toHaveCount(0)

    // ana, back on this tab, finds her order confirmed (and the pending marker cleared).
    await signOut(page, 'Bruno Lima')
    await login('ana')
    await expect(pendingBanner(page)).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('kurio-pending-order:usr_ana'))).toBeNull()
    await page.goto(`/pedidos/${orderId}`)
    await expect(receipt(page)).toBeVisible()
  })

  test('a pending order left behind shows the global banner until it resolves', async ({ page, gotoFresh, login }) => {
    await page.clock.install()
    await gotoFresh('/')
    await login('ana')
    const frozenAt = await freezeTime(page)
    const orderId = await placePendingOrder(page)
    await page.goto('/')
    await expect(pendingBanner(page)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Acompanhar pedido' })).toHaveAttribute('href', `/pedidos/${orderId}`)
    await waitForRealtime(page)
    await page.clock.setSystemTime(frozenAt + 10_000)
    await expect(pendingBanner(page)).toHaveCount(0)
  })
})
