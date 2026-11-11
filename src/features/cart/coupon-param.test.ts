import { describe, expect, it } from 'vitest'
import { parseCouponParam } from './coupon-param'

describe('parseCouponParam', () => {
  it('keeps a well-formed code, trimmed and uppercased', () => {
    expect(parseCouponParam(' kurio10 ')).toBe('KURIO10')
    expect(parseCouponParam('LANC_2024-B')).toBe('LANC_2024-B')
  })

  it('drops anything that is not a short code', () => {
    expect(parseCouponParam(undefined)).toBeUndefined()
    expect(parseCouponParam(42)).toBeUndefined()
    expect(parseCouponParam('')).toBeUndefined()
    expect(parseCouponParam('   ')).toBeUndefined()
    expect(parseCouponParam('A'.repeat(33))).toBeUndefined()
    expect(parseCouponParam('<script>')).toBeUndefined()
    expect(parseCouponParam('KURIO 10')).toBeUndefined()
  })

  it('accepts exactly 32 characters', () => {
    expect(parseCouponParam('A'.repeat(32))).toBe('A'.repeat(32))
  })
})
