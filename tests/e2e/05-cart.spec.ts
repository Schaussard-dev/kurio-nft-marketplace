import type { Page } from '@playwright/test'
import { DEMO_USERS, expect, test, type DemoUser } from './fixtures'

const GUEST_CART_KEY = 'kurio-guest-cart-id'

const cartLine = (page: Page, name: string) => page.getByTestId('cart-line').filter({ hasText: name })
const lineQuantity = (page: Page, name: string) => cartLine(page, name).getByTestId('quantity-value')
const summary = (page: Page, row: 'subtotal' | 'discount' | 'fee' | 'total') => page.getByTestId(`summary-${row}`)
const couponField = (page: Page) => page.getByRole('textbox', { name: 'Código promocional' })
const cartLink = (page: Page, count: number) =>
  page.getByRole('link', { name: `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` })

/** Detail page → choose quantity → COMPRAR (desktop) / "Comprar NFT" (mobile bar) → lands on /carrinho. */
async function buy(page: Page, isMobile: boolean, nftId: string, { quantity = 1, edition }: { quantity?: number; edition?: string } = {}) {
  await page.goto(`/nft/${nftId}${edition ? `?edition=${edition}` : ''}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const increase = page.getByRole('group', { name: 'Quantidade' }).getByRole('button', { name: 'Aumentar quantidade' })
  for (let i = 1; i < quantity; i++) await increase.click()
  await expect(page.getByRole('group', { name: 'Quantidade' }).getByTestId('quantity-value')).toHaveText(String(quantity))
  await page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
  await expect(page).toHaveURL('/carrinho')
}

async function fillLogin(page: Page, user: DemoUser) {
  const form = page.getByRole('form', { name: 'Entrar' })
  await form.getByRole('textbox', { name: /^E-mail/ }).fill(DEMO_USERS[user].email)
  await form.getByLabel(/^Senha/).fill(DEMO_USERS[user].password)
  await form.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/** The quote the API gives for the current guest cart (fetch inside the page so MSW answers). */
async function apiQuote(page: Page, coupon?: string): Promise<{ total: string; discount: string }> {
  return page.evaluate(
    async ({ key, coupon }) => {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Cart-Id': localStorage.getItem(key) ?? '' },
        body: JSON.stringify({ coupon, network: 'ethereum' }),
      })
      return (await res.json()) as { total: string; discount: string }
    },
    { key: GUEST_CART_KEY, coupon },
  )
}

test.describe('cart', () => {
  // Several full page loads per test (detail → cart, login): generous budget under parallel load.
  test.describe.configure({ timeout: 60_000 })

  test('a guest adds NFTs from the detail page; lines and the API summary survive a reload', async ({
    page,
    gotoFresh,
    isMobile,
  }) => {
    await gotoFresh('/')
    await buy(page, isMobile, 'nft_042', { quantity: 2 })
    await buy(page, isMobile, 'nft_314')

    await expect(page.getByTestId('cart-line')).toHaveCount(2)
    await expect(lineQuantity(page, 'Emerald Ape #042')).toHaveText('2')
    await expect(cartLine(page, 'Emerald Ape #042').getByTestId('line-total')).toHaveText('2.38 ETH')
    await expect(lineQuantity(page, 'Violet Nomad #314')).toHaveText('1')
    await expect(summary(page, 'subtotal')).toHaveText('3.77 ETH')
    await expect(summary(page, 'discount')).toHaveText('(-) 00.00')
    await expect(summary(page, 'fee')).toHaveText('0.016 ETH')
    await expect(summary(page, 'total')).toHaveText('3.786 ETH')
    await expect(cartLink(page, 3)).toBeVisible()

    await page.reload()
    await expect(page.getByTestId('cart-line')).toHaveCount(2)
    await expect(lineQuantity(page, 'Emerald Ape #042')).toHaveText('2')
    await expect(summary(page, 'total')).toHaveText('3.786 ETH')
    await expect(page.getByRole('heading', { name: 'Colecionadores também viram' })).toBeVisible()
  })

  test('raising a quantity beyond the stock reverts it with "Apenas N disponíveis"', async ({
    page,
    gotoFresh,
    isMobile,
    mock,
  }) => {
    await gotoFresh('/')
    await buy(page, isMobile, 'nft_042', { quantity: 2 })
    await expect(lineQuantity(page, 'Emerald Ape #042')).toHaveText('2')
    await expect(summary(page, 'total')).toHaveText('2.396 ETH')

    // Race: the + is optimistic (shows 3 at once); the stock drops to 2 while the slow PATCH is in
    // flight, so the API refuses it and the line goes back to 2 with the reason.
    await mock.scenario('default', { latencyOverride: 1500 })
    await cartLine(page, 'Emerald Ape #042').getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).click()
    await expect(lineQuantity(page, 'Emerald Ape #042')).toHaveText('3', { timeout: 1000 })
    expect(await mock.emit({ action: 'nft:update', nftId: 'nft_042', editions: [{ id: 'nft_042_e2', available: 2 }] })).toBe(200)

    await expect(cartLine(page, 'Emerald Ape #042').getByText('Apenas 2 disponíveis')).toBeVisible()
    await expect(lineQuantity(page, 'Emerald Ape #042')).toHaveText('2')
    await mock.scenario('default', { latencyOverride: null })
    await expect(summary(page, 'total')).toHaveText('2.396 ETH')
    // The refetched cart now knows the stock: + is disabled at 2.
    await expect(
      cartLine(page, 'Emerald Ape #042').getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  test('removing a line takes it out and announces it', async ({ page, gotoFresh, isMobile }) => {
    await gotoFresh('/')
    await buy(page, isMobile, 'nft_042', { quantity: 2 })
    await buy(page, isMobile, 'nft_314')
    await cartLine(page, 'Emerald Ape #042').getByRole('button', { name: 'Remover Emerald Ape #042 do carrinho' }).click()
    await expect(cartLine(page, 'Emerald Ape #042')).toHaveCount(0)
    await expect(page.getByTestId('live-polite')).toHaveText('Emerald Ape #042 removido do carrinho')
    await expect(summary(page, 'total')).toHaveText('1.406 ETH')

    await cartLine(page, 'Violet Nomad #314').getByRole('button', { name: 'Remover Violet Nomad #314 do carrinho' }).click()
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })

  test('coupons: invalid and expired errors on the field, KURIO10 discount from the API, removal; checkout asks guests to sign in', async ({
    page,
    gotoFresh,
    isMobile,
  }) => {
    await gotoFresh('/')
    await buy(page, isMobile, 'nft_042', { quantity: 2 })
    await buy(page, isMobile, 'nft_314')
    await expect(summary(page, 'total')).toHaveText('3.786 ETH')
    const apply = page.getByRole('button', { name: 'Aplicar' })

    await couponField(page).fill('XYZ')
    await apply.click()
    await expect(couponField(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(couponField(page)).toHaveAccessibleDescription('Cupom inválido')
    await expect(summary(page, 'total')).toHaveText('3.786 ETH')

    await couponField(page).fill('LANCAMENTO24')
    await apply.click()
    await expect(couponField(page)).toHaveAccessibleDescription('Cupom expirado')

    await couponField(page).fill('KURIO10')
    await apply.click()
    await expect(page).toHaveURL('/carrinho?cupom=KURIO10')
    await expect(couponField(page)).not.toHaveAttribute('aria-invalid', 'true')
    const quote = await apiQuote(page, 'KURIO10')
    expect(quote.discount).toBe('0.377')
    await expect(summary(page, 'discount')).toHaveText(`(-) ${quote.discount} ETH`)
    await expect(summary(page, 'total')).toHaveText(`${quote.total} ETH`)

    await page.getByRole('button', { name: 'Remover cupom KURIO10' }).click()
    await expect(page).toHaveURL('/carrinho')
    await expect(summary(page, 'discount')).toHaveText('(-) 00.00')
    await expect(summary(page, 'total')).toHaveText('3.786 ETH')

    // Re-apply and finish: the guard sends the guest to sign in and back to /pagamento with the coupon.
    await couponField(page).fill('KURIO10')
    await apply.click()
    await expect(summary(page, 'discount')).toHaveText('(-) 0.377 ETH')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL('/entrar?redirect=%2Fpagamento%3Fcupom%3DKURIO10')
    await fillLogin(page, 'bruno')
    await expect(page).toHaveURL('/pagamento?cupom=KURIO10')
  })

  test('signing in merges the guest cart into the seeded cart once, and logout leaves an empty guest cart', async ({
    page,
    gotoFresh,
    isMobile,
    login,
  }) => {
    await gotoFresh('/')
    await buy(page, isMobile, 'nft_042', { quantity: 2 })
    await buy(page, isMobile, 'nft_314')
    const guestId = await page.evaluate((key) => localStorage.getItem(key), GUEST_CART_KEY)

    await login('ana')
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-line')).toHaveCount(3)
    await expect(lineQuantity(page, 'Emerald Ape #042')).toHaveText('2')
    await expect(lineQuantity(page, 'Violet Nomad #314')).toHaveText('1')
    await expect(lineQuantity(page, 'Sage Nomad #009')).toHaveText('1')
    await expect(cartLink(page, 4)).toBeVisible()
    expect(await page.evaluate((key) => localStorage.getItem(key), GUEST_CART_KEY)).not.toBe(guestId)

    // No second merge on reload: quantities unchanged.
    await page.reload()
    await expect(lineQuantity(page, 'Emerald Ape #042')).toHaveText('2')
    await expect(page.getByTestId('cart-line')).toHaveCount(3)

    await page.evaluate(() => localStorage.removeItem('kurio-session'))
    await page.goto('/carrinho')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })

  test('merge clamps a guest line to the stock left and the toast lists the adjustment', async ({
    page,
    gotoFresh,
    isMobile,
    login,
    mock,
  }) => {
    await gotoFresh('/')
    await buy(page, isMobile, 'nft_042', { quantity: 10, edition: 'nft_042_e3' })
    await expect(lineQuantity(page, 'Emerald Ape #042')).toHaveText('10')
    expect(await mock.emit({ action: 'nft:update', nftId: 'nft_042', editions: [{ id: 'nft_042_e3', available: 3 }] })).toBe(200)

    await login('ana')
    const toast = page.getByRole('listitem').filter({ hasText: 'Carrinho ajustado ao estoque disponível' })
    await expect(toast).toBeVisible()
    await expect(toast).toContainText('Emerald Ape #042: 10 → 3')

    await page.goto('/carrinho')
    await expect(lineQuantity(page, 'Emerald Ape #042')).toHaveText('3')
    await expect(lineQuantity(page, 'Sage Nomad #009')).toHaveText('1')
  })

  test('the catalog card (desktop) and the mobile cart button add without leaving the page', async ({
    page,
    gotoFresh,
    isMobile,
  }) => {
    if (isMobile) {
      await gotoFresh('/nft/nft_009')
      await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
      await expect(page).toHaveURL('/nft/nft_009')
    } else {
      await gotoFresh('/')
      const card = page.getByTestId('nft-card').filter({ hasText: 'Emerald Ape #042' })
      await card.hover()
      await card.getByRole('button', { name: 'Adicionar Emerald Ape #042 ao carrinho' }).click()
      await expect(page).toHaveURL('/')
      await expect(cartLink(page, 1)).toBeVisible()
    }
    await expect(page.getByText('Adicionado ao carrinho')).toBeVisible()
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
  })
})
