import { z } from 'zod'
import { networkSchema } from '@/shared/contracts'

export const CONNECTORS = ['metamask', 'walletconnect', 'coinbase'] as const
export type Connector = (typeof CONNECTORS)[number]

/** Value of the wallet choice for a wallet typed in by hand ("Usar outra carteira?"). */
export const MANUAL_WALLET = 'manual'

/**
 * What the collector typed on /pagamento (payer fields, wallet/connector/network choice, note).
 * Never secrets: it survives a session expiry in sessionStorage and is restored after the new login.
 */
export const checkoutDraftSchema = z.object({
  displayName: z.string(),
  username: z.string(),
  network: z.union([networkSchema, z.literal('')]),
  profileName: z.string(),
  walletAddress: z.string(),
  secondaryAddress: z.string(),
  connector: z.union([z.enum(CONNECTORS), z.literal('')]),
  referralCode: z.string(),
  email: z.string(),
  ensName: z.string(),
  /** A registered wallet id, or MANUAL_WALLET. */
  walletChoice: z.string(),
  note: z.string(),
  /** Registered wallets when the draft was saved: a wallet created afterwards is preferred on restore. */
  knownWalletIds: z.array(z.string()).default([]),
})
export type CheckoutDraft = z.infer<typeof checkoutDraftSchema>

const PREFIX = 'kurio-checkout-draft:'
const draftKey = (userId: string) => `${PREFIX}${userId}`

export function saveCheckoutDraft(userId: string, values: CheckoutDraft): void {
  try {
    sessionStorage.setItem(draftKey(userId), JSON.stringify(checkoutDraftSchema.parse(values)))
  } catch {
    // Storage unavailable or full: the draft is a convenience, the form keeps working.
  }
}

/** The user's saved draft; null when absent or unreadable (storage is untrusted input). */
export function loadCheckoutDraft(userId: string): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(userId))
    if (!raw) return null
    const parsed = checkoutDraftSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function clearCheckoutDraft(userId: string): void {
  try {
    sessionStorage.removeItem(draftKey(userId))
  } catch {
    // nothing to clear
  }
}

/** Logout and user switch drop every draft (spec §8: only an expiry keeps it). */
export function clearAllCheckoutDrafts(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(PREFIX)) keys.push(key)
    }
    keys.forEach((key) => sessionStorage.removeItem(key))
  } catch {
    // nothing to clear
  }
}
