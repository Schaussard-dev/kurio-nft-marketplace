import type { Page } from '@playwright/test'
import { expect, test, waitForApiIdle } from '../e2e/fixtures'

/**
 * Visual regression of the four Figma screens (Início, Detalhe, Carrinho, Pagamento) in every viewport
 * project (desktop 1440, mobile 390, tablet 768). Baselines are versioned per platform (win32 + linux).
 * Determinism: fresh `default` seed, zero mock latency, fixed locale/timezone, fonts and every image
 * loaded, animations disabled; the floating mock panel trigger is masked.
 */

test.use({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
test.describe.configure({ timeout: 90_000 })

/** The three Figma cart lines: Emerald ×2, Violet ×6, Ivory ×9 (ABERTA edition: the default 1/1 holds one unit). */
const FIGMA_CART = [
  { nftId: 'nft_042', edition: 'nft_042_e4', quantity: 2 },
  { nftId: 'nft_314', edition: 'nft_314_e4', quantity: 6 },
  { nftId: 'nft_088', edition: 'nft_088_e4', quantity: 9 },
] as const

/**
 * Scrolls through the page so lazy images load, then waits until every image is decoded and fonts are ready.
 * String scripts: the e2e tsconfig has no DOM types.
 */
const LOAD_LAZY_CONTENT = `(async () => {
  const step = Math.max(200, Math.floor(window.innerHeight * 0.8))
  for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
    window.scrollTo(0, y)
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  window.scrollTo(0, 0)
})()`
// Only rendered images: a lazy image under display:none (e.g. the inactive desktop hero slides) never loads
// and never shows in the screenshot.
const IMAGES_LOADED = `Array.from(document.images)
  .filter((image) => image.getClientRects().length > 0)
  .every((image) => image.complete && image.naturalWidth > 0)`
const FONTS_AND_IMAGES_DECODED = `(async () => {
  await document.fonts.ready
  const rendered = Array.from(document.images).filter((image) => image.getClientRects().length > 0)
  await Promise.all(rendered.map((image) => image.decode().catch(() => undefined)))
})()`

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await waitForApiIdle(page, { quietMs: 500 })
  await page.evaluate(LOAD_LAZY_CONTENT)
  await page.waitForFunction(IMAGES_LOADED)
  await page.evaluate(FONTS_AND_IMAGES_DECODED)
  await page.waitForLoadState('networkidle')
  // No transient notification may end up in the capture.
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 10_000 })
}

async function snapshot(page: Page, name: string) {
  await settle(page)
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
    mask: [page.getByRole('button', { name: 'Simulação' })],
  })
}

test.describe('visual regression', () => {
  test.beforeEach(async ({ gotoFresh, mock }) => {
    await gotoFresh('/')
    await mock.scenario('default', { latencyOverride: 0 })
  })

  test('Início', async ({ page }) => {
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await snapshot(page, 'home')
  })

  test('Detalhe', async ({ page }) => {
    await page.goto('/nft/nft_042')
    await expect(page.getByRole('heading', { level: 1, name: /Emerald Ape/ })).toBeVisible()
    await snapshot(page, 'detail')
  })

  test('Carrinho', async ({ page }) => {
    for (const { nftId, edition, quantity } of FIGMA_CART) {
      await page.goto(`/nft/${nftId}?edition=${edition}`)
      const stepper = page.getByRole('group', { name: 'Quantidade' })
      const increase = stepper.getByRole('button', { name: 'Aumentar quantidade' })
      for (let i = 1; i < quantity; i++) await increase.click()
      await expect(stepper.getByTestId('quantity-value')).toHaveText(String(quantity))
      // Desktop shows COMPRAR next to the price; narrow layouts show the bottom "Comprar NFT" bar.
      await page.getByRole('button', { name: /^(COMPRAR|Comprar NFT)$/ }).filter({ visible: true }).click()
      await expect(page).toHaveURL('/carrinho')
    }
    await expect(page.getByTestId('cart-line')).toHaveCount(FIGMA_CART.length)
    await snapshot(page, 'cart')
  })

  test('Pagamento', async ({ page, login }) => {
    await login('ana')
    await page.goto('/pagamento')
    await expect(page.getByRole('form', { name: 'Pagamento' })).toBeVisible()
    await expect(page.getByTestId('socket-status')).toHaveAttribute('data-status', 'connected')
    await snapshot(page, 'payment')
  })
})
