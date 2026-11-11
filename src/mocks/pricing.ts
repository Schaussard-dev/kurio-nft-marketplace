import type { ApiErrorCode, Network, Quote } from '@/shared/contracts'
import { add, mul, percentOf, sub, sum, type EthString } from '@/shared/lib/money'
import type { CartRecord, CouponRecord, NftRecord } from './db/schema'

/** Estimated network fee per network (spec §6). */
export const NETWORK_FEES: Record<Network, EthString> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}

export const QUOTE_TTL_MS = 10 * 60_000

export interface ApiErrorLike {
  status: number
  code: ApiErrorCode
  message: string
  fieldErrors?: Record<string, string[]>
}

export function isQuoteError(result: Quote | ApiErrorLike): result is ApiErrorLike {
  return 'code' in result && 'status' in result
}

/** FNV-1a (two 32-bit lanes): stable, dependency-free fingerprint; not a security hash. */
function stableHash(text: string): string {
  let a = 0x811c9dc5
  let b = 0x01000193 ^ text.length
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    a = Math.imul(a ^ code, 0x01000193) >>> 0
    b = Math.imul(b ^ code, 0x01000193 + 2) >>> 0
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`
}

type CouponResult = { coupon: CouponRecord | null } | { error: ApiErrorLike }

function resolveCoupon(coupons: CouponRecord[], raw: string | undefined, now: Date): CouponResult {
  const code = raw?.trim().toUpperCase()
  if (!code) return { coupon: null }
  const coupon = coupons.find((c) => c.code === code)
  if (!coupon) {
    return {
      error: { status: 422, code: 'COUPON_INVALID', message: 'Cupom inválido', fieldErrors: { coupon: ['Cupom inválido'] } },
    }
  }
  if (coupon.expiresAt !== null && Date.parse(coupon.expiresAt) <= now.getTime()) {
    return {
      error: { status: 422, code: 'COUPON_EXPIRED', message: 'Cupom expirado', fieldErrors: { coupon: ['Cupom expirado'] } },
    }
  }
  return { coupon }
}

/**
 * Pure pricing of a cart: subtotal = Σ unitPrice × qty, discount = coupon % of the subtotal,
 * total = subtotal − discount + network fee. The discount never exceeds the subtotal, so no
 * intermediate value is negative. Lines whose NFT or edition no longer exists are left out.
 */
export function computeQuote(
  db: { nfts: NftRecord[]; coupons: CouponRecord[] },
  cart: CartRecord,
  { coupon: rawCoupon, network, now }: { coupon?: string; network: Network; now: Date },
): Quote | ApiErrorLike {
  const couponResult = resolveCoupon(db.coupons, rawCoupon, now)
  if ('error' in couponResult) return couponResult.error
  const { coupon } = couponResult

  const lines = cart.lines.flatMap((line) => {
    const nft = db.nfts.find((n) => n.id === line.nftId)
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!nft || !edition) return []
    return [
      {
        lineId: line.lineId,
        nftId: line.nftId,
        editionId: line.editionId,
        unitPrice: nft.price,
        quantity: line.quantity,
        lineTotal: mul(nft.price, line.quantity),
        available: edition.available,
      },
    ]
  })

  const subtotal = sum(lines.map((line) => line.lineTotal))
  const discount = coupon ? percentOf(subtotal, coupon.percent) : '0'
  const networkFee = NETWORK_FEES[network]
  const total = add(sub(subtotal, discount), networkFee)

  const fingerprint = stableHash(
    JSON.stringify([
      lines.map((line) => [line.lineId, line.unitPrice, line.quantity, line.available]),
      coupon?.code ?? null,
      network,
      networkFee,
    ]),
  )

  return {
    quoteId: `qt_${stableHash(`${fingerprint}:${cart.id}:${now.getTime()}`)}`,
    lines,
    subtotal,
    discount,
    networkFee,
    total,
    coupon: coupon ? { code: coupon.code, percent: coupon.percent } : null,
    network,
    expiresAt: new Date(now.getTime() + QUOTE_TTL_MS).toISOString(),
    fingerprint,
  }
}
