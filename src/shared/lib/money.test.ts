import { describe, expect, it } from 'vitest'
import { add, compare, isEthString, mul, percentOf, sub, sum } from './money'

describe('money', () => {
  it('adds without float error', () => {
    expect(add('0.1', '0.2')).toBe('0.3')
    expect(add('26.83', '0.016')).toBe('26.846')
  })
  it('subtracts', () => {
    expect(sub('1.5', '0.5')).toBe('1')
  })
  it('sums a list', () => {
    expect(sum(['2.38', '8.34', '16.11'])).toBe('26.83')
    expect(sum([])).toBe('0')
  })
  it('multiplies by integer quantity', () => {
    expect(mul('1.19', 2)).toBe('2.38')
  })
  it('computes percentage', () => {
    expect(percentOf('8.92', 10)).toBe('0.892')
  })
  it('compares numerically', () => {
    expect(compare('1.10', '1.1')).toBe(0)
    expect(compare('1', '2')).toBe(-1)
    expect(compare('3', '2')).toBe(1)
  })
  it('validates eth strings', () => {
    expect(isEthString('1e3')).toBe(false)
    expect(isEthString('-1')).toBe(false)
    expect(isEthString('1.')).toBe(false)
    expect(isEthString('1.5')).toBe(true)
    expect(isEthString('0.000000000000000001')).toBe(true)
    expect(isEthString('0.0000000000000000001')).toBe(false)
  })
  it('never emits exponents', () => {
    expect(add('0.000000000000000001', '0')).toBe('0.000000000000000001')
    expect(mul('100000000000000000000', 1000)).toBe('100000000000000000000000')
  })
  it('throws TypeError on invalid input', () => {
    expect(() => add('1e3', '1')).toThrow(TypeError)
    expect(() => sum(['1', 'abc'])).toThrow(TypeError)
    expect(() => compare('x', '1')).toThrow(/invalid/i)
  })
})
