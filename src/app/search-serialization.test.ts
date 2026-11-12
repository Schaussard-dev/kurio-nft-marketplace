import { describe, expect, it } from 'vitest'
import { parseSearch, stringifySearch } from './search-serialization'

describe('parseSearch', () => {
  it('reads plain values as strings and repeated keys as arrays', () => {
    expect(parseSearch('?minPrice=3.62&categories=a&categories=b&page=2&q=42')).toEqual({
      minPrice: '3.62',
      categories: ['a', 'b'],
      page: '2',
      q: '42',
    })
  })

  it('still understands links written in the old JSON format', () => {
    expect(parseSearch('?maxPrice=%2212.00%22&categories=%5B%22x%22%2C%22y%22%5D')).toEqual({
      maxPrice: '12.00',
      categories: ['x', 'y'],
    })
  })

  it('keeps text that only looks like JSON as typed', () => {
    expect(parseSearch('?q=%5Bfoo&redirect=%2Fperfil%3Fa%3D1')).toEqual({ q: '[foo', redirect: '/perfil?a=1' })
  })

  it('returns an empty object for an empty search', () => {
    expect(parseSearch('')).toEqual({})
    expect(parseSearch('?')).toEqual({})
  })
})

describe('stringifySearch', () => {
  it('writes arrays as repeated keys and drops empty values', () => {
    expect(stringifySearch({ categories: ['a', 'b'], maxPrice: '12.00', page: 2, q: undefined, x: null })).toBe(
      '?categories=a&categories=b&maxPrice=12.00&page=2',
    )
  })

  it('returns an empty string when there is nothing to write', () => {
    expect(stringifySearch({})).toBe('')
  })

  it('round-trips through parseSearch', () => {
    const search = { q: 'arte digital', categories: ['arte-digital', 'musica'], redirect: '/perfil?x=1' }
    expect(parseSearch(stringifySearch(search))).toEqual(search)
  })
})

describe('round trip of text that looks like the old JSON format (CR-02)', () => {
  it.each(['"bored ape"', '["a","b"]', '["a"]', '"', '[]'])('keeps q = %s exactly as typed', (q) => {
    expect(parseSearch(stringifySearch({ q }))).toEqual({ q })
  })

  it('drops empty strings', () => {
    expect(stringifySearch({ q: '', page: 2 })).toBe('?page=2')
  })
})
