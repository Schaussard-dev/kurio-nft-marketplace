import type { CreateOrderInput } from '@/shared/contracts'
import { stableStringify } from '@/shared/lib/stable-json'

/** SHA-256 (Web Crypto) hex of the order payload; identifies "the same purchase attempt" for idempotency. */
export async function hashPayload(input: CreateOrderInput): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(input))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
