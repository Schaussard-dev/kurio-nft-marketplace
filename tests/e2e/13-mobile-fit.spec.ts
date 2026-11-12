import type { Locator, Page } from '@playwright/test'
import { expect, test, waitForApiIdle } from './fixtures'

/**
 * Phone widths from the smallest supported (320) to the Figma frame (414): nothing a person must read or
 * tap may leave the screen or be cut, and the hero follows the finger (mobile QA round 2).
 */
const WIDTHS = [320, 360, 390, 414]

test.describe('mobile fit', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'phone layouts only')
  })

  async function expectWithinViewport(page: Page, locator: Locator, what: string) {
    const width = page.viewportSize()!.width
    for (const box of await Promise.all((await locator.all()).map((item) => item.boundingBox()))) {
      expect(box, what).not.toBeNull()
      expect(box!.x, `${what} at ${width}px: left edge`).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width, `${what} at ${width}px: right edge`).toBeLessThanOrEqual(width)
    }
  }

  const documentOverflow = (page: Page) =>
    page.evaluate<number>('document.documentElement.scrollWidth - document.documentElement.clientWidth')

  /** Every tab label is fully visible: the tab list does not need to scroll. */
  const tabListOverflow = (list: Locator) => list.evaluate((el) => el.scrollWidth - el.clientWidth)

  test('filter sheet actions stay on screen with an active filter', async ({ page, gotoFresh }) => {
    await gotoFresh('/')
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 760 })
      await page.getByRole('button', { name: 'Filtros' }).click()
      const sheet = page.getByRole('dialog', { name: 'Filtros' })
      const fotografia = sheet.getByRole('checkbox', { name: /Fotografia/ })
      if (!(await fotografia.isChecked())) await fotografia.click()
      await expect(sheet.getByRole('button', { name: 'Limpar filtros' })).toBeVisible()
      await expectWithinViewport(page, sheet.getByRole('button', { name: /^(Limpar filtros|Ver resultados)/ }), 'filter actions')
      await page.keyboard.press('Escape')
    }
  })

  test('catalog tabs and card names are fully visible', async ({ page, gotoFresh }) => {
    await gotoFresh('/')
    await waitForApiIdle(page)
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 760 })
      expect(await tabListOverflow(page.getByRole('tablist', { name: 'Seleção do catálogo' })), `tabs at ${width}px`).toBeLessThanOrEqual(0)
      // A name may wrap (two lines) but is never cut with an ellipsis.
      const cut = await page
        .getByTestId('nft-card')
        .getByRole('heading')
        .evaluateAll((headings) => headings.filter((h) => h.scrollWidth > h.clientWidth + 1).map((h) => h.textContent))
      expect(cut, `card names at ${width}px`).toEqual([])
    }
  })

  test('the hero follows a swipe and its dots are tall touch targets', async ({ page, gotoFresh }) => {
    await gotoFresh('/')
    const hero = page.getByRole('region', { name: 'Destaques' })
    const dots = hero.getByRole('button', { name: /^Slide \d de 3$/ })
    for (const dot of await dots.all()) {
      const box = (await dot.boundingBox())!
      // 44px tall at the Figma spacing; wider than the 24px minimum (WCAG 2.5.8).
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.width).toBeGreaterThanOrEqual(24)
    }
    await expect(hero.getByRole('button', { name: 'Slide 1 de 3' })).toHaveAttribute('aria-current', 'true')

    // A finger drag right-to-left over the first slide (raw touch events, like a phone sends them).
    const box = (await hero.getByRole('group', { name: '1 de 3' }).boundingBox())!
    const y = Math.round(box.y + box.height / 2)
    const startX = Math.round(box.x + box.width * 0.8)
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, at = y) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: at }] })
    await touch('touchStart', startX)
    for (let step = 1; step <= 20; step++) await touch('touchMove', startX - step * Math.round(box.width / 30))
    await touch('touchEnd')
    // Headless Chromium closes the scroll gesture (and runs the snap) on the next input: tap the slide text.
    const text = (await hero.getByRole('group', { name: '2 de 3' }).getByRole('heading').boundingBox())!
    await touch('touchStart', Math.round(text.x + 4), Math.round(text.y + 4))
    await touch('touchEnd')
    await expect(hero.getByRole('button', { name: 'Slide 2 de 3' })).toHaveAttribute('aria-current', 'true')
    await expect(hero.getByRole('group', { name: '2 de 3' })).toBeInViewport({ ratio: 0.9 })

    // The dots still drive it.
    await hero.getByRole('button', { name: 'Slide 3 de 3' }).click()
    await expect(hero.getByRole('group', { name: '3 de 3' })).toBeInViewport({ ratio: 0.9 })
  })

  test('detail tabs fit and "Mais desta coleção" starts on the page gutter', async ({ page, gotoFresh }) => {
    await gotoFresh('/nft/nft_042')
    await waitForApiIdle(page)
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 760 })
      expect(await tabListOverflow(page.getByRole('tablist', { name: 'Informações do NFT' })), `tabs at ${width}px`).toBeLessThanOrEqual(0)
    }
    // The accessible names keep the full Figma labels.
    await expect(page.getByRole('tab', { name: 'Detalhes do NFT' })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Avaliações de colecionadores \(19\)/ })).toBeVisible()

    const section = page.getByRole('region', { name: 'Mais desta coleção' })
    await section.scrollIntoViewIfNeeded()
    const heading = (await section.getByRole('heading', { name: 'Mais desta coleção' }).boundingBox())!
    const firstCard = (await section.getByTestId('nft-card').first().boundingBox())!
    expect(Math.abs(firstCard.x - heading.x), 'first card aligned with the heading').toBeLessThanOrEqual(1)
  })

  test('cart summary rows stay on screen with a coupon discount', async ({ page, gotoFresh, login }) => {
    await gotoFresh('/')
    await login('ana')
    await page.goto('/carrinho?cupom=KURIO10')
    await expect(page.getByTestId('summary-discount')).toHaveText(/ETH$/)
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 760 })
      expect(await documentOverflow(page), `page overflow at ${width}px`).toBeLessThanOrEqual(0)
      await expectWithinViewport(page, page.locator('[data-testid^="summary-"]'), 'summary values')
    }
  })
})
