import { expect, test, waitForApiIdle, waitForRealtime } from './fixtures'
import {
  cartLines,
  checkoutForm,
  confirmButton,
  connectDialog,
  listOrders,
  openCheckout,
  openReview,
  recordOrderPosts,
  reviewDialog,
  sendButton,
  showPayerFields,
} from './checkout-helpers'

// ana starts with 1× Sage Nomad #009 in her cart, so every test can go straight to /pagamento.

test.describe('payment failures', () => {
  test.describe.configure({ timeout: 90_000 })

  test('payment-declined: the order ends "Pagamento recusado" with the reason and the cart untouched', async ({
    page,
    gotoFresh,
    login,
    mock,
  }) => {
    await gotoFresh('/')
    await login('ana')
    await mock.scenario('payment-declined')
    await openCheckout(page)
    const before = await cartLines(page)
    await openReview(page)
    await sendButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_/)
    const orderId = page.url().split('/').pop()!

    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    await expect(page.getByTestId('decline-reason')).toHaveText('A carteira recusou o pagamento. Nenhum valor foi cobrado.')
    const orders = await listOrders(page)
    expect(orders.map((order) => [order.id, order.status])).toEqual([[orderId, 'declined']])
    // No receipt for a declined order, and every item is still in the cart.
    await expect(page.getByRole('region', { name: 'Seus NFTs agora estão na sua carteira' })).toHaveCount(0)
    expect(await cartLines(page)).toEqual(before)

    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page).toHaveURL('/carrinho')
    await expect(page.getByTestId('cart-line').filter({ hasText: 'Sage Nomad #009' })).toBeVisible()
  })

  test('a double click on "Enviar pedido" sends exactly one order request', async ({ page, gotoFresh, login, mock }) => {
    await gotoFresh('/')
    await login('ana')
    await openCheckout(page)
    await openReview(page)
    // Slow API so the second click lands while the first request is in flight.
    await mock.scenario('default', { latencyOverride: 1500 })
    const posts = recordOrderPosts(page)
    await sendButton(page).dblclick()
    await expect(sendButton(page)).toBeDisabled()
    await expect(sendButton(page)).toHaveAccessibleName('Enviar pedido')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/pedidos\/ord_/)
    expect(posts).toHaveLength(1)
    expect(await listOrders(page)).toHaveLength(1)
  })

  test('order-timeout: after 10 s the client resends with the same key; "Verificar pedido" recovers the same order', async ({
    page,
    gotoFresh,
    login,
    mock,
  }) => {
    // Fake clock that keeps flowing; fastForward jumps the 10 s order deadline.
    await page.clock.install()
    await gotoFresh('/')
    await login('ana')
    await mock.scenario('order-timeout')
    await openCheckout(page)
    await openReview(page)
    const posts = recordOrderPosts(page)
    const firstPost = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/api/orders'))
    await sendButton(page).click()
    await firstPost
    // The mock created the order but never answers this request.
    await expect.poll(async () => (await listOrders(page)).length).toBe(1)
    const [created] = await listOrders(page)

    // The automatic same-key resend will fail too (network down), leaving the order unconfirmed.
    await mock.scenario('offline')
    await page.clock.fastForward(10_000)
    const pending = page.getByRole('dialog', { name: 'Confirmando pedido' })
    await expect(pending).toContainText('A confirmação está demorando…')
    const verify = pending.getByRole('button', { name: 'Verificar pedido' })
    await expect(verify).toBeVisible()
    expect(posts).toHaveLength(2)

    await mock.scenario('default')
    await verify.click()
    await expect(page).toHaveURL(`/pedidos/${created.id}`)
    expect(posts).toHaveLength(3)
    expect(new Set(posts.map((post) => post.headers()['idempotency-key'])).size).toBe(1)
    const orders = await listOrders(page)
    expect(orders.map((order) => order.id)).toEqual([created.id])
  })

  test('order-timeout: when the unanswered order resolves, order.updated takes the waiting checkout to the receipt', async ({
    page,
    gotoFresh,
    login,
    mock,
  }) => {
    await page.clock.install()
    await gotoFresh('/')
    await login('ana')
    await mock.scenario('order-timeout')
    await openCheckout(page)
    await openReview(page)
    const posts = recordOrderPosts(page)
    const firstPost = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/api/orders'))
    await sendButton(page).click()
    await firstPost
    await expect.poll(async () => (await listOrders(page)).length).toBe(1)
    const [created] = await listOrders(page)

    await mock.scenario('offline')
    await page.clock.fastForward(10_000)
    const pending = page.getByRole('dialog', { name: 'Confirmando pedido' })
    await expect(pending.getByRole('button', { name: 'Verificar pedido' })).toBeVisible()
    expect(posts).toHaveLength(2)

    // The network confirms the order; its event reaches the checkout still waiting for an answer.
    await mock.scenario('default')
    await waitForRealtime(page)
    expect(await mock.emit({ action: 'order:resolve', orderId: created.id })).toBe(200)
    await expect(page).toHaveURL(`/pedidos/${created.id}`)
    await expect(page.getByRole('region', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    expect(posts).toHaveLength(2)
    // The attempt behind it is over (a new purchase may mint a new key).
    expect(await page.evaluate(() => sessionStorage.getItem('kurio-order-attempt:usr_ana'))).toBeNull()
  })

  test('an unconfirmed order stays the only one: closing, a new quote and an edited field still resend the same attempt', async ({
    page,
    gotoFresh,
    login,
    mock,
    isMobile,
  }) => {
    await page.clock.install()
    await gotoFresh('/')
    await login('ana')
    await mock.scenario('order-timeout')
    await openCheckout(page)
    await waitForRealtime(page)
    await openReview(page)
    const posts = recordOrderPosts(page)
    const firstPost = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/api/orders'))
    await sendButton(page).click()
    await firstPost
    await expect.poll(async () => (await listOrders(page)).length).toBe(1)
    const [created] = await listOrders(page)

    await mock.scenario('offline')
    await page.clock.fastForward(10_000)
    const pending = page.getByRole('dialog', { name: 'Confirmando pedido' })
    await expect(pending.getByRole('button', { name: 'Verificar pedido' })).toBeVisible()
    // The collector gives up on this dialog…
    await pending.getByRole('button', { name: 'Fechar' }).click()
    await expect(pending).toHaveCount(0)
    await mock.scenario('default')

    // The page offers to verify the unconfirmed order first.
    await expect(page.getByTestId('pending-attempt')).toContainText('total 1.706 ETH')

    // …the quote is renewed by a realtime price change, a field is edited and the wallet/network switched.
    expect(await mock.emit({ action: 'nft:update', nftId: 'nft_009', price: '1.89' })).toBe(200)
    await expect(page.getByTestId('checkout-total')).toHaveText('1.906 ETH')
    await showPayerFields(page, isMobile)
    await checkoutForm(page).getByLabel(/^Observação do colecionador/).fill('Outra observação')
    await page.getByRole('radiogroup', { name: 'Carteira de pagamento' }).getByRole('radio', { name: /Reserva/ }).check()
    await expect(page.getByTestId('checkout-total')).toHaveText('1.892 ETH')

    // The review shows what will really be re-sent: the earlier attempt (Principal, Ethereum, 1.706).
    await openReview(page)
    const review = reviewDialog(page)
    await expect(review.getByTestId('review-total')).toHaveText('1.706 ETH')
    await expect(review).toContainText('Rede Ethereum')
    await expect(review).not.toContainText('Polygon')
    await expect(review.getByTestId('replay-notice')).toContainText('Principal · 0xA91F…E82C via MetaMask · Rede Ethereum · total 1.706 ETH')
    await expect(sendButton(page)).toHaveAccessibleDescription(/Vamos reenviar o pedido anterior/)
    await sendButton(page).click()
    await expect(page).toHaveURL(`/pedidos/${created.id}`)
    const orders = await listOrders(page)
    expect(orders.map((order) => order.id)).toEqual([created.id])
    expect(orders[0].snapshot).toMatchObject({ total: '1.706', network: 'ethereum' })
    expect(new Set(posts.map((post) => post.headers()['idempotency-key'])).size).toBe(1)
  })

  test('a reload with an unconfirmed order shows "Verificar pedido" first, which finds the order already created', async ({
    page,
    gotoFresh,
    login,
    mock,
  }) => {
    await page.clock.install()
    await gotoFresh('/')
    await login('ana')
    await mock.scenario('order-timeout')
    await openCheckout(page)
    await openReview(page)
    const firstPost = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/api/orders'))
    await sendButton(page).click()
    await firstPost
    await expect.poll(async () => (await listOrders(page)).length).toBe(1)
    const [created] = await listOrders(page)

    // The answer is lost (reload while the request hangs); the attempt survives in this tab.
    await mock.scenario('default')
    await openCheckout(page)
    const banner = page.getByTestId('pending-attempt')
    await expect(banner).toContainText('Um pedido anterior ficou sem confirmação')
    await expect(banner).toContainText('total 1.706 ETH')
    await banner.getByRole('button', { name: 'Verificar pedido' }).click()
    await expect(page).toHaveURL(`/pedidos/${created.id}`)
    expect((await listOrders(page)).map((order) => order.id)).toEqual([created.id])
  })

  test('a verified attempt that the server refuses never opens a review without a wallet approval for the current data', async ({
    page,
    gotoFresh,
    login,
    mock,
  }) => {
    await gotoFresh('/')
    await login('ana')
    await openCheckout(page)
    await openReview(page)
    // The order request never reaches the API (network down, the automatic resend too): an attempt is left.
    await mock.scenario('offline')
    await sendButton(page).click()
    await expect(page.getByRole('dialog', { name: 'Confirmando pedido' }).getByRole('button', { name: 'Verificar pedido' })).toBeVisible()
    await mock.scenario('default')
    // Meanwhile the price changes, so the stored attempt's quote is stale.
    expect(await mock.emit({ action: 'nft:update', nftId: 'nft_009', price: '1.89' })).toBe(200)

    // New page load: no wallet approval in memory. The banner verifies the attempt; the server refuses it.
    await openCheckout(page)
    await page.getByTestId('pending-attempt').getByRole('button', { name: 'Verificar pedido' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'O pedido anterior não foi registrado' })).toBeVisible()
    await expect(reviewDialog(page)).toHaveCount(0)
    await expect(page.getByTestId('pending-attempt')).toHaveCount(0)
    expect(await listOrders(page)).toHaveLength(0)

    // Continuing means a new approval in the wallet, then the review of the current data.
    const connects: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/api\/wallets\/[^/]+\/connect$/.test(r.url())) connects.push(r.url())
    })
    await openReview(page)
    expect(connects).toHaveLength(1)
    await expect(reviewDialog(page).getByTestId('review-total')).toHaveText('1.906 ETH')
  })

  test('sold-out: the edition sells out while ordering → OUT_OF_STOCK alert and checkout blocked until the cart is adjusted', async ({
    page,
    gotoFresh,
    login,
    mock,
  }) => {
    await gotoFresh('/')
    await login('ana')
    await mock.scenario('sold-out')
    await openCheckout(page)
    await openReview(page)
    await sendButton(page).click()

    await expect(reviewDialog(page)).toHaveCount(0)
    await expect(page.getByRole('alert').filter({ hasText: 'Alguns itens não têm mais estoque suficiente' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Voltar ao carrinho' }).last()).toBeVisible()
    await expect(confirmButton(page)).toBeDisabled()
    await expect(confirmButton(page)).toHaveAccessibleDescription(/Ajuste as quantidades no carrinho para continuar/)
    await expect(page.getByText('Sage Nomad #009: Esgotado')).toBeVisible()
    expect(await listOrders(page)).toHaveLength(0)
  })

  test('wallet-reject: the refusal is shown and "Tentar novamente" connects once the wallet approves', async ({
    page,
    gotoFresh,
    login,
    mock,
  }) => {
    await gotoFresh('/')
    await login('ana')
    await mock.scenario('wallet-reject')
    await openCheckout(page)
    await confirmButton(page).click()
    const dialog = connectDialog(page)
    await expect(dialog.getByRole('alert')).toHaveText('Conexão recusada na carteira.')
    await expect(reviewDialog(page)).toHaveCount(0)

    await mock.scenario('default')
    await dialog.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(reviewDialog(page)).toBeVisible()

    // Esc closes the flow and gives the focus back to "Confirmar compra".
    await page.keyboard.press('Escape')
    await expect(reviewDialog(page)).toHaveCount(0)
    await expect(confirmButton(page)).toBeFocused()
    await waitForApiIdle(page)
  })
})
