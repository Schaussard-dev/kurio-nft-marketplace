import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import {
  sameAsPrimaryInputSchema,
  walletSchema,
  walletInputSchema,
  type Wallet,
  type WalletConnection,
  type WalletInput,
  type WalletsResponse,
} from '@/shared/contracts'
import { getMockConfig } from '../config'
import { getDb, mutate } from '../db/store'
import type { WalletRecord } from '../db/schema'
import { apiError, withNetwork } from '../network'
import { SCENARIOS } from '../scenarios'
import { requireUser } from './auth'

type Slot = Wallet['slot']
type FieldErrors = Record<string, string[]>

const SAME_AS_PRIMARY_ERROR = 'Cadastre a carteira principal primeiro'
const SECONDARY_ONLY_ERROR = 'Disponível apenas para a carteira secundária'

// The schema strips the internal userId.
function toWallet(record: WalletRecord): Wallet {
  return walletSchema.parse(record)
}

export function listWallets(wallets: WalletRecord[], userId: string): WalletsResponse {
  const own = wallets.filter((w) => w.userId === userId)
  const bySlot = (slot: Slot) => {
    const found = own.find((w) => w.slot === slot)
    return found ? toWallet(found) : null
  }
  return { primary: bySlot('primary'), secondary: bySlot('secondary') }
}

/**
 * Validates an upsert body for a slot. "Igual à carteira principal" (secondary only) copies the
 * primary wallet and requires it to exist; otherwise the body must satisfy `walletInputSchema`.
 */
export function resolveWalletInput(
  slot: Slot,
  body: unknown,
  primary: WalletInput | null,
): { input: WalletInput } | { fieldErrors: FieldErrors } {
  if (sameAsPrimaryInputSchema.safeParse(body).success) {
    if (slot === 'primary') return { fieldErrors: { sameAsPrimary: [SECONDARY_ONLY_ERROR] } }
    if (!primary) return { fieldErrors: { sameAsPrimary: [SAME_AS_PRIMARY_ERROR] } }
    return { input: { ...primary, sameAsPrimary: true } }
  }

  const parsed = walletInputSchema.safeParse(body)
  if (!parsed.success)
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors as FieldErrors,
    }
  const fieldErrors: FieldErrors = {}
  if (slot === 'primary' && parsed.data.sameAsPrimary) fieldErrors.sameAsPrimary = [SECONDARY_ONLY_ERROR]
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }
  return { input: parsed.data }
}

/** "Igual à carteira principal": a secondary flagged as a copy follows every edit of the primary. */
export function syncSecondary(secondary: WalletRecord | undefined, primary: WalletRecord): WalletRecord | undefined {
  if (!secondary?.sameAsPrimary) return secondary
  return { ...primary, id: secondary.id, slot: 'secondary', sameAsPrimary: true }
}

export type ConnectResult = { connection: WalletConnection } | { error: 'NOT_FOUND' | 'WALLET_REJECTED' }

/** Connector ids accepted for a wallet typed in by hand at checkout ("Usar outra carteira?"). */
export const CONNECTOR_IDS = ['metamask', 'walletconnect', 'coinbase'] as const

/**
 * Simulated wallet approval for a wallet the user owns, or for a connector id (manual wallet);
 * `rejected` is the wallet-reject scenario flag.
 */
export function resolveConnect(
  wallets: WalletRecord[],
  userId: string,
  walletId: string,
  rejected: boolean,
): ConnectResult {
  const known =
    (CONNECTOR_IDS as readonly string[]).includes(walletId) ||
    wallets.some((w) => w.id === walletId && w.userId === userId)
  if (!known) return { error: 'NOT_FOUND' }
  if (rejected) return { error: 'WALLET_REJECTED' }
  return { connection: { connected: true, sessionId: `wcs_${globalThis.crypto.randomUUID()}` } }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

function upsertHandler(slot: Slot) {
  return http.put(
    `/api/wallets/${slot}`,
    withNetwork(async ({ request }) => {
      const user = requireUser(request)
      if (user instanceof Response) return user
      const current = getDb().wallets.filter((w) => w.userId === user.id)
      const primary = current.find((w) => w.slot === 'primary')
      const result = resolveWalletInput(slot, await readJson(request), primary ? toWallet(primary) : null)
      if ('fieldErrors' in result) {
        return apiError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados', result.fieldErrors)
      }

      const existing = current.find((w) => w.slot === slot)
      const record: WalletRecord = {
        ...result.input,
        id: existing?.id ?? `wlt_${user.id.replace(/^usr_/, '')}_${slot}`,
        slot,
        userId: user.id,
      }
      const secondary =
        slot === 'primary'
          ? syncSecondary(
              current.find((w) => w.slot === 'secondary'),
              record,
            )
          : undefined
      mutate((db) => {
        const replaced = new Set<WalletRecord>(
          [existing, secondary && current.find((w) => w.slot === 'secondary')].filter((w): w is WalletRecord =>
            Boolean(w),
          ),
        )
        db.wallets = [...db.wallets.filter((w) => !replaced.has(w)), record, ...(secondary ? [secondary] : [])]
      })
      return HttpResponse.json(toWallet(record), {
        status: existing ? 200 : 201,
      })
    }),
  )
}

export const walletHandlers = [
  http.get(
    '/api/wallets',
    withNetwork(({ request }) => {
      const user = requireUser(request)
      if (user instanceof Response) return user
      return HttpResponse.json(listWallets(getDb().wallets, user.id))
    }),
  ),
  upsertHandler('primary'),
  upsertHandler('secondary'),

  // Simulated wallet approval; scenario `wallet-reject` makes the user refuse it.
  http.post(
    '/api/wallets/:id/connect',
    withNetwork(({ request, params }) => {
      const user = requireUser(request)
      if (user instanceof Response) return user
      const result = resolveConnect(
        getDb().wallets,
        user.id,
        String(params.id),
        Boolean(SCENARIOS[getMockConfig().scenario].flags?.walletReject),
      )
      if ('connection' in result) return HttpResponse.json(result.connection)
      return result.error === 'NOT_FOUND'
        ? apiError(404, 'NOT_FOUND', 'Carteira não encontrada')
        : apiError(409, 'WALLET_REJECTED', 'A conexão foi recusada na carteira')
    }),
  ),
]
