const COUPON_PATTERN = /^[A-Z0-9_-]{1,32}$/i

/**
 * `?cupom=` as it may travel in URLs (cart → checkout): trimmed, uppercased, 1–32 of [A-Z0-9_-].
 * Anything else is dropped, so arbitrary text never reaches the input, the quote request or a link.
 */
export function parseCouponParam(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const code = raw.trim()
  return COUPON_PATTERN.test(code) ? code.toUpperCase() : undefined
}
