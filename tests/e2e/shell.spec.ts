import { expect, test, type Page } from '@playwright/test'

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

  test('has no horizontal overflow', async ({ page }) => {
    for (const path of ['/', '/em-breve', '/carrinho']) {
      await page.goto(path)
      const overflow = await page.evaluate<number>('document.documentElement.scrollWidth - window.innerWidth')
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
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
    await page.getByRole('button', { name: 'Reset' }).click()
    await resetRequest
    await page.getByRole('button', { name: 'Desconectar carteira' }).click()
    await expect(page.getByText('Ação ainda não disponível').first()).toBeVisible()
  })
})
