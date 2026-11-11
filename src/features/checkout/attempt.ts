import { z } from 'zod'
import { createOrderInputSchema, quoteSchema, type CreateOrderInput } from '@/shared/contracts'
import { clearAttempt, getAttempt, peekAttempt } from '@/shared/lib/idempotency'

/** What the review showed for an attempt: replaying it shows exactly this, never the current screen. */
export const attemptDisplaySchema = z.object({
  quote: quoteSchema,
  walletLabel: z.string(),
  connectorLabel: z.string(),
  networkLabel: z.string(),
})
export type AttemptDisplay = z.infer<typeof attemptDisplaySchema>

export interface StoredAttempt {
  key: string
  payload: CreateOrderInput
  display: AttemptDisplay
}

/** The user's unresolved order attempt, validated (storage is untrusted); an unreadable one is dropped. */
export function readAttempt(userId: string): StoredAttempt | null {
  const stored = peekAttempt(userId)
  if (!stored) return null
  const payload = createOrderInputSchema.safeParse(stored.payload)
  const display = attemptDisplaySchema.safeParse(stored.meta)
  if (!payload.success || !display.success) {
    clearAttempt(userId)
    return null
  }
  return { key: stored.key, payload: payload.data, display: display.data }
}

/**
 * Stores a new attempt (payload + review snapshot) before it is sent, or returns the unresolved one
 * (`reused`), whose own payload and snapshot must then be used instead of the current ones.
 */
export function startAttempt(
  userId: string,
  payloadHash: string,
  payload: CreateOrderInput,
  display: AttemptDisplay,
): StoredAttempt & { reused: boolean } {
  const attempt = getAttempt(userId, payloadHash, payload, display)
  if (!attempt.reused) return { key: attempt.key, payload, display, reused: false }
  const stored = readAttempt(userId)
  if (stored) return { ...stored, reused: true }
  // The stored one was unreadable and is gone: start over with this payload.
  return { ...startAttempt(userId, payloadHash, payload, display) }
}
