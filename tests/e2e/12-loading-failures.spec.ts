import { expect, test, waitForApiIdle } from './fixtures'

const grid = (page: import('@playwright/test').Page) => page.getByRole('list', { name: 'NFTs' })

test.describe('loading states (scenario slow)', () => {
  test.describe.configure({ timeout: 60_000 })

  test('the catalog shows skeletons with the final card box, then the cards', async ({ page, gotoFresh }) => {
    await gotoFresh('/', { scenario: 'slow' })
    const firstItem = grid(page).locator(':scope > li').first()
    await expect(firstItem.locator('[data-skeleton]').first()).toBeVisible()
    await expect(firstItem).not.toHaveAttribute('data-testid', 'nft-card')
    const skeletonBox = (await firstItem.boundingBox())!

    const firstCard = grid(page).getByTestId('nft-card').first()
    await expect(firstCard).toBeVisible({ timeout: 15_000 })
    await expect(grid(page).locator('[data-skeleton]')).toHaveCount(0)
    // Let the art decode: the image box is fixed by aspect-square, so nothing may move once it lands.
    await expect(firstCard.getByRole('img').first()).toHaveJSProperty('complete', true)
    const cardBox = (await firstCard.boundingBox())!
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(cardBox[key] - skeletonBox[key]), `${key}: skeleton ${skeletonBox[key]} vs card ${cardBox[key]}`).toBeLessThanOrEqual(2)
    }
  })

  test('the NFT detail shows its skeleton, then the NFT', async ({ page, gotoFresh }) => {
    await gotoFresh('/nft/nft_042', { scenario: 'slow' })
    const skeleton = page.getByRole('status', { name: 'Carregando NFT' })
    await expect(skeleton).toBeVisible()
    // The thumbnail column is hidden below 768px: check a skeleton that is on screen.
    await expect(skeleton.locator('[data-skeleton]:visible').first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible({ timeout: 15_000 })
    await expect(skeleton).toHaveCount(0)
  })

  test('the cart summary shows its skeleton, then the totals', async ({ page, gotoFresh, mock, isMobile }) => {
    await gotoFresh('/nft/nft_042')
    await page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
    await expect(page).toHaveURL('/carrinho')
    await waitForApiIdle(page)
    await mock.scenario('slow')
    await page.reload()
    const loading = page.getByLabel('Carregando resumo')
    await expect(loading.locator('[data-skeleton]').first()).toBeVisible()
    await expect(loading).toHaveCount(0, { timeout: 15_000 })
    await expect(page.getByText('Total', { exact: true }).first()).toBeVisible()
    await expect(page.locator('[data-skeleton]')).toHaveCount(0)
  })

  test('a private page reloaded on a slow network shows the app frame and a skeleton while the session is checked', async ({
    page,
    gotoFresh,
    login,
    mock,
  }) => {
    await gotoFresh('/')
    await login('ana')
    await page.goto('/perfil')
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil do colecionador' })).toBeVisible()
    await mock.scenario('slow')
    await page.reload()
    // The session check alone takes 2.5 s here: the page must not stay blank meanwhile.
    const pending = page.getByRole('status', { name: 'Carregando página' })
    await expect(pending).toBeVisible({ timeout: 1500 })
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(pending.locator('[data-skeleton]').first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil do colecionador' })).toBeVisible({ timeout: 15_000 })
    await expect(pending).toHaveCount(0)
  })

  test('skeletons shimmer, and stand still with prefers-reduced-motion', async ({ page, gotoFresh }) => {
    await gotoFresh('/', { scenario: 'slow' })
    const skeleton = grid(page).locator('[data-skeleton]').first()
    await expect(skeleton).toBeVisible()
    await expect(skeleton).toHaveCSS('animation-name', 'shimmer-sweep')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await expect(skeleton).toBeVisible()
    await expect(skeleton).toHaveCSS('animation-name', 'none')
  })
})

test.describe('failures', () => {
  test.describe.configure({ timeout: 60_000 })

  test('offline catalog shows an error with "Tentar novamente" that recovers once the network is back', async ({
    page,
    gotoFresh,
    mock,
  }) => {
    await gotoFresh('/', { scenario: 'offline' })
    const error = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar os NFTs.' })
    // Network errors are retried twice with backoff before the error state shows.
    await expect(error).toBeVisible({ timeout: 20_000 })
    await expect(grid(page)).toHaveCount(0)

    await mock.scenario('default')
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(grid(page).getByTestId('nft-card').first()).toBeVisible({ timeout: 15_000 })
    await expect(error).toHaveCount(0)
  })
})
