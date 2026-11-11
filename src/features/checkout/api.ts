import { z } from 'zod'
import { ApiError } from '@/shared/api/api-error'
import { request } from '@/shared/api/http'
import { orderSchema, type CreateOrderInput, type Order, type OrderStatus } from '@/shared/contracts'

/** Client deadline for POST /orders (spec: 10 s), a timer of its own so it follows the page clock. */
export const ORDER_TIMEOUT_MS = 10_000

/**
 * Places the order with its idempotency key. A missed deadline rejects with `TIMEOUT`: the order may
 * exist, so the caller resends with the SAME key (the API then answers the existing order).
 */
export async function createOrder(input: CreateOrderInput, idempotencyKey: string): Promise<Order> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, ORDER_TIMEOUT_MS)
  try {
    return await request(
      {
        url: '/orders',
        method: 'POST',
        data: input,
        headers: { 'Idempotency-Key': idempotencyKey },
        signal: controller.signal,
      },
      orderSchema,
    )
  } catch (error) {
    if (timedOut) throw new ApiError({ status: 0, code: 'TIMEOUT', message: 'A requisição demorou demais.' })
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export function fetchOrders(status?: OrderStatus, signal?: AbortSignal): Promise<Order[]> {
  return request({ url: '/orders', method: 'GET', params: status ? { status } : undefined, signal }, z.array(orderSchema))
}
