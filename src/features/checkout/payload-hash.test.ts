import { describe, expect, it } from 'vitest'
import type { CreateOrderInput } from '@/shared/contracts'
import { hashPayload } from './payload-hash'

const input: CreateOrderInput = {
  quoteId: 'qt_1',
  walletId: 'wlt_ana_primary',
  network: 'ethereum',
  payer: {
    displayName: 'Ana Souza',
    username: 'ana',
    profileName: 'ana',
    email: 'ana@kurio.dev',
    ensName: 'ana.kurio.eth',
    referralCode: 'KURIO-ANA',
    walletAddress: '0xA91F3c2d4E5f60718293a4b5C6d7E8f90123E82C',
  },
  note: 'Presente',
}

describe('hashPayload', () => {
  it('is a SHA-256 hex digest that ignores key order (also nested)', async () => {
    const reordered = {
      note: input.note,
      payer: Object.fromEntries(Object.entries(input.payer).reverse()),
      network: input.network,
      walletId: input.walletId,
      quoteId: input.quoteId,
    } as CreateOrderInput
    const a = await hashPayload(input)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashPayload(reordered)).toBe(a)
  })

  it('changes when any value changes', async () => {
    const a = await hashPayload(input)
    expect(await hashPayload({ ...input, quoteId: 'qt_2' })).not.toBe(a)
    expect(await hashPayload({ ...input, payer: { ...input.payer, email: 'x@kurio.dev' } })).not.toBe(a)
  })
})
