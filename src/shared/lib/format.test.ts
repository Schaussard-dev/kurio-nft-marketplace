import { describe, expect, it } from 'vitest'
import { formatDate, formatDiscount, formatEth, shortHash } from './format'

describe('format', () => {
  it('formats ETH with min 2 decimals', () => {
    expect(formatEth('1.5')).toBe('1.50 ETH')
    expect(formatEth('26.846')).toBe('26.846 ETH')
    expect(formatEth('0.016')).toBe('0.016 ETH')
    expect(formatEth('2')).toBe('2.00 ETH')
    expect(formatEth('1.5', { minDecimals: 0 })).toBe('1.5 ETH')
  })
  it('formats discount', () => {
    expect(formatDiscount('0')).toBe('(-) 00.00')
    expect(formatDiscount('0.00')).toBe('(-) 00.00')
    expect(formatDiscount('0.89')).toBe('(-) 0.89 ETH')
  })
  it('formats date in UTC', () => {
    expect(formatDate('2026-07-29T12:00:00Z')).toBe('29 Jul, 2026')
    expect(formatDate('2026-01-01T00:30:00Z')).toBe('1 Jan, 2026')
  })
  it('shortens hash', () => {
    expect(shortHash('0xa91f0000000000000000000000000000000ee82c')).toBe('0xA91F…E82C')
  })
})
