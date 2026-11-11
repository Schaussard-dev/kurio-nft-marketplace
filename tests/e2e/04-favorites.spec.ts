import type { Page, Response } from '@playwright/test'
import { DEMO_USERS, expect, test, type DemoUser } from './fixtures'

const favoriteButton = (page: Page) =>
  page.getByRole('main').getByRole('button', { name: /^(Favoritar|Remover dos favoritos)$/ })
const isFavoritePut = (response: Response) =>
  response.request().method() === 'PUT' && response.url().includes('/api/favorites/')
const ERROR_TOAST = 'Não foi possível atualizar seus favoritos. Tente novamente.'

async function fillLogin(page: Page, user: DemoUser) {
  const form = page.getByRole('form', { name: 'Entrar' })
  await form.getByRole('textbox', { name: /^E-mail/ }).fill(DEMO_USERS[user].email)
  await form.getByLabel(/^Senha/).fill(DEMO_USERS[user].password)
  await form.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/** In-app navigation (keeps the query cache) through the footer "Lista de interesse" link. */
async function openFavorites(page: Page) {
  await page.getByRole('contentinfo').getByRole('link', { name: 'Lista de interesse' }).click()
}

test.describe('favorites', () => {
  test('a guest is sent to login and comes back to the NFT', async ({ page, gotoFresh }) => {
    await gotoFresh('/nft/nft_042')
    await favoriteButton(page).click()
    await expect(page).toHaveURL('/entrar?redirect=%2Fnft%2Fnft_042')
    await fillLogin(page, 'bruno')
    await expect(page).toHaveURL('/nft/nft_042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(favoriteButton(page)).toHaveAttribute('aria-pressed', 'false')
  })

  test('toggling is optimistic, persists after reload and shows up in the list', async ({
    page,
    gotoFresh,
    login,
    mock,
  }) => {
    await gotoFresh('/')
    await login('ana')
    await page.goto('/nft/nft_009')
    const button = favoriteButton(page)
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    // A slow server proves the pressed state comes from the optimistic update, not the response.
    await mock.scenario('default', { latencyOverride: 2500 })
    // networkidle resolves at once when already reached: wait for the toggle itself before reloading.
    const saved = page.waitForResponse(isFavoritePut)
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 })
    await expect(button).toHaveAccessibleName('Remover dos favoritos')
    await mock.scenario('default', { latencyOverride: null })
    expect((await saved).status()).toBe(204)

    await page.reload()
    await expect(favoriteButton(page)).toHaveAttribute('aria-pressed', 'true')

    // Full load: the list comes from the API, not from the optimistic cache.
    await page.goto('/perfil/favoritos')
    await expect(page).toHaveURL('/perfil/favoritos')
    const list = page.getByRole('list', { name: 'Lista de interesse' })
    await expect(list.getByRole('link', { name: 'Sage Nomad #009', exact: true })).toBeVisible()
    await expect(list.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
  })

  test('a failing toggle rolls back with an error toast, then succeeds once the API recovers', async ({
    page,
    gotoFresh,
    login,
    mock,
  }) => {
    await gotoFresh('/')
    await login('ana')
    await page.goto('/nft/nft_009')
    const button = favoriteButton(page)
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    await mock.scenario('favorite-fail', { latencyOverride: 1200 })
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 })
    await expect(page.getByText(ERROR_TOAST)).toBeVisible()
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    await mock.scenario('default', { latencyOverride: null })
    const saved = page.waitForResponse(isFavoritePut)
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    expect((await saved).status()).toBe(204)
    await page.reload()
    await expect(favoriteButton(page)).toHaveAttribute('aria-pressed', 'true')
  })

  test('the catalog card favorite uses the same optimistic toggle', async ({ page, gotoFresh, login }) => {
    await gotoFresh('/')
    await login('ana')
    const card = page.getByTestId('nft-card').filter({ hasText: 'Sage Nomad #009' })
    const toggle = card.getByRole('button', { name: /Sage Nomad #009 .* lista de interesse/ }).locator('visible=true')
    await card.hover()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveAccessibleName('Remover Sage Nomad #009 da lista de interesse')
  })

  test("a user never sees another user's favorites", async ({ page, gotoFresh, login }) => {
    await gotoFresh('/')
    await login('ana')
    await openFavorites(page)
    const list = page.getByRole('list', { name: 'Lista de interesse' })
    await expect(list.getByRole('link', { name: 'Emerald Ape #042', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL('/')
    await openFavorites(page)
    await expect(page).toHaveURL('/entrar?redirect=%2Fperfil%2Ffavoritos')
    await fillLogin(page, 'bruno')
    await expect(page).toHaveURL('/perfil/favoritos')
    await expect(page.getByRole('heading', { name: 'Sua lista de interesse está vazia' })).toBeVisible()
    await expect(page.getByText('Emerald Ape #042')).toHaveCount(0)
  })
})
