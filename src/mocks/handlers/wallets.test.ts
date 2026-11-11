import { describe, expect, it } from 'vitest'
import { walletConnectionSchema, walletsResponseSchema, type WalletInput } from '@/shared/contracts'
import { WALLET_SEEDS } from '../fixtures/users'
import { SCENARIOS } from '../scenarios'
import { listWallets, resolveConnect, resolveWalletInput, syncSecondary } from './wallets'

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

describe('wallet rules', () => {
  it('requires the ENS name only on Ethereum', () => {
    expect(resolveWalletInput('primary', { ...valid, ensName: '' }, null)).toHaveProperty('fieldErrors.ensName')
    const polygon = { ...valid, network: 'polygon', ensName: '' }
    expect(resolveWalletInput('primary', polygon, null)).toHaveProperty('input')
  })

  it('trims required strings', () => {
    expect(resolveWalletInput('primary', { ...valid, displayName: '   ' }, null)).toHaveProperty(
      'fieldErrors.displayName',
    )
  })

  it('accepts an address or an ENS name as the secondary address', () => {
    const ok = (secondaryAddress: string) =>
      'input' in resolveWalletInput('primary', { ...valid, secondaryAddress }, null)
    expect(ok(valid.address)).toBe(true)
    expect(ok('nova.kurio.eth')).toBe(true)
    expect(ok('not an address')).toBe(false)
    expect(resolveWalletInput('primary', { ...valid, secondaryAddress: 'nope' }, null)).toHaveProperty(
      'fieldErrors.secondaryAddress',
    )
  })
})

describe('syncSecondary', () => {
  const primary = { ...valid, id: 'wlt_x_primary', slot: 'primary', userId: 'usr_x' } as const
  const secondary = {
    ...valid,
    id: 'wlt_x_secondary',
    slot: 'secondary',
    userId: 'usr_x',
    sameAsPrimary: true,
  } as const

  it('copies the primary into a same-as-primary secondary, keeping its id and slot', () => {
    const edited = { ...primary, nickname: 'Cofre' }
    expect(syncSecondary(secondary, edited)).toEqual({
      ...edited,
      id: 'wlt_x_secondary',
      slot: 'secondary',
      sameAsPrimary: true,
    })
  })

  it('leaves an independent or missing secondary alone', () => {
    const independent = { ...secondary, sameAsPrimary: false, nickname: 'Reserva' }
    expect(syncSecondary(independent, primary)).toBe(independent)
    expect(syncSecondary(undefined, primary)).toBeUndefined()
  })
})

describe('resolveConnect', () => {
  it('connects an owned wallet', () => {
    const result = resolveConnect(WALLET_SEEDS, 'usr_ana', 'wlt_ana_primary', false)
    expect('connection' in result && walletConnectionSchema.safeParse(result.connection).success).toBe(true)
  })

  it('connects a wallet typed in by hand through its connector id (MetaMask, WalletConnect, Coinbase)', () => {
    for (const connector of ['metamask', 'walletconnect', 'coinbase']) {
      expect(resolveConnect(WALLET_SEEDS, 'usr_bruno', connector, false)).toHaveProperty('connection.connected', true)
    }
    expect(resolveConnect(WALLET_SEEDS, 'usr_bruno', 'metamask', true)).toEqual({ error: 'WALLET_REJECTED' })
    expect(resolveConnect(WALLET_SEEDS, 'usr_bruno', 'phantom', false)).toEqual({ error: 'NOT_FOUND' })
  })

  it('refuses when the wallet-reject scenario flag is on', () => {
    expect(SCENARIOS['wallet-reject'].flags?.walletReject).toBe(true)
    expect(SCENARIOS.default.flags?.walletReject).toBeUndefined()
    expect(resolveConnect(WALLET_SEEDS, 'usr_ana', 'wlt_ana_primary', true)).toEqual({ error: 'WALLET_REJECTED' })
  })

  it('does not find a wallet owned by another user', () => {
    expect(resolveConnect(WALLET_SEEDS, 'usr_bruno', 'wlt_ana_primary', false)).toEqual({ error: 'NOT_FOUND' })
  })
})
