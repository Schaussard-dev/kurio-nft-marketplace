import { describe, expect, it } from 'vitest'
import { ENS_LABEL_PATTERN, toFormEns, toStoredEns } from './ens'

describe('ens helpers', () => {
  it('splits and joins the .eth suffix', () => {
    expect(toFormEns('ana.kurio.eth')).toBe('ana.kurio')
    expect(toFormEns('')).toBe('')
    expect(toStoredEns('ana')).toBe('ana.eth')
    expect(toStoredEns('foo.eth')).toBe('foo.eth')
    expect(toStoredEns('  ')).toBe('')
  })

  it('validates the label part', () => {
    expect(ENS_LABEL_PATTERN.test('ana.kurio')).toBe(true)
    expect(ENS_LABEL_PATTERN.test('bad name')).toBe(false)
  })
})
