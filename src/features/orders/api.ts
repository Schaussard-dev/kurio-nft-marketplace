import { request } from '@/shared/api/http'
import { orderSchema, type Order } from '@/shared/contracts'

/** One order of the signed-in user (403 for another user's order, 404 when it does not exist). */
export function fetchOrder(orderId: string, signal?: AbortSignal): Promise<Order> {
  return request({ url: `/orders/${encodeURIComponent(orderId)}`, method: 'GET', signal }, orderSchema)
}
