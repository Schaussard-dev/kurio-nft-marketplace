import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const editions = (page: Page) => page.getByRole('radiogroup', { name: 'Edição' })
const quantity = (page: Page) => page.getByRole('group', { name: 'Quantidade' })
const mainImage = (page: Page) => page.getByTestId('gallery-main').getByRole('img')

test.describe('NFT detail', () => {
  test('a direct visit renders the NFT from the API', async ({ page, gotoFresh }) => {
    await gotoFresh('/nft/nft_042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByTestId('nft-price')).toHaveText('1.19 ETH')
    await expect(
      page.getByText(/^Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum/),
    ).toBeVisible()
    await expect(page.getByText('Coleção: Kurio Apes')).toBeVisible()
    await expect(page.getByText('Atributos: Óculos, Esmeralda, Raro')).toBeVisible()
    await expect(page).toHaveTitle(/Emerald Ape #042/)

    // Reviews tab: count from the API, read-only list.
    const reviewsTab = page.getByRole('tab', { name: /Avaliações de colecionadores \(19\)/ })
    await reviewsTab.click()
    await expect(page.getByRole('tabpanel').getByRole('listitem')).toHaveCount(19)

    // "Mais desta coleção" links to other NFTs of the collection, never to the current one.
    const more = page.getByRole('region', { name: 'Mais desta coleção' })
    await expect(more.getByRole('link').first()).toBeVisible()
    await expect(more.getByRole('link', { name: /Emerald Ape #042/ })).toHaveCount(0)
  })

  test('an unknown NFT shows the not-found state with a way back to the catalog', async ({ page, gotoFresh }) => {
    await gotoFresh('/nft/nao-existe')
    await expect(page.getByRole('heading', { level: 1, name: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao catálogo' }).click()
    await expect(page).toHaveURL(/:\d+\/(#catalogo)?$/)
  })

  test('a failing API shows a retry and a way back to the catalog (also without app chrome on mobile)', async ({
    page,
    gotoFresh,
    mock,
  }) => {
    await gotoFresh('/nft/nft_042', { scenario: 'server-error' })
    await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível carregar este NFT.' })).toBeVisible({
      timeout: 15_000,
    })
    await mock.scenario('default')
    await page.getByRole('link', { name: 'Voltar ao catálogo' }).click()
    await expect(page).toHaveURL(/:\d+\/(#catalogo)?$/)
  })

  test('a sold-out edition cannot be selected and says "Esgotada"', async ({ page, gotoFresh }) => {
    await gotoFresh('/nft/nft_042')
    const soldOut = editions(page).getByRole('radio', { name: /^1\/1.*Esgotada/ })
    await expect(soldOut).toHaveAttribute('aria-disabled', 'true')
    await expect(soldOut).toContainText('Esgotada')
    // Default = first edition with stock.
    await expect(editions(page).getByRole('radio', { name: /^1\/10/ })).toHaveAttribute('aria-checked', 'true')

    await soldOut.click({ force: true })
    await expect(soldOut).toHaveAttribute('aria-checked', 'false')
    await expect(page).not.toHaveURL(/edition=nft_042_e1/)

    // Selecting another edition writes it to the URL; reload keeps it.
    await editions(page).getByRole('radio', { name: /^1\/50/ }).click()
    await expect(page).toHaveURL(/edition=nft_042_e3/)
    await page.reload()
    await expect(editions(page).getByRole('radio', { name: /^1\/50/ })).toHaveAttribute('aria-checked', 'true')
  })

  test('an invalid or sold-out edition in the URL falls back to the default edition', async ({ page, gotoFresh }) => {
    await gotoFresh('/nft/nft_042?edition=nft_042_e1')
    await expect(editions(page).getByRole('radio', { name: /^1\/10/ })).toHaveAttribute('aria-checked', 'true')
    await page.goto('/nft/nft_042?edition=bogus')
    await expect(editions(page).getByRole('radio', { name: /^1\/10/ })).toHaveAttribute('aria-checked', 'true')
  })

  test('the + button stops at the limit and explains it', async ({ page, gotoFresh }) => {
    await gotoFresh('/nft/nft_042')
    const stepper = quantity(page)
    const plus = stepper.getByRole('button', { name: 'Aumentar quantidade' })
    // 1/10 of nft_042 has 4 available.
    for (let i = 0; i < 3; i++) await plus.click()
    await expect(stepper.getByTestId('quantity-value')).toHaveText('4')
    // At the limit the button stays focusable (aria-disabled) and further presses change nothing.
    await expect(plus).toHaveAttribute('aria-disabled', 'true')
    await plus.click({ force: true })
    await plus.press('Enter')
    await expect(stepper.getByTestId('quantity-value')).toHaveText('4')
    await expect(plus).toBeFocused()
    await expect(page.getByText('Máximo de 4 por pedido')).toBeVisible()

    await stepper.getByRole('button', { name: 'Diminuir quantidade' }).click()
    await expect(stepper.getByTestId('quantity-value')).toHaveText('3')
    await expect(page.getByText(/Máximo de/)).toHaveCount(0)
  })

  test('buy and cart actions are not wired yet and never look successful', async ({ page, gotoFresh }) => {
    await gotoFresh('/nft/nft_042')
    await page.getByRole('button', { name: /^Comprar/i }).click()
    await expect(page.getByText('Indisponível nesta demonstração')).toBeVisible()
    await expect(page).toHaveURL(/\/nft\/nft_042/)
  })

  test('gallery thumbnails swap the main image and the zoom dialog traps and returns focus', async ({
    page,
    gotoFresh,
  }) => {
    await gotoFresh('/nft/nft_042')
    await expect(mainImage(page)).toHaveAttribute('alt', /imagem 1 de 4/)
    const second = page.getByRole('button', { name: 'Ver imagem 2 de 4' })
    await second.click()
    await expect(second).toHaveAttribute('aria-pressed', 'true')
    await expect(mainImage(page)).toHaveAttribute('alt', /imagem 2 de 4/)

    const trigger = page.getByRole('button', { name: 'Ampliar imagem' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: /Emerald Ape #042/ })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('img')).toHaveAttribute('alt', /imagem 2 de 4/)
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((el) => el.contains(el.ownerDocument.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})
