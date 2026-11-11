import type { Page, Request } from '@playwright/test'
import { DEMO_USERS, expect, type DemoUser } from './fixtures'

/** Same-origin API call from inside the page (MSW answers there), with the stored session token. */
export async function apiJson<T>(
  page: Page,
  path: string,
  { method = 'GET', body }: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ({ path, method, body }) => {
      const session = JSON.parse(localStorage.getItem('kurio-session') ?? 'null') as { token: string } | null
      const res = await fetch(`/api${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(session && { authorization: `Bearer ${session.token}` }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return { status: res.status, body: (await res.json().catch(() => null)) as T }
    },
    { path, method, body },
  )
}

export interface OrderView {
  id: string
  status: string
  snapshot: { total: string; network: string; lines: { nftId: string; unitPrice: string; quantity: number }[] }
}

export async function listOrders(page: Page): Promise<OrderView[]> {
  const { status, body } = await apiJson<OrderView[]>(page, '/orders')
  expect(status).toBe(200)
  return body
}

/** Total of the quote the API gives now for the signed-in user's cart. */
export async function apiQuoteTotal(page: Page, network = 'ethereum'): Promise<string> {
  const { body } = await apiJson<{ total: string }>(page, '/quote', { method: 'POST', body: { network } })
  return body.total
}

export async function cartLines(page: Page): Promise<{ nftId: string; quantity: number }[]> {
  const { body } = await apiJson<{ lines: { nftId: string; quantity: number }[] }>(page, '/cart')
  return body.lines.map(({ nftId, quantity }) => ({ nftId, quantity }))
}

/** Fills the /entrar form already on screen (dialog on desktop, page on mobile). */
export async function fillLogin(page: Page, user: DemoUser) {
  const form = page.getByRole('form', { name: 'Entrar' })
  await form.getByRole('textbox', { name: /^E-mail/ }).fill(DEMO_USERS[user].email)
  await form.getByLabel(/^Senha/).fill(DEMO_USERS[user].password)
  await form.getByRole('button', { name: 'Entrar', exact: true }).click()
}

export const checkoutForm = (page: Page) => page.getByRole('form', { name: 'Pagamento' })
export const confirmButton = (page: Page) => page.getByRole('button', { name: 'Confirmar compra' })
export const reviewDialog = (page: Page) => page.getByRole('dialog', { name: 'Revise seu pedido' })
export const connectDialog = (page: Page) => page.getByRole('dialog', { name: 'Conectar carteira' })
export const sendButton = (page: Page) => reviewDialog(page).getByRole('button', { name: 'Enviar pedido' })

/** /pagamento loaded and prefilled: the summary total is on screen. */
export async function openCheckout(page: Page) {
  await page.goto('/pagamento')
  await expect(page.getByTestId('checkout-total')).toHaveText(/ETH$/)
}

/** On mobile the collector fields sit behind the "Dados do colecionador" disclosure. */
export async function showPayerFields(page: Page, isMobile: boolean) {
  if (!isMobile) return
  const toggle = page.getByRole('button', { name: 'Dados do colecionador' })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
}

/** Confirmar compra → wallet approval → the review dialog. */
export async function openReview(page: Page) {
  await confirmButton(page).click()
  await expect(reviewDialog(page)).toBeVisible()
}

/** Records the POST /api/orders requests of the page. */
export function recordOrderPosts(page: Page): Request[] {
  const posts: Request[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/orders') posts.push(request)
  })
  return posts
}

/** Records the text of every toast shown from now on (sonner removes them after a few seconds). */
export async function recordToasts(page: Page): Promise<() => Promise<string[]>> {
  // A string script: the e2e tsconfig has no DOM types.
  await page.evaluate(`(() => {
    const seen = []
    window.__toasts = seen
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue
          const toasts = node.matches('[data-sonner-toast]') ? [node] : [...node.querySelectorAll('[data-sonner-toast]')]
          toasts.forEach((toast) => seen.push(toast.textContent))
        }
      }
    }).observe(document.body, { childList: true, subtree: true })
  })()`)
  return () => page.evaluate<string[]>('window.__toasts')
}
