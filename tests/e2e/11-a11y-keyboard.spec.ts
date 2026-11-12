import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { expect, test, waitForApiIdle, waitForMocks } from './fixtures'
import { connectDialog, reviewDialog, sendButton } from './checkout-helpers'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/**
 * The focused element shows a focus indicator: an outline or a box-shadow ring on the element itself,
 * or on its ::before/::after (the catalog card link draws its ring on the stretched ::after).
 * Runs as a string script: the e2e tsconfig has no DOM types.
 */
const FOCUS_INDICATOR = `(() => {
  const el = document.activeElement
  if (!el || el === document.body) return { tag: 'body', visible: true }
  const ring = (style) =>
    (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
    (style.boxShadow !== 'none' && style.boxShadow !== '')
  const visible = [null, '::before', '::after'].some((pseudo) => ring(getComputedStyle(el, pseudo)))
  const name = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || el.id || ''
  return { tag: el.tagName.toLowerCase() + (name ? ' "' + name + '"' : ''), visible }
})()`

async function expectFocusVisible(page: Page) {
  // Rings fade in with a short transition; poll until the computed style settles.
  await expect
    .poll(async () => {
      const { tag, visible } = await page.evaluate<{ tag: string; visible: boolean }>(FOCUS_INDICATOR)
      return visible ? 'visible' : `no focus indicator on ${tag}`
    })
    .toBe('visible')
}

/** True when the focused element is (one of) the target element(s). */
const isFocused = (target: Locator) =>
  target.evaluateAll((els) => els.some((el) => el === el.ownerDocument.activeElement))

/** Presses Tab (or Shift+Tab) until `target` has the focus, checking the focus indicator at every stop. */
async function tabTo(page: Page, target: Locator, { max = 60, back = false } = {}) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab')
    await expectFocusVisible(page)
    if (await isFocused(target)) return
  }
  throw new Error(`Focus never reached the target after ${max} presses`)
}

/** Tabs `presses` times forward and back, asserting the focus never leaves `container`. */
async function expectFocusTrapped(page: Page, container: Locator, presses = 25) {
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < presses; i++) {
      await page.keyboard.press(key)
      expect(await container.evaluate((el) => el.contains(el.ownerDocument.activeElement))).toBe(true)
    }
  }
}

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  const summary = violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
  }))
  expect(summary).toEqual([])
}

test.describe('keyboard', () => {
  test.describe.configure({ timeout: 90_000 })

  test('keyboard-only purchase path from Início to the review dialog, with a visible focus at every stop', async ({
    page,
    gotoFresh,
    isMobile,
  }) => {
    await gotoFresh('/')
    await waitForApiIdle(page)

    // Search with the keyboard, then open the card.
    const search = page.locator('#catalogo-busca')
    await tabTo(page, search)
    await page.keyboard.type('Emerald')
    await expect(page).toHaveURL(/q=Emerald/)
    await waitForApiIdle(page)
    const card = page.getByTestId('nft-card').filter({ hasText: 'Emerald Ape #042' })
    await tabTo(page, card.getByRole('link', { name: 'Emerald Ape #042', exact: true }))
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nft\/nft_042$/)
    await waitForApiIdle(page)

    // Edition radio group: arrow keys move the selection and skip the sold-out 1/1.
    const editions = page.getByRole('radiogroup', { name: 'Edição:' })
    const checked = editions.getByRole('radio', { checked: true })
    await tabTo(page, checked)
    const before = await checked.textContent()
    await page.keyboard.press('ArrowRight')
    await expect(checked).not.toHaveText(before!)
    await expect(checked).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(checked).toHaveText(before!)

    // COMPRAR (desktop) / "Comprar NFT" (mobile bar) with Space.
    await tabTo(page, page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }))
    await page.keyboard.press('Space')
    await expect(page).toHaveURL('/carrinho')
    await waitForApiIdle(page)

    await tabTo(page, page.getByRole('link', { name: 'Conectar e finalizar' }).locator('visible=true'))
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/)
    await waitForMocks(page)

    // Login: the dialog (desktop) focuses the first field; the mobile page is tabbed into.
    const form = page.getByRole('form', { name: 'Entrar' })
    const email = form.getByRole('textbox', { name: /^E-mail/ })
    if (!(await isFocused(email))) await tabTo(page, email)
    await expectFocusVisible(page)
    await page.keyboard.type('ana@kurio.dev')
    await tabTo(page, form.getByLabel(/^Senha/))
    await page.keyboard.type('Kurio@2026')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/pagamento')
    await expect(page.getByTestId('checkout-total')).toHaveText(/ETH$/)
    await waitForApiIdle(page)

    // "Carteira e rede": native radios, arrows change the checked connector.
    const connectors = page.getByRole('radiogroup', { name: 'Carteira e rede' })
    // A native radio group is one tab stop: the checked radio (or the first one when none is checked).
    await tabTo(page, connectors.getByRole('radio'))
    const focusedValue = () => page.evaluate<string | null>('document.activeElement.value')
    const firstChecked = await focusedValue()
    await page.keyboard.press('ArrowDown')
    await expect.poll(focusedValue).not.toBe(firstChecked)
    await expect(connectors.getByRole('radio', { checked: true })).toHaveAttribute('value', (await focusedValue())!)
    await expectFocusVisible(page)

    await tabTo(page, page.getByRole('button', { name: 'Confirmar compra' }))
    await page.keyboard.press('Enter')
    await expect(connectDialog(page).or(reviewDialog(page))).toBeVisible()
    await expect(reviewDialog(page)).toBeVisible()
    // The dialog holds the focus, and its send button is reachable by keyboard.
    await expect.poll(() => reviewDialog(page).evaluate((el) => el.contains(el.ownerDocument.activeElement))).toBe(true)
    await tabTo(page, sendButton(page))
  })

  test('the login dialog traps the focus and gives it back to the header link on close', async ({
    page,
    gotoFresh,
    isMobile,
  }) => {
    test.skip(isMobile, 'Below 768px /entrar is a full page, not a dialog (Figma).')
    await gotoFresh('/')
    await waitForApiIdle(page)
    const entrar = page.getByRole('banner').getByRole('link', { name: 'Entrar' })
    await tabTo(page, entrar)
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Entrar' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: /^E-mail/ })).toBeFocused()
    await expectFocusTrapped(page, dialog)

    // The close button shows its ring on keyboard focus.
    await tabTo(page, dialog.getByRole('button', { name: 'Fechar' }))
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page).toHaveURL('/')
    await expect(entrar).toBeFocused()
  })

  test('the mobile filter sheet traps the focus and gives it back on close', async ({ page, gotoFresh, isMobile }) => {
    test.skip(!isMobile, 'The filter sheet exists below 1024px; desktop has the sidebar.')
    await gotoFresh('/')
    await waitForApiIdle(page)
    const trigger = page.getByRole('button', { name: 'Filtros' })
    await tabTo(page, trigger)
    await page.keyboard.press('Enter')
    const sheet = page.getByRole('dialog', { name: 'Filtros' })
    await expect(sheet).toBeVisible()
    await expect.poll(() => sheet.evaluate((el) => el.contains(el.ownerDocument.activeElement))).toBe(true)
    await expectFocusTrapped(page, sheet, 40)
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('submitting the registration with errors focuses the first invalid field, with linked messages', async ({
    page,
    gotoFresh,
  }) => {
    await gotoFresh('/cadastro')
    const form = page.getByRole('form', { name: 'Criar conta' })
    await form.getByRole('textbox', { name: /^E-mail/ }).fill('nao-e-email')
    await form.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()

    const username = form.getByRole('textbox', { name: /^Nome de usuário/ })
    await expect(username).toBeFocused()
    for (const field of [username, form.getByRole('textbox', { name: /^E-mail/ }), form.getByLabel(/^Senha/)]) {
      await expect(field).toHaveAttribute('aria-invalid', 'true')
      const describedBy = await field.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
      const message = page.locator(`[id="${describedBy}"]`)
      await expect(message).toBeVisible()
      await expect(message).not.toBeEmpty()
      await expect(field).toHaveAccessibleDescription((await message.textContent())!.trim())
    }
  })
})

test.describe('navigation semantics', () => {
  test('the account menu items are real links, opened from the keyboard', async ({ page, gotoFresh, login, isMobile }) => {
    test.skip(isMobile, 'Same menu on both projects; one run covers it.')
    await gotoFresh('/')
    await login('ana')
    const trigger = page.getByRole('button', { name: 'Menu de Ana Souza' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    for (const [name, href] of [
      ['Perfil', '/perfil'],
      ['Carteiras', '/perfil/carteiras'],
      ['Lista de interesse', '/perfil/favoritos'],
    ]) {
      await expect(menu.getByRole('menuitem', { name })).toHaveAttribute('href', href)
    }
    // Opened from the keyboard, the menu focuses its first item.
    await expect(menu.getByRole('menuitem', { name: 'Perfil' })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem', { name: 'Carteiras' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/perfil/carteiras')
  })

  test('the mobile tab bar marks the active tab with more than color', async ({ page, gotoFresh, isMobile }) => {
    test.skip(!isMobile, 'The tab bar exists below 1024px.')
    await gotoFresh('/carrinho')
    const bar = page.getByRole('navigation', { name: 'Navegação móvel' })
    const marker = (name: string) =>
      bar.getByRole('link', { name, exact: true }).evaluate((el) => el.ownerDocument.defaultView!.getComputedStyle(el, '::after').content)
    await expect(bar.getByRole('link', { name: 'Carrinho', exact: true })).toHaveAttribute('aria-current', 'page')
    expect(await marker('Carrinho')).not.toBe('none')
    expect(await marker('Início')).toBe('none')
    expect(await marker('Favoritos')).toBe('none')
  })
})

test.describe('axe (WCAG 2.1 A/AA)', () => {
  test.describe.configure({ timeout: 90_000 })

  for (const path of ['/', '/nft/nft_042', '/carrinho', '/entrar', '/em-breve']) {
    test(`${path} has no violations`, async ({ page, gotoFresh }) => {
      await gotoFresh(path)
      await waitForApiIdle(page)
      await expectNoAxeViolations(page)
    })
  }

  test('/carrinho with items has no violations', async ({ page, gotoFresh, isMobile }) => {
    await gotoFresh('/nft/nft_042')
    await page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
    await expect(page).toHaveURL('/carrinho')
    await waitForApiIdle(page)
    await expectNoAxeViolations(page)
  })

  for (const path of ['/pagamento', '/perfil', '/perfil/carteiras', '/perfil/favoritos']) {
    test(`${path} (signed in) has no violations`, async ({ page, gotoFresh, login }) => {
      await gotoFresh('/')
      await login('ana')
      await page.goto(path)
      await waitForApiIdle(page)
      await expectNoAxeViolations(page)
    })
  }

  test('the review dialog and a confirmed /pedidos/$id receipt have no violations', async ({ page, gotoFresh, login }) => {
    await gotoFresh('/')
    await login('ana')
    await page.goto('/pagamento')
    await expect(page.getByTestId('checkout-total')).toHaveText(/ETH$/)
    await page.getByRole('radiogroup', { name: 'Carteira e rede' }).getByRole('radio', { name: 'MetaMask' }).check()
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(reviewDialog(page)).toBeVisible()
    // The review dialog itself (over /pagamento) is scanned too.
    await expectNoAxeViolations(page)
    await sendButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_[0-9a-f]+$/)
    await expect(page.getByRole('region', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    await waitForApiIdle(page)
    await expectNoAxeViolations(page)
  })
})

test.describe('zoom', () => {
  // A 720px-wide window rendered at 2x, then CSS zoom 200%: the layout gets 360 CSS px (WCAG 1.4.10 reflow).
  test.use({ viewport: { width: 720, height: 900 }, deviceScaleFactor: 2, isMobile: false, hasTouch: false })

  test('/pagamento (and the other main pages) at 200% zoom have no horizontal scroll', async ({ page, gotoFresh, login }) => {
    await gotoFresh('/')
    await login('ana')
    for (const path of ['/pagamento', '/', '/nft/nft_042', '/carrinho', '/perfil']) {
      await page.goto(path)
      await waitForApiIdle(page)
      await page.evaluate(`document.documentElement.style.zoom = '200%'`)
      const scroll = await page.evaluate<{ scrollX: number; scrollWidth: number; clientWidth: number }>(`(() => {
        window.scrollTo(10000, 0)
        const root = document.documentElement
        return { scrollX: window.scrollX, scrollWidth: root.scrollWidth, clientWidth: root.clientWidth }
      })()`)
      expect(scroll.scrollX, path).toBe(0)
      expect(scroll.scrollWidth, path).toBeLessThanOrEqual(scroll.clientWidth)
    }
  })
})
