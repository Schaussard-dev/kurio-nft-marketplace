import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/** The page load event can fire before the MSW worker takes control of the page. */
async function waitForMocks(page: Page) {
  await page.waitForFunction('navigator.serviceWorker.controller !== null')
}

test.describe('app shell', () => {
  test('shows the desktop header nav or the mobile tab bar', async ({ page, isMobile }) => {
    await page.goto('/')
    await waitForMocks(page)
    const mainNav = page.getByRole('navigation', { name: 'Principal' })
    const tabBar = page.getByRole('navigation', { name: 'Navegação móvel' })
    if (isMobile) {
      await expect(tabBar).toBeVisible()
      for (const name of ['Início', 'Favoritos', 'Escanear', 'Carrinho', 'Perfil']) {
        await expect(tabBar.getByRole('link', { name })).toBeVisible()
      }
      await expect(mainNav).toBeHidden()
    } else {
      for (const name of ['Início', 'Mercado', 'Criadores', 'Aprenda']) {
        await expect(mainNav.getByRole('link', { name })).toBeVisible()
      }
      await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
      await expect(tabBar).toBeHidden()
    }
  })

  test('em-breve shows the section name', async ({ page }) => {
    await page.goto('/em-breve?secao=criadores')
    await expect(page.getByRole('heading', { name: 'Em breve' })).toBeVisible()
    await expect(page.getByRole('main')).toContainText('Criadores')
  })

  test('newsletter submit reports it is unavailable', async ({ page }) => {
    await page.goto('/')
    const form = page.getByRole('contentinfo').locator('form')
    await form.getByLabel('E-mail').fill('ana@kurio.dev')
    await form.getByRole('button', { name: 'Enviar' }).click()
    await expect(form.getByRole('status')).toContainText('indisponível')
  })

  test('unknown route renders the 404 page', async ({ page }) => {
    await page.goto('/nao-existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao início' }).click()
    await expect(page).toHaveURL('/')
  })

  test('private routes redirect guests to /entrar', async ({ page }) => {
    await page.goto('/perfil')
    await expect(page).toHaveURL('/entrar?redirect=%2Fperfil')
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  })

  test('first Tab stop is the skip link and it targets main', async ({ page }) => {
    await page.goto('/')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeAttached()
    await page.keyboard.press('Tab')
    await expect(skip).toBeFocused()
    await skip.press('Enter')
    await expect(page.locator('main#conteudo')).toBeVisible()
  })

  test('has no horizontal overflow at 390, 768 and 1440', async ({ page, login }) => {
    // 3 widths x 6 pages, each a full load with the mock worker booting.
    test.setTimeout(90_000)
    const measure = async (paths: string[]) => {
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        for (const path of paths) {
          await page.goto(path)
          // Full loads (worker boot + session check) can exceed 5 s when the whole suite runs in parallel.
          await expect(page.locator('main#conteudo h1')).toBeVisible({ timeout: 10_000 })
          const overflow = await page.evaluate<number>('document.documentElement.scrollWidth - window.innerWidth')
          expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0)
        }
      }
    }
    await measure(['/', '/em-breve', '/carrinho', '/entrar', '/cadastro'])
    // A real session so the guarded profile route renders instead of redirecting.
    await login('ana')
    await measure(['/perfil'])
  })

  test('mock panel applies a scenario through reset', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop project only')
    await page.goto('/')
    await waitForMocks(page)
    await page.getByRole('button', { name: 'Simulação' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    const resetRequest = page.waitForRequest(
      (r) => r.url().endsWith('/api/__mock/reset') && r.method() === 'POST',
    )
    // Marker on the current document: a full reload drops it.
    await page.evaluate('window.__beforeReseed = true')
    await page.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Catálogo vazio' }).click()
    const request = await resetRequest
    expect(request.postDataJSON()).toEqual({ scenario: 'empty' })

    // A reseed reloads the page (no stale cache, realtime versions or socket room survive); the panel
    // reopens with the confirmation and the applied scenario.
    await expect(page.getByText('Cenário aplicado')).toBeVisible()
    expect(await page.evaluate('window.__beforeReseed')).toBeUndefined()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('combobox')).toContainText('Catálogo vazio')
    await waitForMocks(page)

    // Wallet disconnect is handled by the mock (emits wallet.disconnected to the connected users).
    await page.getByRole('button', { name: 'Desconectar carteira' }).click()
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: /^Carteira desconectada$/ })).toBeVisible()
    await expect(page.getByText('Ação ainda não disponível')).toHaveCount(0)
  })
})
