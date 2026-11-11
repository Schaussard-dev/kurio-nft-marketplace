import { describe, expect, it } from 'vitest'
import { walletsResponseSchema, type WalletInput } from '@/shared/contracts'
import { WALLET_SEEDS } from '../fixtures/users'
import { listWallets, resolveWalletInput } from './wallets'

const valid: WalletInput = {
  displayName: 'Bruno Lima',
  nickname: 'Principal',
  network: 'ethereum',
  profileName: 'bruno',
  address: '0x1234567890abcdef1234567890abcdef12345678',
  walletType: 'metamask',
  referralCode: 'KURIO-BRUNO',
  email: 'bruno@kurio.dev',
  ensName: 'bruno.eth',
  sameAsPrimary: false,
}

describe('listWallets', () => {
  it('returns the contract shape with the right slots per user', () => {
    const ana = listWallets(WALLET_SEEDS, 'usr_ana')
    expect(walletsResponseSchema.safeParse(ana).success).toBe(true)
    expect(ana.primary?.nickname).toBe('Principal')
    expect(ana.secondary?.nickname).toBe('Reserva')
    expect(ana.primary).not.toHaveProperty('userId')
    expect(listWallets(WALLET_SEEDS, 'usr_bruno')).toEqual({
      primary: null,
      secondary: null,
    })
  })
})

describe('resolveWalletInput', () => {
  it('accepts a valid wallet and flags a network/address mismatch on the address field', () => {
    expect(resolveWalletInput('primary', valid, null)).toEqual({
      input: valid,
    })
    expect(resolveWalletInput('primary', { ...valid, network: 'solana' }, null)).toHaveProperty('fieldErrors.address')
  })

  it('rejects an invalid ENS name', () => {
    expect(resolveWalletInput('primary', { ...valid, ensName: 'bad name' }, null)).toHaveProperty('fieldErrors.ensName')
  })

  it('copies the primary for same-as-primary and needs one first', () => {
    expect(resolveWalletInput('secondary', { sameAsPrimary: true }, null)).toEqual({
      fieldErrors: {
        sameAsPrimary: ['Cadastre a carteira principal primeiro'],
      },
    })
    expect(resolveWalletInput('secondary', { sameAsPrimary: true }, valid)).toEqual({
      input: { ...valid, sameAsPrimary: true },
    })
    expect(resolveWalletInput('primary', { sameAsPrimary: true }, valid)).toHaveProperty('fieldErrors.sameAsPrimary')
  })
})
