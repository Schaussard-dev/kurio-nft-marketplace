import { describe, expect, it } from 'vitest'
import { updateProfileInputSchema } from './profile'

const valid = { displayName: 'Ana', username: 'ana', email: 'ana@kurio.dev', walletNickname: '', ensName: '' }

describe('updateProfileInputSchema', () => {
  it('rejects a whitespace-only display name', () => {
    const result = updateProfileInputSchema.safeParse({ ...valid, displayName: '   ' })
    expect(result.success).toBe(false)
  })

  it('trims the display name', () => {
    expect(updateProfileInputSchema.parse({ ...valid, displayName: '  Ana  ' }).displayName).toBe('Ana')
  })

  it('accepts an empty or dotted .eth name and rejects anything else', () => {
    expect(updateProfileInputSchema.safeParse({ ...valid, ensName: 'ana.kurio.eth' }).success).toBe(true)
    expect(updateProfileInputSchema.safeParse({ ...valid, ensName: 'ana kurio.eth' }).success).toBe(false)
    expect(updateProfileInputSchema.safeParse({ ...valid, ensName: 'ana' }).success).toBe(false)
  })
})
