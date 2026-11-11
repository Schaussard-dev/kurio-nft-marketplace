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

  test('payment-declined: the order is created pending with the cart untouched', async ({ page, gotoFresh, login, mock }) => {
    await gotoFresh('/')
    await login('ana')
    await mock.scenario('payment-declined')
    await openCheckout(page)
    const before = await cartLines(page)
    await openReview(page)
    await sendButton(page).click()
    await expect(page).toHaveURL(/\/pedidos\/ord_/)
    const orders = await listOrders(page)
    expect(orders).toHaveLength(1)
    expect(orders[0].status).toBe('pending')
    // Task 18 resolves it to declined ("Pagamento recusado"); nothing leaves the cart.
    expect(await cartLines(page)).toEqual(before)
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

    // …the quote is renewed by a realtime price change and a field is edited before trying again.
    expect(await mock.emit({ action: 'nft:update', nftId: 'nft_009', price: '1.89' })).toBe(200)
    await expect(page.getByTestId('checkout-total')).toHaveText('1.906 ETH')
    await showPayerFields(page, isMobile)
    await checkoutForm(page).getByLabel(/^Observação do colecionador/).fill('Outra observação')

    await openReview(page)
    await expect(reviewDialog(page)).toContainText('Um pedido anterior ainda aguarda confirmação')
    await sendButton(page).click()
    await expect(page).toHaveURL(`/pedidos/${created.id}`)
    const orders = await listOrders(page)
    expect(orders.map((order) => order.id)).toEqual([created.id])
    expect(orders[0].snapshot.total).toBe('1.706')
    expect(new Set(posts.map((post) => post.headers()['idempotency-key'])).size).toBe(1)
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
