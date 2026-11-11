import { describe, expect, it } from 'vitest'
import type { Edition } from '@/shared/contracts'
import { clampQuantity, defaultEdition, resolveEdition } from './quantity'

const edition = (patch: Partial<Edition> = {}): Edition => ({
  id: 'e1',
  label: '1/10',
  available: 3,
  maxPerOrder: 10,
  ...patch,
})

describe('clampQuantity', () => {
  it('limits to the available stock', () => {
    expect(clampQuantity(5, edition())).toEqual({ value: 3, limited: true, max: 3 })
  })

  it('subtracts what is already in the cart', () => {
    expect(clampQuantity(5, edition(), 2)).toEqual({ value: 1, limited: true, max: 1 })
  })

  it('limits to maxPerOrder when stock is larger', () => {
    expect(clampQuantity(7, edition({ available: 50, maxPerOrder: 4 }))).toEqual({ value: 4, limited: true, max: 4 })
  })

  it('is 0 when sold out', () => {
    expect(clampQuantity(1, edition({ available: 0 }))).toEqual({ value: 0, limited: true, max: 0 })
  })

  it('is 0 when the cart already holds all the stock', () => {
    expect(clampQuantity(1, edition(), 3)).toEqual({ value: 0, limited: true, max: 0 })
  })

  it('keeps at least 1 and is not limited below the max', () => {
    expect(clampQuantity(0, edition())).toEqual({ value: 1, limited: false, max: 3 })
    expect(clampQuantity(2, edition())).toEqual({ value: 2, limited: false, max: 3 })
  })

  it('treats non-finite requests as 1', () => {
    expect(clampQuantity(Number.NaN, edition())).toEqual({ value: 1, limited: false, max: 3 })
    expect(clampQuantity(Number.POSITIVE_INFINITY, edition())).toEqual({ value: 1, limited: false, max: 3 })
  })

  it('reports limited when the request lands exactly on the max', () => {
    expect(clampQuantity(3, edition())).toEqual({ value: 3, limited: true, max: 3 })
  })
})

describe('edition selection', () => {
  const editions = [
    edition({ id: 'a', label: '1/1', available: 0 }),
    edition({ id: 'b', label: '1/10', available: 4 }),
    edition({ id: 'c', label: '1/50', available: 12 }),
  ]

  it('defaults to the first edition with stock', () => {
    expect(defaultEdition(editions)?.id).toBe('b')
  })

  it('falls back to the first edition when none has stock', () => {
    expect(defaultEdition(editions.map((e) => ({ ...e, available: 0 })))?.id).toBe('a')
    expect(defaultEdition([])).toBeUndefined()
  })

  it('uses the requested edition when it exists and has stock', () => {
    expect(resolveEdition(editions, 'c')?.id).toBe('c')
  })

  it('ignores unknown or sold-out requested editions', () => {
    expect(resolveEdition(editions, 'zzz')?.id).toBe('b')
    expect(resolveEdition(editions, 'a')?.id).toBe('b')
    expect(resolveEdition(editions, undefined)?.id).toBe('b')
  })
})
