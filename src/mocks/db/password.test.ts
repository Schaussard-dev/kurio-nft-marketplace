import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const record = await hashPassword('Kurio@2026')
    expect(await verifyPassword('Kurio@2026', record)).toBe(true)
    expect(await verifyPassword('Kurio@2027', record)).toBe(false)
  })

  it('never stores the plain password and salts each hash', async () => {
    const a = await hashPassword('Kurio@2026')
    const b = await hashPassword('Kurio@2026')
    expect(JSON.stringify(a)).not.toContain('Kurio@2026')
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
  })

  it('is deterministic for a given salt', async () => {
    const a = await hashPassword('Kurio@2026', 'abcd')
    const b = await hashPassword('Kurio@2026', 'abcd')
    expect(a).toEqual(b)
  })
})
