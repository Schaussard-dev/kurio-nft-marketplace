import { expect, test } from './fixtures'
import {
  apiQuoteTotal,
  cartLines,
  checkoutForm,
  confirmButton,
  connectDialog,
  fillLogin,
  listOrders,
  recordOrderPosts,
  reviewDialog,
  sendButton,
  showPayerFields,
} from './checkout-helpers'

test.describe('purchase', () => {
  // Several full loads (catalog, detail, cart, login, checkout) under parallel load.
  test.describe.configure({ timeout: 90_000 })

  test('catalog → detail → cart → login → prefilled checkout → wallet → review → idempotent order', async ({
    page,
    gotoFresh,
    isMobile,
  }) => {
    await gotoFresh('/?q=Emerald')
    await page.getByTestId('nft-card').filter({ hasText: 'Emerald Ape #042' }).getByRole('link', { name: 'Emerald Ape #042', exact: true }).click()
    await expect(page).toHaveURL(/\/nft\/nft_042/)
    await page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
    await expect(page).toHaveURL('/carrinho')

    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/)
    await fillLogin(page, 'ana')
    await expect(page).toHaveURL('/pagamento')

    // Prefilled from the profile and the primary wallet.
    await expect(page.getByTestId('checkout-total')).toHaveText(/ETH$/)
    const wallet = page.getByRole('radiogroup', { name: 'Carteira de pagamento' })
    await expect(wallet.getByRole('radio', { name: /Principal/ })).toBeChecked()
    await showPayerFields(page, isMobile)
    await expect(checkoutForm(page).getByLabel(/^Nome de exibição/)).toHaveValue('Ana Souza')
    await expect(checkoutForm(page).getByLabel(/^Nome de usuário/)).toHaveValue('ana')
    await expect(checkoutForm(page).getByLabel(/^E-mail/)).toHaveValue('ana@kurio.dev')
    await expect(checkoutForm(page).getByLabel(/^Endereço da carteira/)).toHaveValue('0xA91F3c2d4E5f60718293a4b5C6d7E8f90123E82C')
    await expect(checkoutForm(page).getByLabel(/^Código de indicação/)).toHaveValue('KURIO-ANA')

    // "Seus NFTs" lists the merged cart (Emerald Ape + ana's Sage Nomad) on desktop.
    if (!isMobile) {
      const nfts = page.getByRole('region', { name: 'Seus NFTs' })
      await expect(nfts.getByText('Emerald Ape #042')).toBeVisible()
      await expect(nfts.getByText('Sage Nomad #009')).toBeVisible()
    }

    await page.getByRole('radiogroup', { name: 'Carteira e rede' }).getByRole('radio', { name: 'MetaMask' }).check()
    const posts = recordOrderPosts(page)
    await confirmButton(page).click()
    // Wallet approval, then the review of the current API quote.
    await expect(connectDialog(page).or(reviewDialog(page))).toBeVisible()
    await expect(reviewDialog(page)).toBeVisible()
    const quoteTotal = await apiQuoteTotal(page)
    await expect(reviewDialog(page).getByTestId('review-total')).toHaveText(`${quoteTotal} ETH`)
    await expect(reviewDialog(page)).toContainText('Emerald Ape #042')
    await expect(reviewDialog(page)).toContainText('MetaMask')
    const before = await cartLines(page)

    await sendButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_[0-9a-f]+$/)
    const orderId = page.url().split('/').pop()!

    const orders = await listOrders(page)
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({ id: orderId, snapshot: { total: quoteTotal, network: 'ethereum' } })
    expect(posts).toHaveLength(1)
    expect(posts[0].headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)

    // The network confirms (order.updated over the socket): the receipt shows what was reviewed.
    const receipt = page.getByRole('region', { name: 'Seus NFTs agora estão na sua carteira' })
    await expect(receipt).toBeVisible()
    await expect(receipt.getByTestId('receipt-total')).toHaveText(`${quoteTotal} ETH`)
    await expect(receipt.getByTestId('receipt-summary-total')).toHaveText(`${quoteTotal} ETH`)
    await expect(receipt).toContainText('Emerald Ape #042')
    await expect(receipt).toContainText('Sage Nomad #009')
    await expect(receipt).toContainText('Transação confirmada na Ethereum.')
    await expect(receipt).toContainText('Principal · 0xA91F…E82C')
    // The confirmed order is no longer tracked as pending.
    await expect.poll(() => page.evaluate(() => localStorage.getItem('kurio-pending-order:usr_ana'))).toBeNull()
    // The bought quantities left the cart (a line bought in full is removed).
    const bought = new Map(orders[0].snapshot.lines.map((line) => [line.nftId, line.quantity]))
    const expected = before
      .map((line) => ({ ...line, quantity: line.quantity - (bought.get(line.nftId) ?? 0) }))
      .filter((line) => line.quantity > 0)
    expect(await cartLines(page)).toEqual(expected)
    // …and the app's cart (badge) follows without a reload: everything was bought, so no count is left.
    expect(expected).toEqual([])
    await expect(page.getByRole('link', { name: /^Carrinho, / })).toHaveCount(0)

    // Closing the receipt goes back to the home page.
    await receipt.getByRole('link', { name: 'Fechar' }).click()
    await expect(page).toHaveURL('/')
  })

  test('without registered wallets the checkout shows the empty state and accepts a wallet typed in by hand', async ({
    page,
    gotoFresh,
    login,
    isMobile,
  }) => {
    await gotoFresh('/')
    await login('bruno')
    await page.goto('/nft/nft_042')
    await page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR', exact: true }).click()
    await expect(page).toHaveURL('/carrinho')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL('/pagamento')

    await expect(page.getByText('Nenhuma carteira cadastrada')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Cadastrar carteira' })).toHaveAttribute(
      'href',
      '/perfil/carteiras?redirect=%2Fpagamento',
    )
    await expect(
      page.getByRole('radiogroup', { name: 'Carteira de pagamento' }).getByRole('radio', { name: 'Usar outra carteira?' }),
    ).toBeChecked()

    // Required fields are checked before any wallet request; the first invalid field gets the focus.
    await confirmButton(page).click()
    await expect(connectDialog(page)).toHaveCount(0)
    await showPayerFields(page, isMobile)
    await expect(checkoutForm(page).getByLabel(/^Rede/)).toBeFocused()
    await expect(checkoutForm(page).getByLabel(/^Endereço da carteira/)).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByTestId('live-assertive')).toHaveText('Verifique os campos destacados')

    await checkoutForm(page).getByLabel(/^Rede/).selectOption('polygon')
    await checkoutForm(page).getByLabel(/^Endereço da carteira/).fill('0x1234567890abcdef1234567890abcdef12345678')
    await checkoutForm(page).getByLabel(/^Código de indicação/).fill('KURIO-BRUNO')
    await page.getByRole('radiogroup', { name: 'Carteira e rede' }).getByRole('radio', { name: 'Coinbase Wallet' }).check()
    // Polygon fee in the API quote.
    await expect(page.getByTestId('checkout-total')).toHaveText(`${await apiQuoteTotal(page, 'polygon')} ETH`)

    await confirmButton(page).click()
    await expect(reviewDialog(page)).toBeVisible()
    await expect(reviewDialog(page)).toContainText('Polygon')
    await sendButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_/)
    const [order] = await listOrders(page)
    expect(order.snapshot.network).toBe('polygon')
  })
})
