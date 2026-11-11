import { request } from '@/shared/api/http'
import {
  cartSchema,
  mergeCartResultSchema,
  quoteSchema,
  type AddCartItemInput,
  type Cart,
  type MergeCartResult,
  type Quote,
  type QuoteInput,
} from '@/shared/contracts'

// The API resolves the scope itself: user cart with a session token, else the X-Cart-Id guest cart.

export function fetchCart(signal?: AbortSignal): Promise<Cart> {
  return request({ url: '/cart', method: 'GET', signal }, cartSchema)
}

export function addCartItem(input: AddCartItemInput): Promise<Cart> {
  return request({ url: '/cart/items', method: 'POST', data: input }, cartSchema)
}

export function updateCartLine(lineId: string, quantity: number): Promise<Cart> {
  return request({ url: `/cart/items/${encodeURIComponent(lineId)}`, method: 'PATCH', data: { quantity } }, cartSchema)
}

export function removeCartLine(lineId: string): Promise<Cart> {
  return request({ url: `/cart/items/${encodeURIComponent(lineId)}`, method: 'DELETE' }, cartSchema)
}

export function mergeGuestCart(guestCartId: string): Promise<MergeCartResult> {
  return request({ url: '/cart/merge', method: 'POST', data: { guestCartId } }, mergeCartResultSchema)
}

export function fetchQuote(input: QuoteInput, signal?: AbortSignal): Promise<Quote> {
  return request({ url: '/quote', method: 'POST', data: input, signal }, quoteSchema)
}
