import { http, HttpResponse } from 'msw'
import { quoteInputSchema } from '@/shared/contracts'
import { getDb, mutate } from '../db/store'
import { apiError, withNetwork } from '../network'
import { computeQuote, isQuoteError } from '../pricing'
import { resolveCart } from './cart'

/** Quotes kept per cart (orders only need the latest ones; expired quotes are pruned). */
const QUOTES_PER_CART = 20

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

export const quoteHandlers = [
  // Prices the scoped cart (user cart with a valid token, else the X-Cart-Id guest cart) and stores the quote.
  http.post(
    '/api/quote',
    withNetwork(async ({ request }) => {
      const cart = resolveCart(request)
      if (cart instanceof Response) return cart
      const parsed = quoteInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Dados da cotação inválidos')
      const now = new Date()
      const result = computeQuote(getDb(), cart, { ...parsed.data, now })
      if (isQuoteError(result)) return apiError(result.status, result.code, result.message, result.fieldErrors)
      mutate((db) => {
        const live = db.quotes.filter((q) => Date.parse(q.quote.expiresAt) > now.getTime())
        const others = live.filter((q) => q.cartId !== cart.id)
        const own = live.filter((q) => q.cartId === cart.id).slice(-(QUOTES_PER_CART - 1))
        db.quotes = [...others, ...own, { cartId: cart.id, quote: result }]
      })
      return HttpResponse.json(result)
    }),
  ),
]
