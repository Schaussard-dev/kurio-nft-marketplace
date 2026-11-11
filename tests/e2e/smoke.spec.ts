import { expect, test } from '@playwright/test'

test('home page has the Kurio title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Kurio/)
})

test('unknown route shows the not found page', async ({ page }) => {
  await page.goto('/rota/inexistente')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})
