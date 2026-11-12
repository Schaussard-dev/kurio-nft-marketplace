import type { Locator, Page } from '@playwright/test'
import { expect, test, waitForApiIdle } from './fixtures'
import { confirmButton, openCheckout, reviewDialog, sendButton } from './checkout-helpers'

/**
 * Responsive checks found by the final sweep: dialogs taller than the screen, toasts over fixed bars,
 * short viewports (400% zoom, landscape phones) and the 1024–1279 desktop variant.
 * Each test sets its own viewport, so it runs once (desktop project).
 */

const box = async (locator: Locator) => (await locator.boundingBox())!

/** Adds one unit of the first edition with stock of `nftId` to the signed-in user's cart through the API. */
async function addToCart(page: Page, nftId: string, quantity = 1) {
  await page.evaluate(
    async ({ nftId, quantity }) => {
      const token = JSON.parse(localStorage.getItem('kurio-session')!).token as string
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      const nft = (await (await fetch(`/api/nfts/${nftId}`)).json()) as { editions: { id: string; available: number }[] }
      const edition = nft.editions.find((e) => e.available > 0)!
      await fetch('/api/cart/items', { method: 'POST', headers, body: JSON.stringify({ nftId, editionId: edition.id, quantity }) })
    },
    { nftId, quantity },
  )
}

test.describe('responsive (final sweep)', () => {
  test.skip(({ isMobile }) => isMobile, 'viewports are set per test')

  test('the order review fits short landscape screens: its actions can always be reached (RS-01)', async ({
    page,
    gotoFresh,
    login,
  }) => {
    await gotoFresh('/')
    await login('ana')
    await addToCart(page, 'nft_071')
    for (const viewport of [
      { width: 844, height: 390 },
      { width: 568, height: 320 },
    ]) {
      await page.setViewportSize(viewport)
      await openCheckout(page)
      await page.getByRole('radiogroup', { name: 'Carteira e rede' }).getByRole('radio', { name: 'MetaMask' }).check()
      await confirmButton(page).click()
      await expect(reviewDialog(page)).toBeVisible()
      for (const action of [sendButton(page), reviewDialog(page).getByRole('button', { name: 'Voltar' })]) {
        await action.scrollIntoViewIfNeeded()
        const b = await box(action)
        expect(b.y, `${viewport.width}x${viewport.height}`).toBeGreaterThanOrEqual(0)
        expect(b.y + b.height).toBeLessThanOrEqual(viewport.height)
      }
      const title = await box(reviewDialog(page).getByRole('heading', { name: 'Revise seu pedido' }))
      await reviewDialog(page).evaluate((el) => el.scrollTo(0, 0))
      expect((await box(reviewDialog(page))).y).toBeGreaterThanOrEqual(0)
      expect(title.height).toBeGreaterThan(0)
      await reviewDialog(page).getByRole('button', { name: 'Voltar' }).click()
      await expect(reviewDialog(page)).toBeHidden()
    }
  })

  test('the order review keeps every amount inside the dialog on a 360px phone (RS-02)', async ({ page, gotoFresh, login }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await gotoFresh('/')
    await login('ana')
    await addToCart(page, 'nft_071')
    await openCheckout(page)
    await page.getByRole('radiogroup', { name: 'Carteira e rede' }).getByRole('radio', { name: 'MetaMask' }).check()
    await confirmButton(page).click()
    await expect(reviewDialog(page)).toBeVisible()
    const overflow = await reviewDialog(page).evaluate((dialog) => {
      const right = dialog.getBoundingClientRect().right
      return Math.max(0, ...[...dialog.querySelectorAll('*')].map((el) => el.getBoundingClientRect().right - right))
    })
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('a toast never covers the phone buy bar (RS-03)', async ({ page, gotoFresh }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoFresh('/nft/nft_042')
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    const toast = page.locator('[data-sonner-toast]').first()
    await expect(toast).toBeVisible()
    const t = await box(toast)
    const bar = await box(page.locator('[data-bottom-bar]'))
    expect(t.y + t.height <= bar.y || t.y >= bar.y + bar.height).toBe(true)
  })

  test('at 400% zoom (320x180) the detail and the filter sheet stay usable (RS-05)', async ({ page, gotoFresh }) => {
    await page.setViewportSize({ width: 320, height: 180 })
    await gotoFresh('/nft/nft_042')
    const edition = page.getByRole('radiogroup', { name: /Edição/ }).getByRole('radio', { name: /^1\/50/ })
    await edition.click()
    await expect(edition).toHaveAttribute('aria-checked', 'true')
    await page.goto('/')
    await waitForApiIdle(page)
    await page.getByRole('button', { name: /^Filtros/ }).click()
    const results = page.getByRole('dialog', { name: 'Filtros' }).getByRole('button', { name: /Ver resultados/ })
    await results.click()
    await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeHidden()
  })

  test('at 1024px the catalog toolbar, hero dots, detail image and checkout form fit (RS-04, RS-11, RS-12, FG-02)', async ({
    page,
    gotoFresh,
    login,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await gotoFresh('/')
    await waitForApiIdle(page)
    const tabs = page.getByRole('tablist', { name: 'Seleção do catálogo' })
    expect(await tabs.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
    const sortLabel = page.getByText('Ordenar por:', { exact: true })
    expect((await box(sortLabel)).height).toBeLessThanOrEqual(24)
    const dot = await box(page.getByRole('button', { name: 'Slide 1 de 3' }).filter({ visible: true }))
    const art = await box(page.getByRole('region', { name: 'Destaques' }).getByRole('img').filter({ visible: true }).first())
    expect(dot.x + dot.width <= art.x || dot.y >= art.y + art.height).toBe(true)

    await page.goto('/nft/nft_042')
    const card = await box(page.getByTestId('gallery-main'))
    expect(Math.abs(card.height - card.width)).toBeLessThanOrEqual(4)

    await login('ana')
    await openCheckout(page)
    const ens = page.getByRole('form', { name: 'Pagamento' }).getByRole('textbox', { name: /^Nome ENS/ })
    await expect(ens).toHaveValue(/.+/)
    expect(await ens.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
  })

  test('at 1024px the cart table keeps a large price clear of the next column (RS-13)', async ({ page, gotoFresh, login }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await gotoFresh('/')
    await login('ana')
    await page.evaluate(() =>
      fetch('/api/__mock/emit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'nft:update', nftId: 'nft_009', price: '1234.56789' }),
      }),
    )
    await page.goto('/carrinho')
    const row = page.getByTestId('cart-line').first()
    await expect(row).toContainText('1234.56789')
    // Every cell's content stays inside its own cell: nothing is drawn over the next column.
    const spill = await row.locator('td').evaluateAll((tds) =>
      tds.map((td) => {
        const cell = td.getBoundingClientRect()
        return Math.max(0, ...[...td.querySelectorAll('*')].map((el) => el.getBoundingClientRect().right - cell.right))
      }),
    )
    expect(Math.max(...spill)).toBeLessThanOrEqual(1)
  })

  test('on a 414px phone the NFT detail shows the editions above the buy bar on first paint (FG-01)', async ({ page, gotoFresh }) => {
    await page.setViewportSize({ width: 414, height: 896 })
    await gotoFresh('/nft/nft_042')
    const editions = await box(page.getByRole('radiogroup', { name: /Edição/ }))
    const bar = await box(page.locator('[data-bottom-bar]'))
    expect(editions.y + editions.height).toBeLessThanOrEqual(bar.y)
  })

  test('on a 320px phone the card names keep the token number visible (RS-09)', async ({ page, gotoFresh }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await gotoFresh('/?q=Golden')
    await waitForApiIdle(page)
    const clipped = await page
      .getByTestId('nft-card')
      .getByRole('heading')
      .evaluateAll((hs) => hs.filter((h) => h.scrollHeight > h.clientHeight + 1).map((h) => h.textContent))
    expect(clipped).toEqual([])
  })
})
