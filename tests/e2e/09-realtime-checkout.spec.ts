import type { Page } from '@playwright/test'
import { expect, test, waitForRealtime } from './fixtures'

// Realtime events reach the app only through its Socket.IO client: the test asks the mock server
// (`/api/__mock/emit`), which changes the mock DB and pushes `nft.updated` over the socket.

const cartLine = (page: Page, name: string) => page.getByTestId('cart-line').filter({ hasText: name })
const summaryTotal = (page: Page) => page.getByTestId('summary-total')
const priceNotice = (page: Page) => page.getByTestId('price-notice')

/** Detail page → COMPRAR (desktop) / "Comprar NFT" (mobile bar) → /carrinho. */
async function buy(page: Page, isMobile: boolean, nftId: string, quantity = 1) {
  await page.goto(`/nft/${nftId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const increase = page.getByRole('group', { name: 'Quantidade' }).getByRole('button', { name: 'Aumentar quantidade' })
  for (let i = 1; i < quantity; i++) await increase.click()
  await expect(page.getByRole('group', { name: 'Quantidade' }).getByTestId('quantity-value')).toHaveText(String(quantity))
  await page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
  await expect(page).toHaveURL('/carrinho')
}

/** Total of the quote the API gives now for the signed-in user's cart (fetched inside the page). */
async function apiTotal(page: Page): Promise<string> {
  const total = await page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('kurio-session') ?? 'null') as { token: string } | null
    const res = await fetch('/api/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.token ?? ''}` },
      body: JSON.stringify({ network: 'ethereum' }),
    })
    return ((await res.json()) as { total: string }).total
  })
  return `${total} ETH`
}

test.describe('realtime: cart and catalog', () => {
  test.describe.configure({ timeout: 60_000 })

  test('a price change pushed over the socket updates the cart line, shows a notice and re-quotes the summary', async ({
    page,
    gotoFresh,
    login,
    mock,
    isMobile,
  }) => {
    await gotoFresh('/')
    await login('ana')
    await buy(page, isMobile, 'nft_042')
    const ape = cartLine(page, 'Emerald Ape #042')
    await expect(ape.getByTestId('line-total')).toHaveText('1.19 ETH')
    const before = await apiTotal(page)
    await expect(summaryTotal(page)).toHaveText(before)
    await expect(priceNotice(page)).toHaveCount(0)

    await waitForRealtime(page)
    expect(await mock.emit({ action: 'nft:update', nftId: 'nft_042', price: '1.29' })).toBe(200)

    await expect(priceNotice(page)).toContainText('O preço de Emerald Ape #042 mudou de 1.19 para 1.29 ETH')
    await expect(page.getByTestId('live-polite')).toHaveText('O preço de Emerald Ape #042 mudou de 1.19 para 1.29 ETH')
    if (!isMobile) await expect(ape.getByRole('cell', { name: '1.29 ETH' }).first()).toBeVisible()
    await expect(ape.getByTestId('line-total')).toHaveText('1.29 ETH')
    const after = await apiTotal(page)
    expect(after).not.toBe(before)
    await expect(summaryTotal(page)).toHaveText(after)

    // announce() is the single live announcement: the banner itself is not a live region, and the
    // cart shows no toast on top of the banner.
    await expect(priceNotice(page)).not.toHaveAttribute('role')
    await expect(priceNotice(page)).not.toHaveAttribute('aria-live', /polite|assertive/)
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'mudou de' })).toHaveCount(0)

    await priceNotice(page).getByRole('button', { name: 'Dispensar aviso de preços' }).click()
    await expect(priceNotice(page)).toHaveCount(0)
  })

  test('away from the cart, a price change of a cart NFT shows a toast', async ({ page, gotoFresh, mock, isMobile }) => {
    await gotoFresh('/')
    await buy(page, isMobile, 'nft_042')
    await page.getByRole('link', { name: 'Continuar explorando' }).click()
    await expect(page).toHaveURL(/\/#catalogo$/)

    await waitForRealtime(page)
    expect(await mock.emit({ action: 'nft:update', nftId: 'nft_042', price: '1.29' })).toBe(200)

    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'O preço de Emerald Ape #042 mudou de 1.19 para 1.29 ETH' })).toBeVisible()
    // Sonner's own live region speaks the toast, so the app region does not repeat it.
    await expect(page.getByTestId('live-polite')).not.toContainText('mudou de')
  })

  test('the catalog grid card shows the new price without a reload', async ({ page, gotoFresh, mock }) => {
    await gotoFresh('/?q=Emerald')
    const card = page.getByTestId('nft-card').filter({ hasText: 'Emerald Ape #042' })
    await expect(card).toContainText('Preço: 1.19 ETH')

    await waitForRealtime(page)
    expect(await mock.emit({ action: 'nft:update', nftId: 'nft_042', price: '1.29' })).toBe(200)

    await expect(card).toContainText('Preço: 1.29 ETH')
    await expect(card).toContainText('preço anterior: 1.19 ETH')
    // A guest without the NFT in the cart gets no price notice.
    await expect(page.getByTestId('live-polite')).not.toContainText('mudou de')
  })

  test('stock pushed below the cart quantity marks the line and blocks checkout until it is adjusted', async ({
    page,
    gotoFresh,
    mock,
    isMobile,
  }) => {
    await gotoFresh('/')
    await buy(page, isMobile, 'nft_042', 2)
    const ape = cartLine(page, 'Emerald Ape #042')
    await expect(ape.getByTestId('quantity-value')).toHaveText('2')
    await expect(page.getByRole('link', { name: 'Conectar e finalizar' })).toBeVisible()

    await waitForRealtime(page)
    expect(await mock.emit({ action: 'nft:update', nftId: 'nft_042', editions: 1 })).toBe(200)

    await expect(ape.getByText('Apenas 1 disponível')).toBeVisible()
    const checkout = page.getByRole('button', { name: 'Conectar e finalizar' })
    await expect(checkout).toBeDisabled()
    await expect(checkout).toHaveAccessibleDescription(/Ajuste as quantidades para continuar/)

    await ape.getByRole('button', { name: 'Diminuir quantidade de Emerald Ape #042' }).click()
    await expect(ape.getByTestId('quantity-value')).toHaveText('1')
    await expect(page.getByRole('link', { name: 'Conectar e finalizar' })).toBeVisible()
  })
})
