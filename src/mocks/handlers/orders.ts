import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import {
  createOrderInputSchema,
  isValidSecondaryWallet,
  isValidWalletAddress,
  orderSchema,
  orderStatusSchema,
  WALLET_ADDRESS_ERROR,
  WALLET_SECONDARY_ERROR,
  type CreateOrderInput,
  type Order,
  type Quote,
} from '@/shared/contracts'
import { add } from '@/shared/lib/money'
import { stableStringify } from '@/shared/lib/stable-json'
import { getMockConfig } from '../config'
import { getDb, mutate } from '../db/store'
import type { CartRecord, MockDb, OrderRecord, UserRecord } from '../db/schema'
import { apiError, withNetwork } from '../network'
import { computeQuote, isQuoteError, stableHash, type ApiErrorLike } from '../pricing'
import { commitNftUpdate } from '../realtime/commit'
import { resolveDueOrders, scheduleOrder } from '../realtime/order-scheduler'
import { once } from '../scenario-once'
import { SCENARIOS } from '../scenarios'
import { requireUser } from './auth'
import { resolveCart } from './cart'

/** Pending orders resolve this long after creation (order-scheduler.ts resolves them). */
export const ORDER_RESOLVE_MS = 2500

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type OrderError = ApiErrorLike & { details?: unknown }
export type PlaceOrderResult = { order: OrderRecord; created: boolean } | { error: OrderError }

/** Server-side fingerprint of a request body (key order does not matter). */
export function payloadHashOf(input: CreateOrderInput): string {
  return stableHash(stableStringify(input))
}

function randomHex(bytes: number): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes))
  return [...values].map((value) => value.toString(16).padStart(2, '0')).join('')
}

/** "0xA91F…E82C" for EVM addresses, "7xKX…AsU" for Solana. */
function shortAddress(address: string): string {
  if (/^0x/i.test(address)) {
    const body = address.slice(2).toUpperCase()
    return `0x${body.slice(0, 4)}…${body.slice(-4)}`
  }
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

function validationError(fieldErrors: Record<string, string[]>, message = 'Verifique os dados do pagamento'): OrderError {
  return { status: 422, code: 'VALIDATION_ERROR', message, fieldErrors }
}

function storeQuote(db: MockDb, cartId: string, quote: Quote): void {
  db.quotes.push({ cartId, quote })
}

/**
 * Core of POST /orders on a database (mutated in place): idempotency, wallet checks, quote revalidation,
 * stock, then a `pending` order with an immutable snapshot of the confirmed quote.
 */
export function placeOrder(
  db: MockDb,
  {
    user,
    cart,
    key,
    input,
    payloadHash,
    now,
    outcome,
    resolveMs = ORDER_RESOLVE_MS,
  }: {
    user: UserRecord
    cart: CartRecord
    key: string
    input: CreateOrderInput
    payloadHash: string
    now: Date
    outcome: 'confirmed' | 'declined'
    resolveMs?: number
  },
): PlaceOrderResult {
  // 1. Idempotency: the same key answers the same order (even if prices changed since), never a second one.
  const previous = db.idempotency.find((record) => record.userId === user.id && record.key === key)
  if (previous) {
    if (previous.payloadHash !== payloadHash) {
      return {
        error: {
          status: 409,
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Esta tentativa de compra já foi usada com outros dados',
        },
      }
    }
    const order = db.orders.find((o) => o.id === previous.orderId)
    if (order) return { order, created: false }
  }

  // 2. Wallet and payer addresses, validated for the network.
  let walletLabel = shortAddress(input.payer.walletAddress)
  if (input.walletId !== null) {
    const wallet = db.wallets.find((w) => w.id === input.walletId && w.userId === user.id)
    if (!wallet) return { error: validationError({ walletId: ['Carteira não encontrada'] }) }
    if (wallet.network !== input.network) {
      return { error: validationError({ network: ['A rede não corresponde à carteira selecionada'] }) }
    }
    if (input.payer.walletAddress !== wallet.address) {
      return { error: validationError({ walletAddress: ['O endereço não corresponde à carteira selecionada'] }) }
    }
    walletLabel = wallet.nickname ? `${wallet.nickname} · ${shortAddress(wallet.address)}` : shortAddress(wallet.address)
  }
  const addressErrors: Record<string, string[]> = {}
  if (!isValidWalletAddress(input.network, input.payer.walletAddress)) addressErrors.walletAddress = [WALLET_ADDRESS_ERROR]
  const secondary = input.payer.secondaryAddress
  if (secondary && !isValidSecondaryWallet(input.network, secondary)) addressErrors.secondaryAddress = [WALLET_SECONDARY_ERROR]
  if (Object.keys(addressErrors).length > 0) return { error: validationError(addressErrors) }

  // 3. Re-price the cart now and compare with the quote the collector confirmed.
  const stored = db.quotes.find((q) => q.cartId === cart.id && q.quote.quoteId === input.quoteId)?.quote
  const fresh = computeQuote(db, cart, { coupon: stored?.coupon?.code, network: input.network, now })
  if (isQuoteError(fresh)) return { error: fresh }
  if (fresh.lines.length === 0) return { error: validationError({}, 'Seu carrinho está vazio') }

  const short = fresh.lines.filter((line) => line.quantity > line.available)
  if (short.length > 0) {
    storeQuote(db, cart.id, fresh)
    return {
      error: {
        status: 409,
        code: 'OUT_OF_STOCK',
        message: 'Alguns itens não têm mais estoque suficiente',
        details: {
          quote: fresh,
          lines: short.map((line) => ({
            lineId: line.lineId,
            nftId: line.nftId,
            name: db.nfts.find((n) => n.id === line.nftId)?.name ?? line.nftId,
            available: line.available,
          })),
        },
      },
    }
  }

  const expired = !stored || Date.parse(stored.expiresAt) <= now.getTime()
  if (expired || stored.fingerprint !== fresh.fingerprint || stored.network !== input.network) {
    storeQuote(db, cart.id, fresh)
    return {
      error: {
        status: 409,
        code: 'QUOTE_STALE',
        message: 'Os valores do pedido mudaram. Confirme o novo valor.',
        details: { quote: fresh },
      },
    }
  }

  // 4. Create the pending order from the confirmed quote (snapshot never changes afterwards).
  const lines = stored.lines.map((line) => {
    const nft = db.nfts.find((n) => n.id === line.nftId)!
    const edition = nft.editions.find((e) => e.id === line.editionId)!
    return {
      nftId: line.nftId,
      name: nft.name,
      art: nft.art,
      tokenNumber: nft.tokenNumber,
      editionId: edition.id,
      editionLabel: edition.label,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
    }
  })
  const id = `ord_${randomHex(6)}`
  const txHash = `0x${randomHex(32)}`
  const order: OrderRecord = {
    id,
    status: 'pending',
    version: 1,
    createdAt: now.toISOString(),
    resolvedAt: null,
    declineReason: null,
    txHash,
    // Fictional testnet explorer (reserved .example domain): clearly a simulation.
    explorerUrl: `https://explorer.kurio.example/testnet/tx/${txHash}`,
    snapshot: {
      lines,
      subtotal: stored.subtotal,
      discount: stored.discount,
      networkFee: stored.networkFee,
      total: stored.total,
      walletLabel,
      network: stored.network,
    },
    userId: user.id,
    idempotencyKey: key,
    payloadHash,
    resolveAt: new Date(now.getTime() + resolveMs).toISOString(),
    plannedOutcome: outcome,
  }
  db.orders.push(order)
  db.idempotency.push({ key, userId: user.id, payloadHash, orderId: id })
  db.resourceVersions[`order:${id}`] = 1
  return { order, created: true }
}

/** Public shape (strips userId, idempotency data, plannedOutcome…). */
function toOrder(record: OrderRecord): Order {
  return orderSchema.parse(record)
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

/**
 * Longest a "never answered" order request stays open. The client gives up at 10 s, but through the
 * Service Worker its abort does not always reach the handler, so the request is closed here at the latest.
 */
export const HANG_LIMIT_MS = 15_000

/** Leaves the request unanswered: it ends as a network error on client abort, or after HANG_LIMIT_MS. */
function hang(request: Request): Promise<Response> {
  if (request.signal.aborted) return Promise.resolve(HttpResponse.error())
  return new Promise((resolve) => {
    const end = () => {
      clearTimeout(timer)
      request.signal.removeEventListener('abort', end)
      resolve(HttpResponse.error())
    }
    const timer = setTimeout(end, HANG_LIMIT_MS)
    request.signal.addEventListener('abort', end, { once: true })
  })
}

const listQuerySchema = z.object({ status: orderStatusSchema.optional() })

export const orderHandlers = [
  http.post(
    '/api/orders',
    withNetwork(async ({ request }) => {
      const user = requireUser(request)
      if (user instanceof Response) return user
      const key = request.headers.get('Idempotency-Key')
      if (!key || !UUID.test(key)) {
        return apiError(422, 'VALIDATION_ERROR', 'Cabeçalho Idempotency-Key ausente ou inválido')
      }
      const parsed = createOrderInputSchema.safeParse(await readJson(request))
      if (!parsed.success) {
        return apiError(
          422,
          'VALIDATION_ERROR',
          'Verifique os dados do pagamento',
          z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        )
      }
      const cart = resolveCart(request)
      if (cart instanceof Response) return cart

      const flags = SCENARIOS[getMockConfig().scenario].flags
      // Scenario sold-out: the edition of the first cart line sells out right before the first order request.
      const first = cart.lines[0]
      if (flags?.soldOutOnOrder && first && once(`sold-out:${user.id}`)) {
        commitNftUpdate(first.nftId, { editions: [{ id: first.editionId, available: 0 }] })
      }

      const input = parsed.data
      const result = mutate((db) =>
        placeOrder(db, {
          user,
          cart,
          key,
          input,
          payloadHash: payloadHashOf(input),
          now: new Date(),
          outcome: flags?.orderOutcome ?? 'confirmed',
          resolveMs: flags?.orderResolveMs,
        }),
      )
      if ('error' in result) {
        const { status, code, message, fieldErrors, details } = result.error
        return apiError(status, code, message, fieldErrors, details)
      }
      // Scenario order-timeout: the order exists, but the first request with that key never gets an answer.
      if (result.created) scheduleOrder(result.order)
      if (flags?.orderTimeout && result.created && once(`order-timeout:${key}`)) return hang(request)
      return HttpResponse.json(toOrder(result.order), { status: result.created ? 201 : 200 })
    }),
  ),

  // The signed-in user's orders, newest first (`?status=pending` for the pending ones).
  http.get(
    '/api/orders',
    withNetwork(({ request }) => {
      const user = requireUser(request)
      if (user instanceof Response) return user
      const query = listQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
      if (!query.success) return apiError(422, 'VALIDATION_ERROR', 'Filtro de pedidos inválido')
      resolveDueOrders()
      const orders = getDb()
        .orders.filter((o) => o.userId === user.id && (!query.data.status || o.status === query.data.status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toOrder)
      return HttpResponse.json(orders)
    }),
  ),

  // One order of the signed-in user, resolved first if its confirmation is due (survives reloads).
  http.get(
    '/api/orders/:orderId',
    withNetwork(({ request, params }) => {
      const user = requireUser(request)
      if (user instanceof Response) return user
      resolveDueOrders()
      const order = getDb().orders.find((o) => o.id === params.orderId)
      if (!order) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado')
      if (order.userId !== user.id) return apiError(403, 'FORBIDDEN', 'Este pedido pertence a outra conta')
      return HttpResponse.json(toOrder(order))
    }),
  ),
]

/** Price-change scenario helper for the quote handler: +0.10 ETH on the first line's NFT. */
export function raiseFirstLinePrice(db: MockDb, cart: CartRecord): void {
  const first = cart.lines[0]
  const nft = first && db.nfts.find((n) => n.id === first.nftId)
  if (nft) commitNftUpdate(nft.id, { price: add(nft.price, '0.10') })
}
