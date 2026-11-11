import { describe, expect, it } from 'vitest'
import { catalogSearchSchema, stripDefaults, withFilterChange } from './search-params'

describe('catalog search params', () => {
  it('withFilterChange resets the page to 1 and keeps the other params', () => {
    expect(withFilterChange({ page: 3, sort: 'name' }, { networks: ['polygon'] })).toEqual({
      page: 1,
      sort: 'name',
      networks: ['polygon'],
    })
  })

  it('stripDefaults removes default and empty values', () => {
    expect(stripDefaults({ tab: 'all', sort: 'recent', page: 1, q: '' })).toEqual({})
    expect(stripDefaults({ tab: 'new', sort: 'recent', page: 2, q: 'ape', categories: [], networks: ['solana'] })).toEqual(
      { tab: 'new', page: 2, q: 'ape', networks: ['solana'] },
    )
  })

  it('falls back to defaults for invalid values instead of failing', () => {
    expect(catalogSearchSchema.parse({ page: -2 }).page).toBe(1)
    expect(catalogSearchSchema.parse({ sort: 'cheapest', tab: 'x' })).toMatchObject({ sort: 'recent', tab: 'all' })
    expect(catalogSearchSchema.parse({ networks: ['bitcoin'], minPrice: 'abc' })).toMatchObject({
      networks: undefined,
      minPrice: undefined,
    })
  })

  it('keeps valid values and normalizes single values to arrays', () => {
    expect(catalogSearchSchema.parse({ q: 'golden', categories: 'musica', networks: 'polygon', page: 2 })).toEqual({
      q: 'golden',
      categories: ['musica'],
      networks: ['polygon'],
      tab: 'all',
      sort: 'recent',
      page: 2,
    })
  })
})
