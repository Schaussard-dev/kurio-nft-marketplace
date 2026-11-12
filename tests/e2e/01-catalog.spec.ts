import type { Locator, Page } from '@playwright/test'
import { expect, test, waitForMocks } from './fixtures'

const cards = (page: Page) => page.getByTestId('nft-card')
const cardNames = (page: Page) => cards(page).getByRole('heading').allInnerTexts()
const grid = (page: Page) => page.getByRole('list', { name: 'NFTs' })
const param = (page: Page, key: string) => new URL(page.url()).searchParams.get(key)

/** Desktop filters live in the sidebar; mobile opens them in the "Filtros" sheet. */
async function openFilters(page: Page, isMobile: boolean): Promise<Locator> {
  if (!isMobile) return page.getByRole('complementary', { name: 'Filtros' })
  await page.getByRole('button', { name: /^Filtros/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Filtros' })
  await expect(sheet).toBeVisible()
  return sheet
}

async function closeFilters(page: Page, isMobile: boolean) {
  if (!isMobile) return
  // Shared sheet chrome is pt-BR too.
  await expect(page.getByRole('dialog', { name: 'Filtros' }).getByRole('button', { name: 'Fechar', exact: true })).toBeVisible()
  await page.getByRole('dialog', { name: 'Filtros' }).getByRole('button', { name: /Ver resultados/ }).click()
  await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeHidden()
}

async function settled(page: Page) {
  await expect(grid(page)).toHaveAttribute('aria-busy', 'false')
}

test.describe('catalog (Início)', () => {
  test('search narrows the grid and writes q to the URL', async ({ page, gotoFresh }) => {
    await gotoFresh('/')
    await expect(cards(page)).toHaveCount(9)

    await page.getByRole('searchbox', { name: 'Buscar NFTs' }).fill('golden')
    await expect.poll(() => param(page, 'q')).toBe('golden')
    await expect(cards(page)).toHaveCount(3)
    await settled(page)
    for (const name of await cardNames(page)) expect(name).toContain('Golden')
    await expect(page.getByTestId('live-polite')).toHaveText('3 NFTs encontrados')
  })

  test('category and network filters combine and are kept in the URL', async ({ page, gotoFresh, isMobile }) => {
    await gotoFresh('/')
    await expect(cards(page)).toHaveCount(9)

    const filters = await openFilters(page, isMobile)
    await filters.getByRole('checkbox', { name: /^Música/ }).check()
    await expect.poll(() => param(page, 'categories')).toContain('musica')
    await filters.getByRole('checkbox', { name: /^Polygon/ }).check()
    await expect.poll(() => param(page, 'networks')).toContain('polygon')
    await closeFilters(page, isMobile)

    expect(param(page, 'categories')).toContain('musica')
    await settled(page)
    await expect(cards(page).first()).toBeVisible()
    const attrs = await cards(page).evaluateAll((els) =>
      els.map((el) => ({ category: el.getAttribute('data-category'), network: el.getAttribute('data-network') })),
    )
    expect(attrs.length).toBeGreaterThan(0)
    for (const attr of attrs) expect(attr).toEqual({ category: 'musica', network: 'polygon' })
  })

  test('a hand-written link with plain values applies them, and the app writes plain values back', async ({
    page,
    gotoFresh,
    isMobile,
  }) => {
    await gotoFresh('/?minPrice=3.62&categories=arte-digital&q=a')
    const expected = await page.evaluate(async () => {
      const res = await fetch('/api/nfts?minPrice=3.62&categories=arte-digital&q=a')
      return ((await res.json()) as { items: { name: string }[] }).items.map((item) => item.name)
    })
    expect(expected.length).toBeGreaterThan(0)
    await settled(page)
    await expect.poll(() => cardNames(page)).toEqual(expected)
    await expect(page.getByRole('searchbox', { name: 'Buscar NFTs' })).toHaveValue('a')

    const filters = await openFilters(page, isMobile)
    await filters.getByRole('checkbox', { name: /^Música/ }).check()
    await expect.poll(() => new URL(page.url()).searchParams.getAll('categories')).toEqual(['arte-digital', 'musica'])
    expect(page.url()).not.toContain('%22')
    expect(page.url()).toContain('minPrice=3.62')
  })

  test('the mobile filter button says how many filters are active (FR-14)', async ({ page, gotoFresh, isMobile }) => {
    test.skip(!isMobile, 'the filter button exists below 1024px')
    await gotoFresh('/')
    await expect(page.getByRole('button', { name: 'Filtros', exact: true })).toBeVisible()
    // The trigger is inert while the modal sheet is open: read its name after closing it.
    let filters = await openFilters(page, isMobile)
    await filters.getByRole('checkbox', { name: /^Música/ }).check()
    await closeFilters(page, isMobile)
    await expect(page.getByRole('button', { name: 'Filtros, 1 ativo', exact: true })).toBeVisible()
    filters = await openFilters(page, isMobile)
    await filters.getByRole('checkbox', { name: /^Polygon/ }).check()
    await closeFilters(page, isMobile)
    await expect(page.getByRole('button', { name: 'Filtros, 2 ativos', exact: true })).toBeVisible()
  })

  test('the filter sheet never shows the previous count while the new one loads (FR-13)', async ({
    page,
    gotoFresh,
    isMobile,
    mock,
  }) => {
    test.skip(!isMobile, 'the filter sheet exists below 1024px')
    await gotoFresh('/')
    await expect(cards(page)).toHaveCount(9)
    await mock.scenario('slow')
    const sheet = await openFilters(page, isMobile)
    const results = sheet.getByRole('button', { name: /Ver resultados/ })
    await expect(results).toHaveText('Ver resultados (60)')
    await sheet.getByRole('checkbox', { name: /^Fotografia/ }).check()
    await expect(results).toHaveText('Ver resultados')
    await expect(results).toHaveText(/^Ver resultados \(\d+\)$/, { timeout: 10_000 })
    await expect(results).not.toHaveText('Ver resultados (60)')
  })

  test('pagination, sorting, history and reload stay in sync with the URL', async ({ page, gotoFresh }) => {
    await gotoFresh('/')
    await expect(cards(page)).toHaveCount(9)
    const firstPage = await cardNames(page)

    await page.getByRole('navigation', { name: 'Paginação' }).getByRole('link', { name: 'Página 2' }).click()
    await expect.poll(() => param(page, 'page')).toBe('2')
    await expect.poll(() => cardNames(page)).not.toEqual(firstPage)
    await settled(page)
    const secondPage = await cardNames(page)

    await page.getByRole('combobox', { name: 'Ordenar por' }).click()
    await page.getByRole('option', { name: 'Maior preço' }).click()
    await expect.poll(() => param(page, 'sort')).toBe('price-desc')
    expect(param(page, 'page')).toBeNull()
    await expect(cards(page).first()).toContainText('12.30 ETH')

    await page.goBack()
    await expect.poll(() => param(page, 'page')).toBe('2')
    expect(param(page, 'sort')).toBeNull()
    await expect.poll(() => cardNames(page)).toEqual(secondPage)

    await page.reload()
    await waitForMocks(page)
    expect(param(page, 'page')).toBe('2')
    await expect.poll(() => cardNames(page)).toEqual(secondPage)
  })

  test('empty scenario shows the empty state', async ({ page, gotoFresh }) => {
    await gotoFresh('/', { scenario: 'empty' })
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Limpar filtros' })).toBeVisible()
    await expect(cards(page)).toHaveCount(0)
  })

  test('a page past the end offers a way back instead of a blank grid', async ({ page, gotoFresh }) => {
    await gotoFresh('/?page=99')
    await expect(page.getByRole('heading', { name: 'Nenhum NFT nesta página' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Paginação' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Voltar à primeira página' }).click()
    await expect(cards(page)).toHaveCount(9)
    expect(param(page, 'page')).toBeNull()
    await expect(page.getByRole('navigation', { name: 'Paginação' })).toBeVisible()
  })

  test('out-of-order responses never overwrite the latest search (jitter)', async ({ page, gotoFresh }) => {
    await gotoFresh('/', { scenario: 'jitter' })
    await expect(cards(page)).toHaveCount(9, { timeout: 10_000 })

    const search = page.getByRole('searchbox', { name: 'Buscar NFTs' })
    // Typed faster than the 300 ms debounce: "a", "ap", "ape" in quick succession.
    await search.pressSequentially('ape', { delay: 60 })
    await expect.poll(() => param(page, 'q')).toBe('ape')

    const expected = await page.evaluate(async () => {
      const res = await fetch('/api/nfts?q=ape')
      const body = (await res.json()) as { items: { name: string }[] }
      return body.items.map((item) => item.name)
    })
    expect(expected.length).toBeGreaterThan(0)
    await expect.poll(() => cardNames(page), { timeout: 10_000 }).toEqual(expected)
    // Let any straggling response land, then confirm nothing overwrote the grid.
    await page.waitForLoadState('networkidle')
    await settled(page)
    expect(await cardNames(page)).toEqual(expected)
  })

  test('server error shows a retry that recovers once the API is healthy', async ({ page, gotoFresh, mock }) => {
    await gotoFresh('/', { scenario: 'server-error' })
    await expect(page.getByText('Não foi possível carregar os NFTs.')).toBeVisible({ timeout: 15_000 })
    const retry = page.getByRole('button', { name: 'Tentar novamente' })
    await expect(retry).toBeVisible()

    await mock.scenario('default')
    await retry.click()
    await expect(cards(page)).toHaveCount(9)
  })
})
