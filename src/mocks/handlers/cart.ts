import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import {
  addCartItemInputSchema,
  updateCartItemInputSchema,
  type Cart,
  type Edition,
  type MergeCartResult,
} from '@/shared/contracts'
import { getDb, mutate } from '../db/store'
import type { CartRecord, MockDb } from '../db/schema'
import { apiError, withNetwork } from '../network'
import { requireUser } from './auth'
import { toSummary } from './nfts'

type Adjustment = MergeCartResult['adjustments'][number]

const GUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const mergeInputSchema = z.object({ guestCartId: z.string().regex(GUEST_ID_PATTERN) })

/** Most a single cart line may hold: the stock left and the per-order cap. */
export function lineLimit(edition: Edition): number {
  return Math.min(edition.available, edition.maxPerOrder)
}

export function newLineId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(6))
  return `ln_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

const stockMessage = (max: number) =>
  max === 0 ? 'Esgotado' : `Apenas ${max} ${max === 1 ? 'disponível' : 'disponíveis'}`

function findEdition(db: Pick<MockDb, 'nfts'>, nftId: string, editionId: string) {
  const nft = db.nfts.find((n) => n.id === nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  return nft && edition ? { nft, edition } : null
}

/** Cart record → contract shape (joins the NFT summary and edition; drops lines whose NFT is gone). */
export function toCartResponse(db: Pick<MockDb, 'nfts'>, cart: CartRecord): Cart {
  return {
    id: cart.id,
    owner: { ...cart.owner },
    version: cart.version,
    lines: cart.lines.flatMap((line) => {
      const found = findEdition(db, line.nftId, line.editionId)
      if (!found) return []
      return [{ ...line, nft: toSummary(found.nft), edition: { ...found.edition } }]
    }),
  }
}

/**
 * Moves guest lines into the user cart (mutates `userCart`): quantities of the same NFT edition are
 * summed, then every merged line is limited to `lineLimit`; lines limited to 0 are dropped. Returns
 * one adjustment per line that could not keep the requested quantity.
 */
export function mergeGuestLines(
  db: Pick<MockDb, 'nfts'>,
  userCart: CartRecord,
  guestCart: CartRecord,
  makeLineId: () => string = newLineId,
): Adjustment[] {
  const adjustments: Adjustment[] = []
  for (const guestLine of guestCart.lines) {
    const found = findEdition(db, guestLine.nftId, guestLine.editionId)
    if (!found) continue
    let line = userCart.lines.find((l) => l.nftId === guestLine.nftId && l.editionId === guestLine.editionId)
    if (!line) {
      line = { lineId: makeLineId(), nftId: guestLine.nftId, editionId: guestLine.editionId, quantity: 0 }
      userCart.lines.push(line)
    }
    const requested = line.quantity + guestLine.quantity
    const applied = Math.min(requested, lineLimit(found.edition))
    line.quantity = applied
    if (applied < requested) {
      adjustments.push({ lineId: line.lineId, nftId: line.nftId, name: found.nft.name, requested, applied, reason: 'stock' })
    }
  }
  userCart.lines = userCart.lines.filter((line) => line.quantity > 0)
  return adjustments
}

function findOrCreateCart(owner: CartRecord['owner']): CartRecord {
  const existing = getDb().carts.find((c) => c.owner.type === owner.type && c.owner.id === owner.id)
  if (existing) return existing
  const cart: CartRecord = {
    id: owner.type === 'user' ? `crt_${owner.id}` : `crt_guest_${owner.id}`,
    owner,
    lines: [],
    version: 1,
  }
  mutate((db) => {
    db.carts.push(cart)
  })
  return cart
}

/**
 * The cart a request acts on. A request carrying `Authorization` always uses the user's cart, even
 * though the client also sends `X-Cart-Id` (an invalid token answers 401, never the guest cart).
 * Otherwise the guest cart of `X-Cart-Id`, created on first touch.
 */
export function resolveCart(request: Request): CartRecord | Response {
  if (request.headers.has('Authorization')) {
    const user = requireUser(request)
    if (user instanceof Response) return user
    return findOrCreateCart({ type: 'user', id: user.id })
  }
  const guestId = request.headers.get('X-Cart-Id')
  if (!guestId || !GUEST_ID_PATTERN.test(guestId)) {
    return apiError(422, 'VALIDATION_ERROR', 'Identificador de carrinho inválido')
  }
  return findOrCreateCart({ type: 'guest', id: guestId })
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

const invalidBody = () => apiError(422, 'VALIDATION_ERROR', 'Dados do carrinho inválidos')
const outOfStock = (max: number) => apiError(409, 'OUT_OF_STOCK', stockMessage(max), undefined, { max })

/** Every mutation answers the whole updated cart, so the client can replace its cache. */
const cartResponse = (cart: CartRecord) => HttpResponse.json(toCartResponse(getDb(), cart))

export const cartHandlers = [
  http.get(
    '/api/cart',
    withNetwork(({ request }) => {
      const cart = resolveCart(request)
      return cart instanceof Response ? cart : cartResponse(cart)
    }),
  ),

  // Same NFT edition → one line (quantities summed). The line may never exceed lineLimit: 409 OUT_OF_STOCK.
  http.post(
    '/api/cart/items',
    withNetwork(async ({ request }) => {
      const cart = resolveCart(request)
      if (cart instanceof Response) return cart
      const parsed = addCartItemInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return invalidBody()
      const { nftId, editionId, quantity } = parsed.data
      const found = findEdition(getDb(), nftId, editionId)
      if (!found) return apiError(404, 'NOT_FOUND', 'NFT ou edição não encontrada')
      const line = cart.lines.find((l) => l.nftId === nftId && l.editionId === editionId)
      const max = lineLimit(found.edition)
      if ((line?.quantity ?? 0) + quantity > max) return outOfStock(max)
      mutate(() => {
        if (line) line.quantity += quantity
        else cart.lines.push({ lineId: newLineId(), nftId, editionId, quantity })
        cart.version += 1
      })
      return cartResponse(cart)
    }),
  ),

  http.patch(
    '/api/cart/items/:lineId',
    withNetwork(async ({ request, params }) => {
      const cart = resolveCart(request)
      if (cart instanceof Response) return cart
      const parsed = updateCartItemInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return invalidBody()
      const line = cart.lines.find((l) => l.lineId === String(params.lineId))
      if (!line) return apiError(404, 'NOT_FOUND', 'Item não está no carrinho')
      const found = findEdition(getDb(), line.nftId, line.editionId)
      if (!found) return apiError(404, 'NOT_FOUND', 'NFT ou edição não encontrada')
      const max = lineLimit(found.edition)
      // Lowering is always allowed (e.g. down towards the stock left); raising past the limit is not.
      if (parsed.data.quantity > max && parsed.data.quantity > line.quantity) return outOfStock(max)
      mutate(() => {
        line.quantity = parsed.data.quantity
        cart.version += 1
      })
      return cartResponse(cart)
    }),
  ),

  // Idempotent: removing a line that is already gone still answers the cart.
  http.delete(
    '/api/cart/items/:lineId',
    withNetwork(({ request, params }) => {
      const cart = resolveCart(request)
      if (cart instanceof Response) return cart
      const lineId = String(params.lineId)
      if (cart.lines.some((l) => l.lineId === lineId)) {
        mutate(() => {
          cart.lines = cart.lines.filter((l) => l.lineId !== lineId)
          cart.version += 1
        })
      }
      return cartResponse(cart)
    }),
  ),

  // Idempotent: the guest cart is deleted once merged, so repeating the call changes nothing.
  http.post(
    '/api/cart/merge',
    withNetwork(async ({ request }) => {
      const user = requireUser(request)
      if (user instanceof Response) return user
      const parsed = mergeInputSchema.safeParse(await readJson(request))
      if (!parsed.success) return invalidBody()
      const userCart = findOrCreateCart({ type: 'user', id: user.id })
      const guestCart = getDb().carts.find((c) => c.owner.type === 'guest' && c.owner.id === parsed.data.guestCartId)
      const adjustments = mutate((db) => {
        if (!guestCart) return []
        const result = mergeGuestLines(db, userCart, guestCart)
        if (guestCart.lines.length > 0) userCart.version += 1
        db.carts = db.carts.filter((c) => c !== guestCart)
        return result
      })
      const body: MergeCartResult = { cart: toCartResponse(getDb(), userCart), adjustments }
      return HttpResponse.json(body)
    }),
  ),
]
